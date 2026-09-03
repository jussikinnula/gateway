import * as THREE from 'three';
import { NOISE, HEIGHT_FOG } from '../core/glsl.js';
import { fbm as fbmCPU } from '../core/noise-cpu.js';

/* The volcanic world (S7).
 *
 * 'Ash, smoke and fire under a black sky. Beautiful in a way that wants us
 * gone. Nothing here is at human scale.'
 *
 * The scale line is the brief, and it is a rendering instruction rather than a
 * mood: nothing in this world may carry a size the eye already knows. So there
 * is no vegetation, no debris, no rock with a recognisable grain.
 *
 * The first two passes read that as 'no terrain either' and built a flat plain
 * with separate cone MESHES standing on it — seven ConeGeometries, scattered,
 * gullied by displacing their vertices. The verdict on it was flat: 'S7
 * tulivuoret eivät näytät yhtään tulivuorilta... Nyt suunta ei ole oikea', with
 * the instruction to generate them the way the desert is generated instead.
 *
 * That is the right instruction and the reason is worth stating, because it is
 * not a matter of detail. A cone standing ON a plain is an OBJECT: it has a
 * silhouette, a base where it meets the ground, and a size — everything the
 * brief forbids. A volcano is not an object sitting on a landscape, it is the
 * landscape's own shape; the plain does not stop where the mountain starts, it
 * tilts and keeps going. Only a height field can say that, because only a
 * height field has one surface. So the cones are gone and there is now exactly
 * one piece of ground in this world, and the volcanoes are places in it:
 *
 *   buildTerrain()  a heightfield on a plane that rides under the camera in
 *                   whole grid cells — snapped, not merely recentred, which is
 *                   the fix desert.js records at length and the reason that
 *                   desert holds still under a flying camera. The field is a
 *                   ridged plain plus a handful of volcanoes at fixed world
 *                   positions, each with a crater, a rim and gullies its own
 *                   ejecta cut, and lava running out of the crater and down
 *                   those gullies. It is one function; the cracks between the
 *                   plates and the rivers on the flanks are the same surface.
 *
 *   buildColumns()  smoke going up for kilometres, and now standing where the
 *                   smoke would actually be: one column out of every crater,
 *                   read from the same table the terrain is built from.
 *
 *   buildEmbers()   the only fast-moving thing in the world. Instanced points
 *                   rising and drifting, positioned by a closed form so frame
 *                   40000 needs nothing before it.
 *
 *   buildSky()      near-black, with the ash haze catching the ground glow
 *                   from underneath. There is no sun in this world.
 *
 * Everything is a pure function of t. The embers rise by evaluating their own
 * age from a hash and the clock rather than by integrating a velocity, and the
 * terrain has no clock at all — only the lava's crust drifts, in the fragment
 * stage, where it moves light and not geometry.
 */

function hash(i, salt){
  let x = (i*2654435761 + salt*40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}

/* The crack field, shared by the ground and by the haze that catches its
   light — one function so the glow under the smoke is the glow on the floor
   and the two cannot drift apart. Cellular rather than fbm: cracks are the
   BOUNDARIES between plates, and a Voronoi edge distance is what a boundary
   actually is, where a thresholded fbm gives blobs with gaps between them. */
const CRACK_GLSL = /* glsl */`
vec2 cellHash(vec2 p){
  vec3 q = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz)*q.zy);
}
/* Returns the distance to the nearest cell BORDER, not to the nearest cell
   centre — the two are not the same and only the first draws a crack. */
float crackDist(vec2 p){
  vec2 ip = floor(p), fp = fract(p);
  vec2 mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = cellHash(ip + g);
    vec2 r = g + o - fp;
    float d = dot(r, r);
    if (d < md){ md = d; mg = g; mr = r; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++){
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = cellHash(ip + g);
    vec2 r = g + o - fp;
    if (dot(mr - r, mr - r) > 1e-5)
      md = min(md, dot(0.5*(mr + r), normalize(r - mr)));
  }
  return md;
}
/* 0 on the plates, 1 in the seams. Two scales: a coarse network of major
   fissures and a finer craquelure inside the plates, because a single scale
   reads as a tiled floor. */
/* fp is the PIXEL FOOTPRINT in world units, and passing it in is the whole
   fix for 'värinää tulivuorien pinnalla'.

   The seams below are 7.2 and 3.2 world units wide. Past the immediate
   foreground that is under one pixel, so what the shader was drawing was a
   network of bright sub-pixel lines over near-black basalt, with no
   band-limiting of any kind — and a sub-pixel bright line under a moving
   camera does not move, it sparkles. Measured with a block-matched
   motion-compensated residual (which is the only instrument that can tell a
   picture that MOVED from a picture that FLICKERED), the terrain's unexplained
   residual was concentrated exactly on the seam network.

   So each seam is widened to at least its own footprint and dimmed by the same
   factor, which is what a mip level is: the same light spread over the area it
   actually covers. Where fp is small the max() picks the authored width and
   nothing about the foreground changes at all. */
float crackGlow(vec2 p, float fp){
  /* Cell size and seam width both matter, and the first pass had both wrong by
     about a factor of four: cells a few tens of units across with seams wide
     enough to touch each other, which renders as a glowing wire mesh — a
     circuit board, not a lava field. What makes a crack read as a crack is
     that the PLATES dominate and the seams are thin lines between them, so the
     frequencies came down (cells of roughly 550 and 170 units) and the widths
     came down further.

     crackDist returns distance in cell units, so a seam of a given width in
     the world is that width times the frequency — which is why these two
     thresholds are not the same number even though the seams look alike. */
  /* Domain-warped before it is sampled. A Voronoi over a jittered lattice is
     a honeycomb — the cells come out the same size and roughly hexagonal, and
     at this scale that reads as tiling, not as rock. Displacing the sample
     point by a low-frequency field first breaks the lattice up without
     touching the cell function at all: the cells become irregular in size and
     shape because the space they live in is no longer flat. */
  vec2 wp = p + (vec2(fbm(p*0.00090), fbm(p*0.00090 + 19.0)) - 0.5)*520.0;
  float wA = 0.013, kA = max(wA, fp*0.0018*1.7);
  float wB = 0.019, kB = max(wB, fp*0.0060*1.7);
  float a = (1.0 - smoothstep(0.0, kA, crackDist(wp*0.0018)))*(wA/kA);
  float b = (1.0 - smoothstep(0.0, kB, crackDist(wp*0.0060 + 31.0)))*(wB/kB);
  /* And most of the plain is cold. Without this the cracks are everywhere at
     once and the ground has no composition — a slow mask lets whole regions go
     dark so the lit ones read as somewhere in particular. */
  float live = smoothstep(0.52, 0.86, fbm(p*0.00055 + 7.0));
  /* And the rivers. The reference the brief was given is a lava FIELD — broad
     bright flows with dark crust floating on them — not a cracked pavement,
     and a seam network alone can never be that however brightly it is lit,
     because a seam is by construction thinner than the plate beside it. This
     is a separate, much wider channel: a low-frequency ridge, thresholded so
     it opens into flows tens of metres across where it crosses a live region
     and closes to nothing where it does not. */
  float rv = 1.0 - abs(fbm(p*0.00042 + 53.0)*2.0 - 1.0);
  /* The rivers on the plain, which is what the second shot actually flies
     over. Widened again after they were cut back to stop the near seams
     clipping — the clipping was the seam CORE being cubed, not the rivers, and
     cutting these as well left the run crossing an empty floor. */
  float river = smoothstep(0.70, 0.965, rv)*live;
  /* Clamped to one, not to 1.6. The old ceiling let a river crossing a live
     region reach 1.6, which the ground shader then cubed for the seam core —
     four times over, and the near foreground of the second shot went to a flat
     white sheet. A mask is a fraction. */
  return clamp((a + b*0.40)*(0.12 + 0.88*live) + river*0.70, 0.0, 1.0);
}`;


/* Cooled lava — the SHAPES, and they are in the height field.
 *
 * The note: 'tulivuoriskenessä tulivuoren pinnat on tekstuuria, ja lopussa kun
 * lennetään kohti tulivuorta huomaa että ei ole oikeita jäähtyneen laavan
 * muotoja.' Exactly right, and the source above admits it in as many words:
 * 'Rock texture as a normal perturbation rather than as geometry.' Every
 * reading of relief in this world below about two hundred units was a lie told
 * by a normal, and the tell is in every frame of the low run — the ground's
 * silhouette against the sky is a clean smooth curve, which no lava field has
 * ever been.
 *
 * Two separate faults under one complaint, and they need separate fixes:
 *
 *   1. There is no morphology at ANY scale. volcBase()'s finest octave is a
 *      160-unit wavelength at eight units of amplitude; below that the field
 *      is flat. The 19-unit lattice could have carried lobes and ridge trains
 *      the whole time and never had any to carry. That is this block.
 *   2. And there is no resolution near the lens. The camera ends the shot
 *      ninety-five units up over a mesh whose vertices are nineteen apart —
 *      a handful of triangles across the entire foreground, so even if the
 *      field had detail the mesh could not show it. That is buildDetail().
 *
 * What actually shapes a cooled flow, at sizes this world is ALLOWED to have.
 * The brief forbids anything at human scale, which rules out the forms most
 * people picture — ropes and clinker are decimetres, and a decimetre is a
 * size a person knows. Everything below is tens of metres, which is landscape
 * and not furniture:
 *
 *   lobeField()   pahoehoe toes and inflation plateaus. A lobe is a
 *                 FLAT-TOPPED plateau with a steep front, and lobes OVERLAP —
 *                 a younger one lies on top of an older one instead of
 *                 blending into it. So this is a max over rounded plateaus and
 *                 not a sum of bumps, and that one choice is most of what
 *                 separates lava from hills: hills add, flows stack.
 *   ridgeTrain()  pressure ridges, which form ACROSS the direction of travel
 *                 when a chilled crust is shoved from behind. Sampled in a
 *                 frame whose fast axis is the flow direction, so the arcs
 *                 lie across it rather than along it — the same mistake the
 *                 cone gullies made once and the same fix.
 *   and a shallow seam cut, because a crust that has pulled apart has a
 *                 groove in it and this world's cracks were light painted on
 *                 a floor.
 *
 * All of it is sampled in the flow's own frame, so the lobes are longer than
 * they are wide ALONG the way the rock went and the ridges lie across it. A
 * flow field that has no direction reads as gravel.
 */
const LAVA_GLSL = /* glsl */`
/* The flow's own frame — and getting this wrong is what made the ground come
   back as crumpled foil twice, so it is worth stating plainly.

   The obvious construction is a rotation: take a direction field d(p) and
   sample in q = (dot(p,d), dot(p,perp(d))). That is not a rotation. A rotation
   by a POSITION-DEPENDENT angle has Jacobian I + p*(d d/dp), and the second
   term grows with the distance from the origin without bound. Out at three thousand units from the
   origin, with a direction field turning at about a hundredth of a radian per
   unit, that factor is thirty — so every "240-unit lobe" in the first two
   attempts was really an eight-unit lobe, which is barely one triangle of the
   mesh drawing it. Hence spikes, twice, at whatever size the parameter said.

   It is exactly the fault the waterfalls had as phase = y - t*rate(y), in
   space instead of in time: multiplying a coordinate by something that varies
   over that coordinate multiplies its frequency by the derivative.

   So the frame is a BOUNDED domain warp instead. The grain is fixed in world
   space and bent by a displacement whose own gradient is a fraction of one, so
   the lobes curve and wander and the frequency stays the frequency. Same
   device crackGlow() already uses on its cells, and for the same reason. */
vec2 lavaFrame(vec2 p){
  vec2 w = vec2(fbm(p*0.00040 + 71.0), fbm(p*0.00040 + 131.0)) - 0.5;
  return p + w*900.0;
}

/* A SOFT max, and it is the difference between a lobe field and a bed of
   nails.
   Two lobes that meet do keep their own fronts — that is the whole reason
   this is a max and not a sum. But a hard max over cells with independent
   heights puts a vertical step at every boundary where the two happen to
   differ, and a vertical step between two vertices 6.8 units apart is not a
   step, it is a spike. This rounds the join over k, which is a real width in
   the world rather than an infinitesimal one. */
float smax(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(a - b)/k, 0.0, 1.0);
  return mix(b, a, h) + k*h*(1.0 - h);
}

/* One layer of overlapping lobes. Distance to the nearest cell CENTRE, turned
   into a plateau rather than a cone: flat across most of the lobe and steep
   in its last stretch, which is the profile of a toe that inflated and then
   chilled at its rim.

   The 'front' argument is that steep stretch, in cell units, and it is the
   parameter this
   block exists to get right. A lava front is very nearly vertical in reality;
   drawn on a 6.8-unit lattice, "very nearly vertical" is one triangle, and one
   triangle standing on end is a spike. So every layer's front is at least
   three or four vertex spacings wide — chosen from the MESH, not from the
   reference photograph. Same law as everywhere else in this project: a field
   that varies faster than the thing sampling it has no shape, only noise. */
float lobeField(vec2 p, float sd, float front){
  vec2 ip = floor(p), fp = fract(p);
  float best = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = cellHash(ip + g + sd);
    vec2 r = g + o - fp;
    /* Longer than wide, along the flow — the sample frame is already the
       flow's, so this is simply an anisotropy in y. */
    float d = length(vec2(r.x, r.y*1.45));
    float rad = 0.34 + 0.26*o.x;
    /* And a NARROW spread of heights. At 0.28..1.00 the tallest lobe in a
       neighbourhood stood three times its neighbour, so the soft max had a
       ten-unit cliff to round off at every second boundary and the field read
       as rubble. Lobes in one flow are within a factor of two of each other;
       the variety comes from their outlines, not from their heights. */
    float amp = 0.62 + 0.38*o.y;
    float k = 1.0 - smoothstep(max(0.04, rad - front), rad, d);
    best = smax(best, amp*k, 0.18);
  }
  return best;
}

/* Pressure ridges. q is in the flow frame; the field varies fast along x and
   barely at all across, so the crests come out as long arcs lying ACROSS the
   flow, which is the direction a shoved crust buckles in. */
float ridgeTrain(vec2 q){
  float n = fbm(vec2(q.x, q.y*0.22));
  float r = 1.0 - abs(n*2.0 - 1.0);
  return r*r;
}

/* How wide a lobe's front is allowed to be, in world units — and it is a
   function of the distance to the lens rather than a constant, for one reason
   that is not about looks at all.

   A lava front is very nearly vertical in reality. Drawn on the near mesh's
   6.8-unit lattice, thirty units is four vertices and reads as a front; drawn
   on the coarse mesh's nineteen, it is one and a half, and one and a half
   vertices of vertical drop is a spike. So the front OPENS with distance, over
   exactly the ramp the fine detail fades on — and because both meshes evaluate
   this same expression, they are computing one identical surface everywhere
   they overlap. That is the whole reason the seam between them is not a seam.

   Sixty-two units of softness at twelve hundred units away is a third of a
   pixel. Nothing is being given up. */
/* THE LOBE FRONT, and it is a CONSTANT — which it had to become, because the
   version that widened it with distance from the camera was putting the camera
   inside the height field.

   The reason it existed was right: a lobe front narrower than the mesh can
   sample comes back as a spike, which is what the first two passes at this
   geometry drew. The variable it was written against was wrong. The mesh's
   sampling density does not fall off with distance — it is 19.35 units on the
   coarse plane and 6.8 on the near patch, uniform across each. What falls off
   with distance is the SCREEN density, and a step too fine for the screen is
   an aliasing problem, not a geometry one.

   The cost of getting that wrong was not subtle. surfH() reads this, so the
   height of every vertex in the world was a function of where the camera was:
   the plain deformed continuously as the camera flew over it, and the lattice
   snapping that is supposed to hold the terrain still held the SAMPLE POINTS
   still while the FIELD moved underneath them. Measured at 30 fps over the
   volcanic plain, eleven per cent of the frame changed by more than 20 levels
   between consecutive frames, spread as fine mottling over every rock surface
   and as a several-pixel band along every silhouette — 'värinää tulivuorien
   pinnalla ja vieressä'.

   85 is set by the coarse mesh's own lattice, which is the variable that was
   missing from the first version of this. At 27.1 units between vertices a
   front of 85 is a bit over three samples, which is the ratio the old wide end
   of 62 had against the old 19.4-unit lattice — so the mesh is asked for
   exactly what it was asked for before, at both spacings. Both meshes evaluate
   one expression with no camera in it, so they still agree exactly wherever
   they overlap, and the near field is a little softer in the big lobes. That is paid for by lavaFine(), which draws
   110-unit toes with a 30-unit front and is the layer that was always meant
   to carry the near-field shape. */
const float LAVA_FRONT = 85.0;

/* The big forms, and these are EVERYWHERE — on the plain, on the cone flanks,
   and on the horizon. They have to be: the note is that the surfaces are a
   texture, and the place a surface cannot fake its shape is its silhouette,
   which is by definition far away. A near patch alone would have answered the
   foreground and left every skyline in the scene a clean smooth curve. */
float lavaBig(vec2 p, float front){
  vec2 q = lavaFrame(p);
  /* Where the crust is broken and where it is not. Without this the whole
     plain is equally rough, which is the one thing a lava field never is: it
     is smooth inflated sheet with broken zones through it, and that contrast
     is most of what gives the ground a composition instead of a texture. */
  float rough = smoothstep(0.34, 0.74, fbm(p*0.00055 + 13.0));
  /* Inflation plateaus: two hundred and forty units across, fifteen tall. */
  float h = lobeField(q/240.0, 0.0, front/240.0)*15.0;
  /* Ridge trains, a hundred and twenty units between crests and only three
     tall. They were six, and six across a plain that all faces the same way
     is a ploughed field. */
  h += ridgeTrain(q/120.0)*3.2*rough;
  return h;
}

/* And the near forms, which only the detail mesh is ever fine enough to draw
   and only it ever pays for. */
float lavaFine(vec2 p){
  vec2 q = lavaFrame(p);
  float rough = smoothstep(0.34, 0.74, fbm(p*0.00055 + 13.0));
  /* Toes on top of the plateaus: a hundred and ten units, six tall. Rounder
     than the big ones, because at that size a front the mesh can actually
     draw IS most of the lobe — which is also true of the real thing. */
  float h = lobeField(q/110.0 + 4.7, 3.0, 30.0/110.0)*6.0*(0.35 + 0.65*rough);
  /* And the crust pulls apart. Three units is nothing on a mountain and
     everything on a plate. A ridged octave rather than the Voronoi the GLOW
     uses: the seams have to BE in the surface, they do not have to be the
     same seams the light comes out of, and a second cell walk per vertex is
     not worth making them agree. */
  float seam = 1.0 - abs(fbm(q*0.0052 + 23.0)*2.0 - 1.0);
  h -= smoothstep(0.68, 1.0, seam)*3.4;
  return h;
}

/* How much of the above this pixel is allowed to have. Zero well before the
   detail mesh's own rim, so the coarse mesh and the detail mesh are computing
   the SAME surface everywhere they overlap and the seam between them is not a
   seam.

   Measured in the patch's OWN local coordinates and not against the camera,
   for the same reason as LAVA_FRONT above: the patch is snapped to a 6.8-unit
   lattice, so a gate written in local coordinates is exactly constant between
   snaps and shifts by one lattice cell at one — while a gate written against
   the camera slides continuously, which makes the fine relief breathe in a
   ring seven hundred units out. length(local) IS the distance from the patch
   centre; there was never a need to go via the world for it. */
float detailGate(vec2 local){
  return 1.0 - smoothstep(700.0, 1150.0, length(local));
}`;


/* The sky, as a function of view direction alone — shared, because two shaders
 * need the same answer out of it and an approximation of it in the second one
 * is a visible seam.
 *
 * The ground is a finite plane and therefore has an edge. Faded out to a fixed
 * haze colour, as it was, that edge is exactly where the haze colour stops
 * matching the sky behind it — which drew a hard horizontal band across the
 * left of every wide frame, brightest along the horizon where the difference is
 * largest. It is the same fault desert.js had and fixed the same way: the
 * ground has to fade into the sky that is ACTUALLY behind that pixel, so both
 * call this.
 */
const SKY_GLSL = /* glsl */`
vec3 volcSky(vec3 dir, float heat, float time, vec3 hot){
  /* Black overhead. There is no sun in this world and nothing above the ash to
     make one. */
  vec3 col = vec3(0.008, 0.007, 0.010);
  /* The glow the ground throws into the ash, strongest at the horizon and gone
     by thirty degrees up. This is the only reason the sky is not simply the
     clear colour, and it is what makes the smoke columns readable as
     silhouettes against something. */
  float low = smoothstep(0.34, -0.05, dir.y);
  float roll = fbm(vec2(atan(dir.x, -dir.z)*1.7 + time*0.02, dir.y*5.0));
  col += hot*low*low*(0.028 + 0.038*roll)*(0.55 + 0.45*heat);
  /* Ash in the air, which is what stops the upper sky being a flat black field
     with a visible gradient edge. */
  col += vec3(0.012, 0.010, 0.011)*fbm(vec2(dir.x*3.0, dir.z*3.0) + 11.0);
  return col;
}`;

/* The volcanoes, as a table.
 *
 * Fixed world positions, not a hash scatter, and that is deliberate: a volcano
 * is a PLACE, and this shot flies past specific ones. Two stand close enough
 * to the path to pass by, two more sit ahead of it where the first shot's
 * raised pitch looks, and the rest are far out where they read as the far side
 * of a caldera rather than as neighbours.
 *
 * The corridor matters and was checked rather than eyeballed: the camera runs
 * from z=0 to z=-942 along x=0, and the nearest approach to any cone's base is
 * 290 units clear of it. Nothing here needs collision handling because nothing
 * ever gets the chance.
 *
 *   x      z      radius  height  seed
 */
const CONES = [
  /* The hero, and index 0 is load-bearing: s07-volcanic.js circles this one in
     the first shot, and reads its position from here rather than repeating it.
     A volcano the camera orbits has to be big enough to stay the subject for
     five seconds and small enough for the orbit to get round it. */
  /* The seed is not decoration here — it decides WHERE ON THE MOUNTAIN the
     live flows are, and the first shot spends five seconds looking at one
     side of it. 0.547 was picked by measurement rather than by taste: the
     camera's bearing from this cone runs 0.00 to 0.41 radians across the
     orbit, and this seed is the one whose channels are strongest across
     exactly that window. The note was 'pidetään vaan kuvakulma siinä puolella
     tulivuoria joissa on laavaa' — and the way to keep the camera on the lava
     side is to put the lava on the camera's side. */
  [   760, -1500,  1400,  760,  0.547 ],
  /* East of the corridor the second shot runs down, and west-forward of it —
     the two the run passes between. */
  [  3900, -2100,  1100,  380,  0.41 ],
  [  1250, -3080,  1050,  400,  0.67 ],
  /* Dead ahead, seen down the corridor for the whole run. */
  /* Dead ahead, and the run stops three hundred units short of its base.
     Ending ON the lower flank, as it did, put the camera inside the mountain's
     own footprint with the slope filling the bottom of frame — 'sukellettiin
     vuoren sisään'. Approaching it and not arriving is the shot. */
  [  2820, -5600,  2100,  880,  0.29 ],
  /* And the far side of the caldera. */
  [  -900, -4600,  2100,  820,  0.83 ],
  [  5200, -4900,  2000,  760,  0.72 ],
  [  1400,    900,  820,  240,  0.91 ]
];

/** The volcano the first shot circles. Exported so the scene and the terrain
    cannot disagree about where it is. */
export const HERO = { x: CONES[0][0], z: CONES[0][1], R: CONES[0][2], H: CONES[0][3] };
/* The crater's radius as a fraction of the cone's, and how deep the bowl is
   cut into the summit as a fraction of its height. Shared by the shader, the
   CPU mirror and the smoke columns, so a crater cannot be in three places. */
const RIM = 0.075, BOWL = 0.135;

/* One volcano, and the whole shape of one is in here.
 *
 * The profile is pow(1 - u, 1.55), which is the part that decides whether this
 * reads as a volcano or as a party hat. A cone with straight sides has a
 * constant slope and looks manufactured; a real stratovolcano is CONCAVE — very
 * steep just under the rim, shallowing all the way out until it meets the plain
 * at no angle at all. An exponent above one gives exactly that, and gives it
 * with zero gradient at u = 1, so the mountain does not end anywhere. There is
 * no base, no join, no silhouette against a separate ground. That is the whole
 * argument for doing this as a field.
 *
 * The summit is then flattened to the rim's own height and a bowl cut into it,
 * because a volcano's highest point is a ring and not a peak.
 *
 * The gullies are radial, because water and ejecta run downhill and downhill on
 * a cone is radial. They are sampled as noise ON A CIRCLE — fbm at
 * (cos a, sin a)*k — rather than as noise of the angle, which would tear at
 * +-pi; and the angle is warped by a slow function of the radius first, so a
 * gully wanders as it descends instead of being a spoke.
 *
 * Returns (height, lava, crater, radial coordinate).
 */
const VOLC_GLSL = /* glsl */`
/* Height only, and it stops at the mountain's edge. The vertex shader runs
   this three times per vertex for the normal, so the early-out is what keeps a
   seven-cone field affordable: most of the plane is outside most of the cones
   and never touches a noise call. */
float coneH(vec2 p, vec2 c, float R, float H, float sd){
  vec2 d = p - c;
  float u = length(d)/R;
  if (u > 1.0) return 0.0;
  float ang = atan(d.y, d.x);
  float a2 = ang + 0.14*(fbm(vec2(u*1.4, sd*13.0)) - 0.5);
  vec2 cir = vec2(cos(a2), sin(a2));
  float gully = 1.0 - abs(fbm(cir*2.35 + sd*37.0)*2.0 - 1.0);
  float fine  = 1.0 - abs(fbm(cir*5.60 + sd*71.0)*2.0 - 1.0);
  float cap = H*pow(1.0 - 0.0750, 1.55);
  float h = min(H*pow(1.0 - u, 1.55), cap);
  h -= smoothstep(0.0750, 0.0750*0.28, u)*H*0.1350;
  h -= gully*H*0.105*smoothstep(0.04, 0.42, u)*(1.0 - u);
  h -= fine*H*0.038*smoothstep(0.06, 0.50, u)*(1.0 - u);
  return h;
}

/* Height, lava, crater and the radial coordinate — for the fragment stage,
   which needs to know about lava well past where the mountain stops.
 *
 * Because lava does not stop where the mountain does. Cut off at u = 1, as the
 * first pass had it, every flow ended in a clean circle at the foot of its own
 * cone and the plain between the volcanoes — which is exactly where the second
 * shot spends its whole run — had nothing on it but whatever the fissure field
 * happened to be doing there. A flow that reaches the plain keeps going,
 * spreading as it loses its channel and cooling as it goes; so the field runs
 * out to u = 1.9, the height terms stop contributing at 1.0, and the channel
 * WIDENS past the base because a flow with no gully to hold it does.
 */
vec4 coneAt(vec2 p, vec2 c, float R, float H, float sd){
  vec2 d = p - c;
  float r = length(d);
  float u = r/R;
  if (u > 1.9) return vec4(0.0);

  float ang = atan(d.y, d.x);
  /* The gully's own wander as it descends. Small, and it has to be: at 0.62
     radians a channel at a thousand units from the vent slid six hundred units
     sideways on its way down, which drew the flows as smears ALONG the
     contours instead of as rivers running down them — brushed metal, not lava.
     Downhill on a cone is radial, and a channel is allowed to meander about it,
     not to cross it. */
  float a2 = ang + 0.14*(fbm(vec2(u*1.4, sd*13.0)) - 0.5);
  vec2 cir = vec2(cos(a2), sin(a2));
  float gn = fbm(cir*2.35 + sd*37.0);
  float gully = 1.0 - abs(gn*2.0 - 1.0);
  /* A second, finer set of channels between the major ones. One octave of
     radial cutting gives a flank with a dozen clean ribs, which is a beach
     umbrella; real ejecta cuts at every scale it can reach, and the ribs
     between the ribs are most of what stops the surface reading as moulded. */
  float gn2 = fbm(cir*5.60 + sd*71.0);
  float fine = 1.0 - abs(gn2*2.0 - 1.0);

  float h = coneH(p, c, R, H, sd);

  /* Which channels are running. Opened up from 0.56-0.90: two live flows per
     mountain read as a volcano at rest, and the note asked for lava. Four or
     five is an eruption, which is what this scene is. */
  float act = smoothstep(0.40, 0.78, fbm(cir*1.05 + sd*11.0));
  /* Narrow on the flank, wider once it is off it — a flow that still has a
     gully round it is a river, and one that does not is a sheet. */
  float thr = 0.820 - 0.14*clamp(u - 1.0, 0.0, 1.0);
  float chan = smoothstep(thr, 0.996, gully)*act*(0.35 + 0.65*fine);
  /* And lava cools as it runs. Slow enough to still be alight when it reaches
     the plain, which is the whole point of letting it get there. */
  /* Slow enough to still be alight when it reaches the plain, which is the
     point of letting it get there — and no slower. At 1.55 the flows from
     seven cones overlapped into one sheet and the plain stopped being rock
     with lava on it. */
  float cool = exp(-max(0.0, u - 0.0750)*2.05);
  float crater = smoothstep(0.0750*1.35, 0.0750*0.45, u);
  return vec4(h, chan*cool, crater, u);
}

/* The whole ground: a plain, plus every volcano in it.
 *
 * Heights ADD — two overlapping volcanoes build one massif, which is what they
 * do — while lava takes the strongest rather than the sum, because a point is
 * either in a flow or it is not.
 *
 * Returns (height, lava, crater, the radial coordinate of whichever flow won).
 */
/* The plain, shared by both entry points below. */
float volcBase(vec2 p){
  /* A low swell for the vast horizontal, a ridged octave for the broken
     lava-field relief, and two finer ones that stay comfortably above the mesh
     spacing — the undersampling trap this project has now hit in three
     different environments. */
  float base = (fbm(p*0.00035) - 0.5)*40.0;
  float rid = 1.0 - abs(fbm(p*0.00115 + 5.0)*2.0 - 1.0);
  base += rid*rid*26.0;
  base += (fbm(p*0.0022 + 41.0) - 0.5)*15.0;
  base += (fbm(p*0.0062 + 17.0) - 0.5)*8.0;
  return base;
}

/* The whole ground, for the fragment stage. Heights ADD — two overlapping
   volcanoes build one massif, which is what they do — while lava takes the
   strongest rather than the sum, because a point is either in a flow or it is
   not. Returns (height, lava, crater, the radial coordinate of whichever flow
   won). */
vec4 volcAt(vec2 p){
  vec4 acc = vec4(volcBase(p), 0.0, 0.0, 1.0);
  { vec4 c = coneAt(p, vec2(760.0, -1500.0), 1400.0, 760.0, 0.547);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  { vec4 c = coneAt(p, vec2(3900.0, -2100.0), 1100.0, 380.0, 0.410);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  { vec4 c = coneAt(p, vec2(1250.0, -3080.0), 1050.0, 400.0, 0.670);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  { vec4 c = coneAt(p, vec2(2820.0, -5600.0), 2100.0, 880.0, 0.290);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  { vec4 c = coneAt(p, vec2(-900.0, -4600.0), 2100.0, 820.0, 0.830);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  { vec4 c = coneAt(p, vec2(5200.0, -4900.0), 2000.0, 760.0, 0.720);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  { vec4 c = coneAt(p, vec2(1400.0, 900.0), 820.0, 240.0, 0.910);
    acc.x += c.x;  acc.z = max(acc.z, c.z);
    if (c.y > acc.y){ acc.y = c.y; acc.w = c.w; } }
  return acc;
}

/* And the height alone, for the vertex stage. */
float terrH(vec2 p){
  float h = volcBase(p);
  h += coneH(p, vec2(760.0, -1500.0), 1400.0, 760.0, 0.547);
  h += coneH(p, vec2(3900.0, -2100.0), 1100.0, 380.0, 0.410);
  h += coneH(p, vec2(1250.0, -3080.0), 1050.0, 400.0, 0.670);
  h += coneH(p, vec2(2820.0, -5600.0), 2100.0, 880.0, 0.290);
  h += coneH(p, vec2(-900.0, -4600.0), 2100.0, 820.0, 0.830);
  h += coneH(p, vec2(5200.0, -4900.0), 2000.0, 760.0, 0.720);
  h += coneH(p, vec2(1400.0, 900.0), 820.0, 240.0, 0.910);
  return h;
}
`;

/* The same field on the CPU, height only.
 *
 * The camera in this scene flies thirty-four units above the ground by the end
 * of the shot, and 'the ground' now has six hundred metres of relief in it, so
 * a camera at a fixed altitude flies through a mountain. It has to be told
 * where the surface is, and it has to be told by the same function the GPU
 * displaces by — a lookalike would put the camera confidently just under the
 * terrain. Mirrors volcAt().x exactly, term for term.
 */
function coneHAt(x, z, cx, cz, R, H, sd){
  const dx = x - cx, dz = z - cz;
  const r = Math.hypot(dx, dz), u = r/R;
  if (u > 1) return 0;
  const ang = Math.atan2(dz, dx);
  const a2 = ang + 0.14*(fbmCPU(u*1.4, sd*13.0) - 0.5);
  const ca = Math.cos(a2), sa = Math.sin(a2);
  const gn = fbmCPU(ca*2.35 + sd*37.0, sa*2.35 + sd*37.0);
  const gully = 1 - Math.abs(gn*2 - 1);
  const gn2 = fbmCPU(ca*5.60 + sd*71.0, sa*5.60 + sd*71.0);
  const fine = 1 - Math.abs(gn2*2 - 1);
  const ss = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a)/(b - a))); return k*k*(3 - 2*k); };
  const cap = H*Math.pow(1 - RIM, 1.55);
  let h = Math.min(H*Math.pow(1 - u, 1.55), cap);
  h -= ss(RIM, RIM*0.28, u)*H*BOWL;
  h -= gully*H*0.105*ss(0.04, 0.42, u)*(1 - u);
  h -= fine*H*0.038*ss(0.06, 0.50, u)*(1 - u);
  return h;
}

/* Where a cone's live flows are, evaluated on the CPU from the same fields the
 * shader draws them with.
 *
 * The smoke has to come out of the lava, not off a hash. A plume standing on
 * cold rock beside a glowing channel is the tell that the two were generated by
 * different code, and this world has exactly two bright things in it — nobody
 * will miss it. So this scans the cone's circumference, scores every angle by
 * the same `chan` the fragment shader computes, and hands back the best few,
 * kept apart so two plumes never stand in one gully.
 */
function ss3(a, b, t){ const k = Math.min(1, Math.max(0, (t - a)/(b - a))); return k*k*(3 - 2*k); }

function flowAngles(ci, want){
  const [, , , , sd] = CONES[ci];
  const scored = [];
  const u = 0.32;
  for (let k = 0; k < 128; k++){
    const ang = (k/128)*Math.PI*2;
    const a2 = ang + 0.14*(fbmCPU(u*1.4, sd*13.0) - 0.5);
    const ca = Math.cos(a2), sa = Math.sin(a2);
    const gn = fbmCPU(ca*2.35 + sd*37.0, sa*2.35 + sd*37.0);
    const gully = 1 - Math.abs(gn*2 - 1);
    const gn2 = fbmCPU(ca*5.60 + sd*71.0, sa*5.60 + sd*71.0);
    const fine = 1 - Math.abs(gn2*2 - 1);
    const act = ss3(0.40, 0.78, fbmCPU(ca*1.05 + sd*11.0, sa*1.05 + sd*11.0));
    scored.push({ ang, v: ss3(0.820, 0.996, gully)*act*(0.35 + 0.65*fine) });
  }
  scored.sort((a, b) => b.v - a.v);
  const out = [];
  for (const c of scored){
    if (out.length >= want) break;
    if (c.v < 0.02) break;
    /* Kept a third of a radian apart, so two plumes never stand in one gully. */
    if (out.every(o => Math.abs(((c.ang - o.ang + Math.PI*3) % (Math.PI*2)) - Math.PI) > 0.34)) out.push(c);
  }
  return out.map(c => c.ang);
}

/** The ground height at a world point. Exported because the scene's camera
    needs it every frame — see the note above. */
export function terrainHeightAt(x, z){
  let h = (fbmCPU(x*0.00035, z*0.00035) - 0.5)*40.0;
  const rid = 1 - Math.abs(fbmCPU(x*0.00115 + 5.0, z*0.00115 + 5.0)*2 - 1);
  h += rid*rid*26.0;
  h += (fbmCPU(x*0.0022 + 41.0, z*0.0022 + 41.0) - 0.5)*15.0;
  h += (fbmCPU(x*0.0062 + 17.0, z*0.0062 + 17.0) - 0.5)*8.0;
  for (const [cx, cz, R, H, sd] of CONES) h += coneHAt(x, z, cx, cz, R, H, sd);
  return h;
}

/* HOW CLOSE THE COARSE GROUND IS ALLOWED TO GET TO THE LENS.
 *
 * Inside this radius the ground is drawn by the detail mesh instead, at four
 * times the density, and the coarse one DISCARDS. Two surfaces occupying the
 * same place is z-fighting on a good day and the coarse one poking up through
 * the fine one in every trough on a bad one; a hole is the only version of
 * this with no failure mode. It sits comfortably inside the detail mesh's own
 * half-extent (1500) and comfortably outside the point where the detail has
 * already faded to nothing (1150), so the two meshes are computing the same
 * surface, term for term, everywhere they actually meet.
 */
const HOLE_R = 1250.0;

/* One material, two meshes — and the material is built by a FUNCTION rather
 * than written twice. The coarse ground and the near patch have to agree
 * about the surface to the last decimal or the join between them is a cut
 * across the middle of the frame, and two shader sources that are meant to
 * match are two shader sources that will not stay matched.
 *
 *   detail  1 on the near patch, 0 on the coarse ground. It gates the lava
 *           morphology, and it is a UNIFORM branch — coherent across the whole
 *           draw, so the coarse mesh never pays for a field it does not use.
 *   hole    discard radius, above.
 *   step    the mesh's OWN vertex spacing, used as the epsilon of the normal's
 *           finite difference. Sampling the field finer than the mesh
 *           reconstructs it gives the normal of a surface that is not the one
 *           being drawn, and the two disagree exactly where the field is
 *           steepest — which on a volcano is the whole interesting part. This
 *           was a hard 19.0 while there was only one mesh; the second mesh is
 *           what turns it into a property.
 *   bump    how much of the shading-only rock texture this mesh gets up close.
 *           The coarse ground has nothing else, so it keeps all of it; the
 *           patch has real geometry now and needs only enough to carry what is
 *           finer than its own lattice. Blended back to 1.0 across the same
 *           ramp the geometry fades on, so the handover is invisible.
 */
function groundMaterial({ detail = 0.0, hole = 0.0, step = 19.0, bump = 1.0, ring = 0.0, coarse = 1.0 }){
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uOffset: { value: new THREE.Vector2() },
      uCam:    { value: new THREE.Vector3() },
      uDetail: { value: detail },
      uStep:   { value: step },
      uHole:   { value: hole },
      uRing:   { value: ring },
      uCoarse: { value: coarse },
      uBump:   { value: bump },
      uTime:   { value: 0 },
      uHeat:   { value: 1 },
      /* Basalt, and basalt is very nearly black — a fresh flow reflects
         about five per cent of what falls on it. The pass before this used
         0.042 with a 2.4 gain on top and the mountains came back pale grey,
         which under an orange sky reads as snow. The whole contrast of this
         world is meant to be between rock that is almost invisible and rock
         that is molten; a legible mid-grey mountain destroys it. */
      uRock:   { value: new THREE.Color(0.022, 0.017, 0.017) },
      uHot:    { value: new THREE.Color(1.00, 0.34, 0.055) },
      uCore:   { value: new THREE.Color(1.00, 0.86, 0.52) },
      /* Lava a long way from the vent. Nothing on a flank is the colour of
         the vent itself — it darkens and reddens the whole way down, and a
         flow drawn in one colour reads as a painted stripe. */
      uEmber:  { value: new THREE.Color(0.62, 0.055, 0.012) },
      uFogDen: { value: 0.00012 },
      uFogFall:{ value: 0.0016 },
      /* Where the ground stops being ground and becomes haze. Inside the
         plane's own nearest edge at 6000, so the edge is never reachable by
         eye — the fix desert.js needed when new terrain was seen growing out
         of the horizon, and cheaper to put in now than to diagnose later. */
      uFadeA:  { value: 3400.0 },
      uFadeB:  { value: 5600.0 }
    },
    vertexShader: /* glsl */`
      ${NOISE}
      ${CRACK_GLSL}
      ${LAVA_GLSL}
      ${VOLC_GLSL}
      uniform vec2 uOffset;
      uniform vec3 uCam;
      uniform float uDetail, uStep, uRing, uCoarse;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vGate;

      /* THE surface. Both meshes call this and neither has its own version of
         it, which is the point of the whole refactor: the coarse mesh with
         uDetail = 0 and the patch outside its own fade ramp are then not
         approximations of each other, they are the same expression. */
      float surfH(vec2 w, vec2 local){
        float h = terrH(w) + lavaBig(w, LAVA_FRONT);
        if (uDetail > 0.5) h += detailGate(local)*lavaFine(w);
        return h;
      }

      void main(){
        vec2 local = position.xz;
        vec2 w = local + uOffset;
        /* The normal from finite differences of the same function that sets
           the height, at THIS MESH'S OWN spacing rather than at some small
           epsilon: sampling the field finer than the mesh reconstructs it
           gives a normal for a surface that is not the one being drawn, and
           the two disagree exactly where the field is steepest — which on a
           volcano is the whole interesting part. */
        float e = uStep;
        float h  = surfH(w, local);

        /* FORWARD differences, and they stay forward. Central ones are more
           correct — a forward difference gives a vertex the slope of the cell
           on ONE side of it, so the interpolated shading changes slope at
           every cell boundary, which is faceting aligned to the lattice — and
           they were tried here and then taken out again, which is worth
           recording rather than quietly reverting.

           Two reasons. They bought nothing measurable: on a block-matched
           motion-compensated residual over the volcanic plain the terrain went
           from 8.57 to 8.41, which is inside the noise of the instrument. And
           they cost a great deal. surfH() is the heaviest expression in the
           film — two domain warps, a lobe field and a ridge train, plus the
           fine layer on the near patch — and the two meshes together carry
           579,000 vertices. Central differences take the count per vertex from
           three evaluations to five: a 67% rise on the single most expensive
           shader here, which is enough to trip a driver's watchdog and take
           the tab with it. It did, on a real GPU, while SwiftShader had run it
           without complaint.

           A more correct normal is not worth a scene that does not render. */
        float hx = surfH(w + vec2(e, 0.0), local + vec2(e, 0.0));
        float hz = surfH(w + vec2(0.0, e), local + vec2(0.0, e));
        vN = normalize(cross(vec3(0.0, hz - h, e), vec3(e, hx - h, 0.0)));
        vGate = uDetail > 0.5 ? detailGate(local) : 0.0;
        vWorld = vec3(w.x, h, w.y);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(local.x, h, local.y, 1.0);
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${CRACK_GLSL}
      ${VOLC_GLSL}
      ${SKY_GLSL}
      ${HEIGHT_FOG}
      uniform vec3 uCam, uRock, uHot, uCore, uEmber;
      uniform float uTime, uHeat, uFogDen, uFogFall, uFadeA, uFadeB;
      uniform float uHole, uBump, uRing;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vGate;
      void main(){
        /* THE PIXEL FOOTPRINT, in world units, and it is computed HERE — the
           first thing in the shader, before either discard below.
           
           Screen-space derivatives are computed across a 2x2 quad of
           fragments, so they are only defined in control flow that is uniform
           across that quad. Taken after a discard, as this was in its first
           version, the quad may have lost a lane and the result is undefined
           by the specification — which in practice means one driver returns
           garbage, another returns NaN, and a third hangs and takes the tab
           with it. It did: this scene crashed the browser in dev while
           SwiftShader, which tolerates it, had rendered the same frame without
           complaint through every check. Nothing else moved; only the line.
           
           Distance was the proxy this shader used for the footprint, and a
           proxy is what it is: at a grazing angle the footprint of a near
           pixel is larger than that of a far one looked at square on, and this
           whole plain is seen at a grazing angle. */
        float fp = max(length(dFdx(vWorld.xz)), length(dFdy(vWorld.xz)));
        /* The hole. See HOLE_R: inside it this mesh is not the one drawing the
           ground, and a fragment it kept here would be a coarse triangle
           fighting a fine one for the same pixel. */
        float rCam = length(vWorld.xz - uCam.xz);
        if (uHole > 0.0 && rCam < uHole) discard;
        /* And the OUTER limit, which the near patch needs and the coarse plane
           does not. Without it the patch kept drawing all the way to its own
           square rim — 1500 units on the axes and 2121 in the corners — over a
           coarse plane that stops discarding at 1250. The note that used to sit
           here said the overlap was 'a hundred units of two meshes evaluating
           one identical, detail-free expression, which is the only kind of seam
           that cannot show'. Both halves of that were wrong.

           It is not a hundred units: the patch is a SQUARE and the hole is a
           CIRCLE, so the band runs from 100 units on the axes to 871 in the
           corners. And one identical expression evaluated by two meshes is not
           one surface. A 19-unit lattice and a 6.8-unit lattice reconstruct the
           same field differently between their vertices — that difference is
           the whole reason the near patch exists — so the two surfaces are
           metres apart on a cone flank and microns apart on the plain, and
           where they are close they z-fight. Worse, each is snapped to its own
           lattice, so the fight's pattern re-rolls every time either one steps.

           Measured: a cubic detrend over fifteen frames of the volcanic plain
           left a residual that is a PICTURE OF THE TRIANGULATION — the mesh's
           own grid, flickering, over the whole lower two thirds of the frame.
           'Värinää tulivuorien pinnalla ja vieressä.'

           So the two tile instead of overlapping. The band that is left is
           forty units wide and the patch wins it outright by depth offset, so
           no pixel in the film is ever contested. */
        if (uRing > 0.0 && rCam > uRing) discard;
        /* Re-evaluated per pixel rather than interpolated from the vertices.
           A lava channel's edge is the sharpest thing in this world and a
           19-unit lattice would give it stairs. */
        /* Rock texture as a normal perturbation rather than as geometry.
           The mesh's 19-unit lattice is what it is — raising it to catch
           metre-scale relief would cost four times the vertices for detail
           that never reaches the silhouette — but the SHADING can carry
           relief the mesh cannot, and under a key this low a little bump is
           the difference between rock and moulded plastic.

           Two things about it, both learned the hard way in one render. It is
           ONE octave at a 38-unit wavelength, not two: the second, at 13
           units, was finer than a pixel at any distance past the foreground,
           so it aliased into a crawling speckle across the whole plain — and
           it was also, at thirteen metres, the first thing in this world with
           a size a person could name, which the brief forbids outright. And
           it FADES OUT with distance: a bump amplitude that does not fall off
           keeps adding detail to terrain that is subtending less and less of
           the screen, which is the definition of aliasing. Past nine hundred
           units the rock is smooth, and at that range nothing but the
           silhouette was ever visible anyway. */
        float bDist = length(vWorld.xz - uCam.xz);
        /* Faded out against the REAL relief as well as against distance:
           where the detail mesh is carrying actual geometry at this scale, a
           normal perturbation at the same scale is the same bump drawn twice.
           mix() rather than a switch, on the same ramp the geometry fades on,
           so nothing about the handover has an edge. */
        /* And the bump fades on the FOOTPRINT rather than on the distance. Its
           own wavelength is 38 units; once a pixel covers a third of that the
           perturbation is noise, which is the definition of aliasing and was
           the reason the second octave was taken out of it. The distance ramp
           is kept underneath as a floor, because it also encodes a look
           decision — past nine hundred units this rock is meant to be smooth. */
        float bAmt = 15.0*mix(1.0, uBump, vGate)
                   *(1.0 - smoothstep(400.0, 2400.0, bDist))
                   *(1.0 - smoothstep(3.0, 13.0, fp));
        float bE = 9.0;
        float b0 = fbm(vWorld.xz*0.026 + 61.0);
        float bx = fbm((vWorld.xz + vec2(bE, 0.0))*0.026 + 61.0);
        float bz = fbm((vWorld.xz + vec2(0.0, bE))*0.026 + 61.0);
        vec3 vNb = normalize(vN + vec3(-(bx - b0), 0.0, -(bz - b0))*(bAmt/bE));

        vec4 f = volcAt(vWorld.xz);
        float lava = f.y, crater = f.z, u = f.w;
        /* How much of a flank this pixel is on, which is what decides whether
           it belongs to the cracked plain or to a mountain. */
        float flank;
        /* Only the real flanks, not the swell at their feet. At 60 units the
           mask was cutting the fissure field off across most of the plain
           between the cones, which is where the second shot spends its whole
           run — a foreground with nothing in it. */
        flank = smoothstep(150.0, 430.0, f.x);

        /* The plain's cracks, faded out on the flanks — a plate field is
           what a cooled lava LAKE does, and the side of a mountain is not
           one. */
        /* The seams sit in the TROUGHS of the plain's own relief, not across
           it. Painted on regardless of the surface they were burning through,
           the crack network read as a decal over smooth ground; masked by the
           same ridged octave that shapes the plain, it reads as light coming
           out of the low places, which is where a fissure is. One extra fbm,
           and it is the same one volcAt() already uses so the two agree. */
        float ridF = 1.0 - abs(fbm(vWorld.xz*0.00115 + 5.0)*2.0 - 1.0);
        float trough = smoothstep(0.62, 0.12, ridF);
        float g = crackGlow(vWorld.xz, fp)*(1.0 - flank)*(0.18 + 0.82*trough);
        /* Clamped before it is cubed, and that is not tidiness. crackGlow
           returns up to 1.6 where a river crosses a live region, and 1.6 cubed
           is 4.1 — so the seams nearest the camera were multiplied by four and
           the foreground of the second shot blew out to a white sheet. The
           seam's own depth is a fraction, not a gain. */
        float gc = clamp(g, 0.0, 1.0);
        float core = gc*gc*gc;
        float breath = 0.82 + 0.18*fbm(vWorld.xz*0.0009 + uTime*0.035);

        /* The crust on the flows, drifting DOWNHILL: the first axis of this
           noise is the radial coordinate of the flow the pixel is in, so
           subtracting time from it moves the pattern away from the crater. It
           is the only thing in this world that moves without being a particle,
           and it moves light rather than geometry — the surface itself is a
           pure function of position, full stop. */
        /* The crust, and this is the only motion in the whole surface.
           Two bands rather than one: a fine plate pattern drifting fast and a
           long swell moving under it at a third the speed, which is what a
           river of anything looks like — surface detail travelling faster than
           the body it is on. The first axis of both is the flow's own radial
           coordinate, so subtracting time moves them AWAY from the crater and
           nowhere else.

           And the contrast is much higher than the first pass's 0.45..1.30.
           Lava that merely brightens and dims by a third reads as a lit stripe
           with a flicker on it; what makes it read as moving is dark crust
           actually passing over bright melt, which needs the dark to get
           genuinely dark. */
        float crust = fbm(vec2(u*74.0 - uTime*1.55, (vWorld.x + vWorld.z)*0.0075))
                    *0.62
                    + fbm(vec2(u*21.0 - uTime*0.48, (vWorld.x - vWorld.z)*0.0021))*0.38;
        float flow = lava*(0.10 + 1.75*crust*crust);
        /* The crater. A lake, not a channel: bright, flat and the brightest
           thing in the frame. */
        float lake = crater*(0.70 + 0.30*fbm(vWorld.xz*0.004 + uTime*0.10));

        /* Lit from ABOVE, faintly, and that is not a cheat. There is no sun in
           this world but there is a ceiling of ash across the whole sky with a
           continent of glowing ground under it, and a lit ceiling is a large
           dim source. Without it a volcano is a black card: the whole shape of
           the mountain lives in how its flanks turn away from that light. */
        /* The key comes from the HORIZON, not from overhead, and this is the
           single change that made the terrain read as rock.
 
           There is no sun here, so the first version lit everything from a
           broad source straight up — defensible as physics (a lit ash ceiling
           is exactly that) and ruinous as picture. A landscape lit from
           directly above has no form: every upward-facing surface takes the
           same light whatever its slope, so a mountain and a plain shade
           identically and the whole field reads as smooth. Relief is visible
           only when the light is LOW, which is why terrain is photographed at
           dawn.
 
           And the honest source is low anyway. The brightest thing in this
           world's sky is the band just above the horizon where a continent of
           molten ground is scattering its own light back down through the
           ash — a huge, low, warm source. Aiming the key at it is both more
           physical than the ceiling and the reason every gully now has a lit
           side and a dark one. */
        float key = 0.06 + 0.94*max(0.0, dot(vNb, normalize(vec3(0.74, 0.21, -0.64))));
        /* Ash settles on what faces up and blows off what is steep, so the
           rock is not one colour: pale grey where the ceiling has been
           dusting it and black basalt on the faces. This is the only surface
           variation in the world and it is deliberately keyed to SLOPE rather
           than to a texture — a texture would have a grain, and a grain is a
           size. */
        float dust = smoothstep(0.55, 0.95, vNb.y)*(0.55 + 0.45*fbm(vWorld.xz*0.0016 + 3.0));
        /* Gained up so the lit faces have somewhere to go. The relief in this
           terrain is real — the gullies cut tens of metres — and was invisible
           for two rounds because the rock was dark, the key was weak and a
           fill term from above was lifting the shadows on top of that. A
           surface only shows its shape through the RATIO between its lit and
           unlit faces; raising the floor destroys that ratio faster than
           raising the amplitude of the terrain restores it. */
        vec3 col = mix(uRock, vec3(0.046, 0.045, 0.050), dust)*key*3.30;
        /* And lit from below by what it is carrying. */
        col += uHot*0.30*(lava + lake*0.8)*max(0.0, 1.0 - vNb.y);

        /* And much dimmer than they were. uHot*0.80 plus uCore*1.20 sums past
           two in the red channel before the grade has even seen it, so every
           seam within a few hundred units of the lens clipped — the near
           foreground of the second shot was a white sheet through three
           rounds of this. Molten rock is the brightest thing in the world and
           still has to fit inside the frame. */
        col += uHot*g*0.42*breath
             + uCore*core*0.50*breath;
        /* Orange along the flow and white only at the vent. uCore is raised
           to a high power so it appears only where lava is at its hottest —
           the first pass had it on the whole channel and every river came out
           a pale spidery line rather than a red one with a white head. */
        vec3 flowCol = mix(uHot, uEmber, smoothstep(0.10, 0.62, u));
        col += flowCol*flow*2.40 + uCore*pow(lava, 5.0)*2.60*crust;
        /* The lake, with its own crust on it — a bare disc of light reads as
           a lamp buried in the mountain. */
        /* Crust on the lake, and enough contrast in it to read as crust. A
           lake drawn as one bright disc is a lamp buried in the mountain,
           which is what the first two passes looked like from any distance.
           Two octaves, the finer one drifting, so the surface has plates on
           it that are visibly moving. */
        float lakeCrust = 0.22 + 0.78*fbm(vWorld.xz*0.045 + uTime*0.09)
                                     *(0.45 + 0.55*fbm(vWorld.xz*0.011 + 5.0));
        col += uHot*lake*1.90*lakeCrust + uCore*pow(lake, 3.0)*1.50*lakeCrust;
        /* Ash lying on the plates and on the shallow flanks, which is what
           keeps the unlit rock from being a flat black card. */
        col += vec3(0.011, 0.0095, 0.0095)*fbm(vWorld.xz*0.02)*(1.0 - g)*max(0.0, vNb.y);

        float fog = heightFog(uCam, vWorld, uFogDen, uFogFall, 0.0);
        vec3 hazeCol = mix(vec3(0.013, 0.008, 0.009), uHot*0.14, 0.30 + 0.30*uHeat);
        col = mix(col, hazeCol, clamp(fog, 0.0, 1.0));
        /* And into THE SKY completely before the plane's own edge — not into
           a fixed haze colour, which is a different colour from the sky just
           above it and draws a hard band along the whole horizon. Measured
           from the camera on the ground plane, so the snap's whole-cell jumps
           never show. */
        float dHoriz = length(vWorld.xz - uCam.xz);
        vec3 skyCol = volcSky(normalize(vWorld - uCam), uHeat, uTime, uHot);
        col = mix(col, skyCol, smoothstep(uFadeA, uFadeB, dHoriz));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  return mat;
}

/* The ground: twelve thousand units across at 620 segments — a 19-unit
 * lattice. The reach is set by the far cones (the furthest sits 4600 out and
 * has to be inside the plane from anywhere on the path) and the density by the
 * near ones: at 19 units a 760-radius cone is forty samples from rim to base,
 * which is ample for a shape whose whole profile is one smooth curve. The fine
 * octave in volcAt() is deliberately far coarser than this spacing; a field
 * that varies faster than the mesh sampling it renders as a per-triangle
 * checkerboard, which this project has now diagnosed three times.
 *
 * What it CANNOT do is the last hundred units in front of the lens, and that
 * is not a tuning problem: nineteen units at ninety-five units of altitude is
 * a handful of triangles across the whole foreground, and no height field
 * sampled that coarsely has a silhouette. Raising the whole plane to catch it
 * would be four times the vertices, almost all of them spent on terrain five
 * kilometres away that is subtending a pixel. So it does not try — it leaves a
 * hole and lets buildDetail() do it.
 */
/* BACK TO THE LAST CONFIGURATION KNOWN TO WORK, and the note below is kept as
   the record of a wrong turn rather than deleted.
 
   The user identified the last fully working commit by its message. At that
   commit this file had 420 and 340 segments and LAVA_FRONT 85, and S7 ran in
   the preview and rendered. Everything after it that touched this file — a
   seam geomorph, then a second halving of the mesh — was aimed at a crash that
   the evidence now says those numbers never caused. So they go back exactly.
 
   Which also retires the reasoning below. It is TRUE that this scene's cost is
   vertex-bound and does not fall with resolution; that measurement stands. It
   is FALSE that the vertex count was what broke it, because the count was
   larger at the commit that worked. Cutting it further was treating a symptom
   that was not there, and it cost picture quality for nothing.
 
   What is left to explain is a narrower and more answerable question: what
   changed AFTER that commit, in this file, that a GPU cannot survive. The
   geomorph is the only candidate that touched a shader, and it is already out.
 
   The retired note: */
/* THE VERTEX BUDGET, and this is the number that decides whether this scene
   runs at all.
 
   The cost of S7 is in the VERTEX stage, and the proof is that it does not
   change with resolution: one frame at 2560x1440 and one at 320x180 — a
   sixty-fourth of the pixels — take the same time. Two rounds were spent
   lowering the resolution and looking for a fragment-side fault, and neither
   could ever have shown anything, because 292,000 vertices each evaluating
   surfH() three times is the same work whatever the frame is.
 
   That is also why the scene died the way it did: a single still renders fine
   because one slow frame is acceptable, and a sequence does not, because every
   frame costs the same and there are hundreds. On a real GPU one draw of that
   size can outrun the driver's watchdog outright, which is the crash.
 
   300 and 240: 90,000 + 58,000 = 148,000 vertices, down from 579,000 when this
   file's lava geometry was rebuilt and 292,000 after the first cut. The coarse
   plane draws only beyond 1250 units, where its 38-unit lattice subtends about
   44 pixels at 1440 lines; the near patch's 12.5 units is still three samples
   across lavaFine's own 30-unit fronts. LAVA_FRONT rises with the lattice, as
   it always must — it exists to keep a step wider than the mesh can sample. */
const COARSE_SIZE = 11400, COARSE_SEG = 420;
const COARSE_STEP = COARSE_SIZE/COARSE_SEG;

function buildTerrain(){
  /* 11400 and 420, down from 12000 and 620, and both numbers are measured.
   *
   * This scene costs about ten seconds a frame in the software renderer where
   * the next most expensive costs one, and muting layers puts half of that on
   * THIS MESH. 620 squared is 385,000 vertices each evaluating surfH() three
   * times, and surfH() is the heaviest expression in the film. That is why the
   * scene stopped running in the live preview: not a bug, just a bill, and one
   * this file ran up itself when the lava morphology was rebuilt.
   *
   * SIZE first, because it is free. The height fog takes this ground to haze
   * between 3400 and 5600 units, so nothing beyond 5600 is ever visible; a
   * plane of 12000 reaches 8485 into its corners. 11400 puts its inscribed
   * circle at 5700, just past the fade, and every direction still has ground
   * out to where it stops being visible.
   *
   * SEG second, and this one is a judgement. 420 segments over 11400 is a
   * 27.1-unit lattice where it was 19.4. This mesh only ever draws beyond 1250
   * units — the near patch has everything inside that — and the finest thing
   * it carries is the ridge train at 120 units between crests, which still
   * gets four and a half samples per wavelength. LAVA_FRONT goes up with it,
   * for the reason it exists at all. */
  const SIZE = COARSE_SIZE, SEG = COARSE_SEG;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI/2);
  const m = new THREE.Mesh(geo, groundMaterial({ detail: 0.0, hole: HOLE_R,
                                                 step: SIZE/SEG, bump: 1.0 }));
  m.frustumCulled = false;
  m.userData.step = SIZE/SEG;
  return m;
}

/* And the near ground, which is the half of the answer the coarse mesh cannot
 * give.
 *
 * Three thousand units across at 440 segments — a 6.8-unit lattice, an
 * eighth of the coarse one's cell area, for a fifth of its vertices, because
 * it only ever covers the ground you are actually close to. It rides under
 * the camera SNAPPED to its own lattice, for exactly the reason desert.js
 * records at length: a mesh that follows the camera continuously slides its
 * sample points across the height field and the whole surface crawls. Its
 * step is its own, not the coarse mesh's, so its normals are the normals of
 * the surface it is really drawing.
 *
 * The two never fight over a pixel. The coarse mesh discards inside HOLE_R
 * (1250); this one reaches 1500 in the axis directions even at the worst
 * phase of its own snap; and the lava morphology it carries is already back
 * to zero by 1150. So the overlap band is a hundred units of two meshes
 * evaluating one identical, detail-free expression, which is the only kind of
 * seam that cannot show.
 */
function buildDetail(){
  /* 340 rather than 440: an 8.8-unit lattice where it was 6.8, and 116,000
     vertices where it was 194,000. The finest thing this mesh carries is
     lavaFine()'s toes — 110 units across with a 30-unit front — which is still
     three and a half samples across the front and twelve across the lobe. */
  const SIZE = 3000, SEG = 340;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI/2);
  const mat = groundMaterial({ detail: 1.0, hole: 0.0, step: SIZE/SEG,
                               bump: 0.30, ring: HOLE_R, coarse: COARSE_STEP });
  /* EXACTLY the coarse plane's hole radius, with no band between them.
     
     The first version left forty units of deliberate overlap and gave the
     patch a depth offset to win it, on the argument that a shared edge with no
     overlap would leave a one-pixel crack wherever the two reconstructions of
     the surface disagree about which side of 1250 a pixel is on. The argument
     was right about the crack and wrong about the cure: a depth offset wins by
     a fixed bias, and on a cone flank two lattices 19.4 and 8.8 units apart
     reconstruct the surface metres apart, which is far more than any bias.
     What that band actually was is a ring of contested pixels at a fixed
     distance from the camera, sweeping across the mountainside as the camera
     moves — 'siellä on jotain päällekkäistä joka oireilee näin', and it looks
     like a vein flickering on the slope.
     
     At equal radii the two tests are complementary: the coarse plane draws
     where rCam >= 1250 and this one where rCam <= 1250, so no pixel is ever
     contested except the single row where the two meshes' own interpolated
     world positions disagree about the boundary itself. The depth offset stays
     to settle that row. */
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.step = SIZE/SEG;
  return m;
}

/* One column per crater, two more standing on each cone's live flows, and a
 * scattering of fumaroles on the plain. Built as a table first so the count is
 * whatever the terrain turns out to have rather than a number kept in sync by
 * hand — which is how the old ring of 26 ended up bearing no relation to where
 * anything in this world actually was.
 */
/* Twenty-two rather than sixteen. A column is only a column if its puffs
   overlap; below that they read as a string of beads climbing out of the
   crater, which is exactly what sixteen narrow ones looked like once the base
   was pulled in to the vent. */
const PUFFS = 22;
const PLAIN_PLUMES = 4;

function columnSites(){
  const out = [];
  for (let i = 0; i < CONES.length; i++){
    const [cx, cz] = CONES[i];
    /* The vent, and NARROW at the bottom.
     *
     * A plume's base width is what says where it is coming from, and at 210
     * units the first puff was twice the width of the crater it was supposed
     * to be leaving — so the smoke read as rising off the whole summit rather
     * than out of the vent, which is the note: 'kohdistettua savut tulemaan
     * tulivuorten kärjistä'. Fifty is inside the crater at every cone in the
     * table. It still widens by four and a half times on the way up, which is
     * what a plume does; it just starts somewhere.
     *
     * The flank plumes are gone. They stood where the lava was, which was
     * defensible, but at a distance a second column halfway up a mountain
     * reads as a second summit — and this scene has one instruction about
     * scale and that is it. */
    out.push({ x: cx, z: cz, w0: 88 + hash(i, 3)*34, top: 4200 });
  }
  /* Fumaroles off the fissure field, placed on a ring around the path rather
     than a disc, because columns behind the camera are never seen. */
  for (let c = 0; c < PLAIN_PLUMES; c++){
    const ang = hash(c, 1)*Math.PI*2;
    const dist = 1400 + hash(c, 2)*3000;
    out.push({ x: Math.sin(ang)*dist, z: -Math.cos(ang)*dist,
               w0: 80 + hash(c, 3)*60, top: 2000 });
  }
  return out;
}

function buildColumns(){
  /* Smoke columns as stacks of camera-facing billboards, each larger and
     fainter than the one above the last, so a column widens and dissolves as
     it climbs — which is what a plume does and is also why it never shows a
     top: the last puff is too faint to have an edge.

     And the puffs RISE. This is a real bug fixed, not a refinement, and it is
     the same one the rivers in islands.js had: every puff's position was
     composed into its instance matrix once, in this function, and never
     touched again. uTime reached the smoke at exactly one place — a scroll of
     0.06 across a noise field sampled at 3.2 cycles per puff, which is two
     hundredths of a puff-width per second. The column was a photograph. On a
     shot that ORBITS the thing, camera parallax is enough to hide that in a
     still and not nearly enough to hide it in motion: the plume slides past
     the lens as a rigid object, which is why it read as a chimney rather than
     as smoke.

     Fixed the way buildEmbers() has always done it, which is why that one has
     never had this class of bug: the instance matrix is IDENTITY and carries
     nothing, and the puff's whole state is a closed form of (attributes,
     uTime) evaluated in the vertex shader. age = fract(phase + t/life), so
     nothing integrates and any frame still stands alone.

     Because the phases are spread evenly (i/PUFFS) and every puff of a column
     shares one life, the set of ages present at any instant is the same grid
     it always was, merely shifted — so the column's SHAPE is unchanged from
     the version that was approved. Only the smoke inside it moves. */
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      /* One wind for the world. Every column bending the same way is what
         makes three plumes read as weather over one landscape instead of
         three factory chimneys that happen to share a horizon — the old lean
         was a per-column random, which is the opposite reading. */
      uWind: { value: new THREE.Vector2(0.80, -0.60).normalize() },
      uGlow: { value: new THREE.Color(1.00, 0.30, 0.06) }
    },
    vertexShader: /* glsl */`
      attribute vec3 aSite;   // vent x, ground y at the vent, vent z
      attribute vec4 aPar;    // base width, column height, life, phase
      attribute vec2 aSeed;   // per-puff, per-column
      uniform float uTime;
      uniform vec2 uWind;
      varying vec2 vUv;
      varying float vSeed;
      varying float vRise;
      void main(){
        vUv = uv; vSeed = aSeed.x;

        float age = fract(aPar.w + uTime/aPar.z);
        vRise = age;

        /* Height above the vent, on the square: the puffs are packed into the
           first few hundred units and stretch out as they climb, which is
           what makes a column read as coming from ONE point. Read as motion
           rather than as spacing it is also an acceleration, which is what a
           buoyant column does over the height it is still gaining heat. */
        float h = 40.0 + age*age*aPar.y;
        /* And it opens out hard. Narrow at the vent and enormous a kilometre
           up — that ratio IS the read. */
        float w = aPar.x*(1.0 + pow(age, 1.10)*13.0);
        float f = h/aPar.y;

        /* Shear, superlinear in height, so the column BENDS rather than
           leaning: a straight tilted line is a pipe someone installed at an
           angle. Scaled by the column's own height so a fumarole and a
           four-kilometre eruption column bend by the same angle. */
        vec2 off = uWind*aPar.y*0.34*(0.75 + 0.5*aSeed.y)*pow(f, 1.55);

        /* The column's own slow writhe — a SHAPE, a function of height and of
           the column's seed, that the puffs travel through. Carried per puff
           instead, it would be each puff wobbling on the spot, which is a
           bag of moving blobs and not a plume. Width-scaled, so the bottom
           sits on its vent and only the wide upper part wanders. */
        float cs = aSeed.y*37.0;
        off += vec2(sin(f*5.1 + cs + uTime*0.13),
                    sin(f*3.7 + cs*1.7 + uTime*0.10))*w*0.30;
        /* A little per-puff scatter so the stream is not a line of beads. */
        off += (vec2(fract(aSeed.x*97.0), fract(aSeed.x*53.0)) - 0.5)*w*0.22;

        vec3 p = vec3(aSite.x + off.x, aSite.y + h, aSite.z + off.y);

        /* Camera-facing, built in VIEW SPACE — and this too is a real bug
           fixed, not a refinement.

           These puffs were once drawn by transforming the plane's own
           vertices through the instance matrix, and that matrix was composed
           with an identity rotation and never touched again. So every puff in
           every column was a flat quad lying in the world XY plane, facing
           world +z, for the whole film. It looked correct for as long as the
           camera in this scene only ever looked down -z; the moment the first
           shot became an orbit, the columns were seen from the side and a
           plume rendered as a flat card standing edge-on to the viewer.
           'Ekan tulivuoren savu on kaksiulotteinen' — it literally was.

           Building the quad in view space is the fix: take the puff's CENTRE
           through the view matrix, then offset in x and y of the VIEW frame,
           so the quad is square to the lens from wherever the lens happens to
           be. No per-instance billboard matrix, nothing to update per frame,
           nothing that can go stale. */
        vec4 mv = viewMatrix*vec4(p, 1.0);
        mv.xy += position.xy*w;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      uniform float uTime;
      uniform vec3 uGlow;
      varying vec2 vUv;
      varying float vSeed;
      varying float vRise;
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p)*2.0;
        /* A soft blob with noise eaten out of its edge — a hard-edged puff
           reads as a sphere, and a stack of spheres reads as a caterpillar. */
        float n = fbm(p*3.2 + vec2(vSeed*17.0, uTime*0.12 + vSeed*5.0));
        float a = smoothstep(1.0, 0.15, r + (n - 0.5)*0.85);
        /* Dense at the vent and dissolving to NOTHING at the top. It used to
           end at a third of its opening density, which was invisible while
           the puffs were nailed down and would be a pop now that they recycle
           — a wide faint puff vanishing at the ceiling and reappearing at the
           crater. The exponent is chosen so the curve is within a percent of
           the approved one for the first three quarters of the climb and only
           then goes to zero. */
        a *= 0.46*pow(max(0.0, 1.0 - vRise), 0.45);
        /* And a fast fade in at the vent, over a twentieth of the life —
           which at this height profile is the first ten units above the
           crater, so the smoke still starts AT the summit. */
        a *= smoothstep(0.0, 0.05, vRise);
        if (a < 0.004) discard;
        /* Lit from below and only from below: the ground glow is the only
           light in this world, so the underside of a plume is the only part
           of it with any colour. */
        vec3 col = mix(vec3(0.040, 0.036, 0.038), uGlow*0.55,
                       (1.0 - vRise)*(1.0 - vRise)*0.85*smoothstep(0.7, 0.0, vUv.y));
        gl_FragColor = vec4(col, a);
      }`
  });
  const sites = columnSites();
  const n = sites.length*PUFFS;
  const m = new THREE.InstancedMesh(geo, mat, n);
  const site = new Float32Array(n*3), par = new Float32Array(n*4);
  const seeds = new Float32Array(n*2);
  const mm = new THREE.Matrix4();
  let k = 0;
  for (let c = 0; c < sites.length; c++){
    const s = sites[c];
    /* Standing ON the ground, at whatever height the field puts it — a plume
       whose base is at y = 0 hangs in the air over a mountain. */
    const base = terrainHeightAt(s.x, s.z);
    /* One life per column, so the puffs of a column stay evenly spread and
       the column keeps its density; different between columns, so the world
       never comes back round to a pose it has already held. Fourteen seconds
       for four kilometres is a hundred and sixty units a second at mid-column
       — fast enough to be unmistakably moving at this focal length, slow
       enough that a puff is not a streak. */
    const life = 14 + hash(c, 8)*5;
    const cs = hash(c, 5);
    for (let i = 0; i < PUFFS; i++){
      site[k*3] = s.x; site[k*3 + 1] = base; site[k*3 + 2] = s.z;
      par[k*4] = s.w0; par[k*4 + 1] = s.top; par[k*4 + 2] = life;
      par[k*4 + 3] = i/PUFFS;
      seeds[k*2] = hash(k, 7); seeds[k*2 + 1] = cs;
      /* Identity: this mesh does its own placement in the vertex shader, so
         setMatrixAt would be a second source of truth for the same thing —
         and a second source of truth for a puff's position is precisely how
         the smoke came to be frozen. Set once so the attribute exists. */
      m.setMatrixAt(k, mm.identity());
      k++;
    }
  }
  m.instanceMatrix.needsUpdate = true;
  m.geometry.setAttribute('aSite', new THREE.InstancedBufferAttribute(site, 3));
  m.geometry.setAttribute('aPar',  new THREE.InstancedBufferAttribute(par, 4));
  m.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 2));
  m.frustumCulled = false;
  return m;
}

const N_EMBERS = 900;

function buildEmbers(){
  /* The only fast thing in the world, and the only thing that passes the
     camera. Position is a closed form of (index, time): each ember has a
     lifetime and a birth phase from its hash, its age is fract() of the clock
     against that, and its height is a function of that age. Nothing
     integrates, so any frame stands alone. */
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCam:  { value: new THREE.Vector3() },
      uHot:  { value: new THREE.Color(1.00, 0.42, 0.10) },
      uSize: { value: 1 }
    },
    vertexShader: /* glsl */`
      attribute vec3 aBase;      // where this ember starts, relative to the camera
      attribute vec3 aDrift;     // metres per second, x/y/z
      attribute float aSeed;
      uniform float uTime;
      uniform vec3 uCam;
      uniform float uSize;
      varying float vAge;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        float life = 3.2 + aSeed*3.4;
        /* Age as a pure function of the clock. fract() rather than a counter
           is the whole reason this is renderable out of order. */
        float age = fract(uTime/life + aSeed);
        vAge = age;
        vec3 p = aBase + aDrift*(age*life);
        /* Wrapped around the camera so the field follows without ever being
           seen to. */
        p.x = mod(p.x - uCam.x + 900.0, 1800.0) - 900.0 + uCam.x;
        p.z = mod(p.z - uCam.z + 900.0, 1800.0) - 900.0 + uCam.z;
        float sz = uSize*(1.6 + aSeed*2.6)*(1.0 - age*0.45);
        /* Camera-facing by construction: the quad is built in view space, so
           no per-instance billboard matrix is needed and none can go stale. */
        vec4 mv = viewMatrix*vec4(p, 1.0);
        mv.xy += (uv - 0.5)*sz;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      uniform vec3 uHot;
      varying float vAge;
      varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5)*2.0;
        float a = smoothstep(1.0, 0.0, r);
        a *= a;
        /* Born bright, dies out. The fade is on age rather than on height so
           an ember that drifts sideways still cools. */
        float lifeCol = 1.0 - vAge;
        a *= smoothstep(0.0, 0.08, vAge)*lifeCol;
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(uHot*0.6, vec3(1.0, 0.86, 0.55), lifeCol*lifeCol)*a, a);
      }`
  });
  const m = new THREE.InstancedMesh(geo, mat, N_EMBERS);
  const base = new Float32Array(N_EMBERS*3);
  const drift = new Float32Array(N_EMBERS*3);
  const seeds = new Float32Array(N_EMBERS);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < N_EMBERS; i++){
    base[i*3]     = (hash(i, 1) - 0.5)*1800;
    base[i*3 + 1] = hash(i, 2)*40;
    base[i*3 + 2] = (hash(i, 3) - 0.5)*1800;
    drift[i*3]     = (hash(i, 4) - 0.5)*26;
    drift[i*3 + 1] = 34 + hash(i, 5)*70;
    drift[i*3 + 2] = (hash(i, 6) - 0.5)*26;
    seeds[i] = hash(i, 7);
    /* The instance matrix is identity: this mesh does its own placement in
       the vertex shader (see aBase/aDrift), so setMatrixAt would be a second
       source of truth for the same thing. Set once so the attribute exists. */
    m.setMatrixAt(i, mm.identity());
  }
  m.instanceMatrix.needsUpdate = true;
  m.geometry.setAttribute('aBase',  new THREE.InstancedBufferAttribute(base, 3));
  m.geometry.setAttribute('aDrift', new THREE.InstancedBufferAttribute(drift, 3));
  m.geometry.setAttribute('aSeed',  new THREE.InstancedBufferAttribute(seeds, 1));
  m.frustumCulled = false;
  return m;
}


/* The volcanoes themselves — raised, which the first pass simply did not have.
 * That version was a flat plain with light in its cracks, and the brief's own
 * reference is a landscape with CONES standing out of it: a vent above the
 * surface, a summit that glows, and lava running down the flanks from it. A
 * plain cannot do that at any brightness, because what makes a volcano read as
 * a volcano is its silhouette against the sky.
 *
 * Built on the CPU with the normals computed from the result, for the same
 * reason islands.js does it: displacement in a vertex shader and normals from
 * the undisplaced mesh do not agree, and here the whole point is a profile.
 */
function buildSky(){
  const geo = new THREE.SphereGeometry(6400, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHeat: { value: 1 },
      uHot:  { value: new THREE.Color(1.00, 0.30, 0.06) }
    },
    vertexShader: `varying vec3 vD;
      void main(){ vD = normalize(position);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${SKY_GLSL}
      uniform float uTime, uHeat;
      uniform vec3 uHot;
      varying vec3 vD;
      void main(){
        gl_FragColor = vec4(volcSky(normalize(vD), uHeat, uTime, uHot), 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

export class Volcanic {
  constructor(){
    this.sky     = buildSky();
    this.ground  = buildTerrain();
    this.detail  = buildDetail();
    this.columns = buildColumns();
    this.embers  = buildEmbers();
    this.group = new THREE.Group();
    this.group.add(this.sky, this.ground, this.detail, this.columns, this.embers);
  }

  update(t, { camera, heat = 1, emberSize = 1 }){
    /* The sky rides with the camera; the ground is SNAPPED to its own vertex
       lattice, for exactly the reason desert.js records at length — a mesh
       that follows the camera continuously slides its sample points across
       the height field and the whole plain ripples. Same fix, same one line,
       and it is cheap insurance even on a surface this flat. */
    this.sky.position.copy(camera.position);
    /* Both ground meshes, each snapped to ITS OWN lattice — the coarse one to
       nineteen units and the near one to six point eight. Snapping the second
       to the first's step would leave its own sample points sliding within
       every coarse cell, which is the crawl this whole pattern exists to
       prevent, and snapping both to the finer one would let the coarse mesh
       move in steps its own vertices cannot see. */
    for (const m of [this.ground, this.detail]){
      const step = m.userData.step;
      const sx = Math.round(camera.position.x/step)*step;
      const sz = Math.round(camera.position.z/step)*step;
      m.position.set(sx, 0, sz);
      const u = m.material.uniforms;
      u.uOffset.value.set(sx, sz);
      u.uCam.value.copy(camera.position);
      u.uTime.value = t;
      u.uHeat.value = heat;
    }

    this.sky.material.uniforms.uTime.value = t;
    this.sky.material.uniforms.uHeat.value = heat;
    this.columns.material.uniforms.uTime.value = t;
    const eu = this.embers.material.uniforms;
    eu.uTime.value = t;
    eu.uCam.value.copy(camera.position);
    eu.uSize.value = emberSize;
  }

  debugLayers(){
    return { sky: this.sky, ground: this.ground, detail: this.detail,
             columns: this.columns, embers: this.embers };
  }

  dispose(){
    for (const m of [this.sky, this.ground, this.detail, this.columns, this.embers]){
      m.geometry.dispose(); m.material.dispose();
    }
  }
}
