import * as THREE from 'three';
import { NOISE, HEIGHT_FOG } from '../core/glsl.js';
import { fbm } from '../core/noise-cpu.js';

/* The desert (S17).
 *
 * Every other world in this film is full: the jungle is a wall of small
 * shapes, the volcanic sky will be smoke and embers, the islands hang roots
 * for four hundred metres. This one is not full of anything. 'It is quiet and
 * it is enormous and there is nothing in it' is the whole brief, and the
 * things this file builds are chosen for how little they get in the way of
 * that: a ground, a sky, one low light, and — twice, briefly, because the
 * shot list asks for it — something that is not a third thing.
 *
 * Three pieces, and a storm that arrives in the last bars and touches all
 * three of them:
 *
 *   buildSky()   a camera-centred dome — actually centred on it now, which
 *                it was not for most of this scene's life. A gradient and
 *                one low sun, with the horizon line given a slow, cheap
 *                distortion — the heat shimmer the brief names, done once
 *                here rather than as a screen-space pass, because it is the
 *                horizon that shimmers, not the frame. Its colour is
 *                SKY_GLSL below, shared with the ground, which needs the
 *                same answer to fade into.
 *
 *   buildDunes() a heightfield on a plane that rides under the camera in
 *                whole grid cells — snapped, not merely recentred, and that
 *                distinction is the whole difference between a desert that
 *                holds still while the camera flies over it and one that
 *                ripples as it goes. The note in update() is the long
 *                version, and it is the third answer that question got
 *                rather than the first. The plane fades into the sky well
 *                inside its own edge, so a finite ground never reads as a
 *                finite ground. Ridge orientation is fixed (a
 *                prevailing wind, not a random field), lit by the one sun via
 *                a normal built from finite differences of the same height
 *                function the vertex shader displaces by, and blended to the
 *                sky at range with HEIGHT_FOG rather than EXTINCT — EXTINCT's
 *                constants are tuned for this film's enclosed and underwater
 *                scenes, where nothing is meant to be visible past a couple
 *                of hundred units. A desert's whole idea is the opposite of
 *                that, so it gets its own, much longer, falloff.
 *
 *   buildShardCluster()  the false alarms. They used to be buildMembrane()
 *                from water.js, held far away and stood on end, on the
 *                reasoning that they had to resemble the film's real Gateway
 *                shot or they would read as scenery instead of a false alarm.
 *                A later note moved the target: not a window-shaped surface
 *                at all, but the air itself seeming to fracture into a
 *                cluster of glass shards for a moment — growing, then
 *                settling, then gone. Twenty-two of them now rather than two,
 *                on FLICKER_PLAN's own schedule, and none of them is the real
 *                thing.
 *
 * The storm is not a fourth piece either. It is one number, uStorm, ramped by
 * the scene over the last bars and read by everything: the dome grows a cloud
 * deck and loses its sun to it, the ground gives up direct light and most of
 * its colour with it, and boltAt() puts lightning inside the deck that the
 * dome draws, the sand is lit by, and the compositor lifts the frame under.
 * One value rather than four effects that have to be kept in agreement.
 *
 * No aurora, still. The brief considers one and holds it back — 'an aurora is
 * a resolution, and a beautiful one' — and the honest way to hold something
 * back is not to write it and leave it at zero, it is not to write it. Note
 * though that the ending this now builds IS a resolution of a kind, a storm
 * and a fade to black rather than the dissolve the brief describes; see the
 * note at the top of s17-desert.js, which is where that decision is recorded.
 */

/* Dune ridges are wind-aligned, not radial: a desert with dunes radiating from
   the camera in every direction looks like a target, not a landscape. One
   rotation, fixed for the whole film. */
const WIND = -0.34;
const WR = Math.cos(WIND), WS = Math.sin(WIND);

/* The sun direction's own azimuth (see buildSky/buildDunes' uSunDir), in the
   same sin(az)/-cos(az) convention s17-desert.js's camera forward uses —
   matched here so the flicker schedule below can steer clear of it: (0.6,
   0.14, -0.79) normalised, az = atan2(x, -z). Fixed for the whole film, same
   as WIND, so it is cheaper as a constant than recomputed from the vector
   every time a flicker event needs to check its own distance from it. */
const SUN_AZ = Math.atan2(0.6, 0.79);

/* The sky, as a function of view direction alone — shared, because two
   different shaders need the same answer out of it and an approximation of
   it in the second one is a visible seam.

   The dune field is finite (it is a plane, not a world) and therefore has an
   edge, and that edge sits above the true horizon by atan(camHeight/extent)
   no matter how big the plane is made. Left hard, the edge is where new
   terrain visibly grows into existence as the camera advances — reported
   exactly that way: 'taivaanrannassa tuleva uusi aavikko kasvaa esiin
   hassunnäköisesti'. The fix is to fade the ground into the sky before its
   own edge is ever reached, which only works if 'the sky' means the sky
   that is actually behind that pixel — including the sun's glow and the
   heat wobble, both of which are strongest exactly at the horizon where the
   fade lives. Fading to a fixed average colour instead (which is what the
   fog term here used to do) leaves a band of not-quite-sky along the whole
   horizon, brightest near the sun, which is worse than the edge it hides.

   So both the dome and the ground's own distance fade call this. */
const SKY_GLSL = /* glsl */`
/* The closing storm's cloud deck.
 *
 * Sampled in azimuth and elevation rather than projected onto a plane
 * overhead, and that is not a shortcut — it is forced by the shot. This
 * camera sits at -16 degrees with a 28-degree half-angle, so the only sky it
 * ever sees runs from the horizon to about 12 degrees above it. A plane
 * projection (dir.xz/dir.y, the usual way to build a deck) puts almost the
 * entire deck outside that band and compresses what is left into a few rows
 * of violently aliasing pixels, because the projection's scale runs away as
 * dir.y goes to zero. In (az, el) the deck is exactly as detailed near the
 * horizon as it is higher up, which is wrong for a flat ceiling and right for
 * what this actually is: a distant storm front seen along the ground.
 */
float stormCloud(vec3 dir, float time){
  float el = dir.y;
  float az = atan(dir.x, -dir.z);
  vec2 p = vec2(az*2.4 + time*0.05, el*7.0 - time*0.02);
  float c = fbm(p*1.6 + vec2(fbm(p*0.7)*1.2));
  c = smoothstep(0.44, 0.68, c);
  /* The deck's underside comes down slightly BELOW the eye line, which is
     the difference between a storm somewhere else and a storm over this
     desert: a front closer than the horizon covers part of the ground's own
     distance, and the far dunes fade into cloud rather than into clear air.
     Seamless by construction, because the fade target those dunes blend to
     is this same function at their own view direction. Still ramped rather
     than cut, and still leaving a sliver of light along the very bottom of
     the sky — the lit gap under a front, and the thing that keeps the last
     bars from reading as a lid rather than as weather. */
  return c*smoothstep(-0.035, 0.012, el);
}

vec3 desertSky(vec3 dir, vec3 sunDir, vec3 horizonCol, vec3 zenithCol,
               vec3 sunCol, float heat, float haze, float time,
               float storm, vec3 boltDir, float bolt){
  /* Heat haze: a horizon-hugging band of horizontal streaks drifting
     upward, the near-universal signature of hot air over open ground.
     Applied to the gradient's own input rather than the screen, so it
     reads as the AIR doing it and not a lens. */
  float band = exp(-abs(dir.y)*10.0);
  float wob = (fbm(vec2(dir.x*7.0 + dir.z*5.0, time*0.6))-0.5)*0.11*band*heat;
  float k = smoothstep(-0.03, 0.52, dir.y + wob);
  vec3 col = mix(horizonCol, zenithCol, k);
  /* One low light. A tight disc plus three lobes of glow at widening angle
     and falling strength — the same shape as every other 'one bright thing'
     in this film. The widest lobe (the old pow(c,5)*0.070 term) is what was
     actually washing out a third of the sky: c^5 stays significant over a
     wide angle, and fed through this scene's own bloom on top of that, one
     bright disc turned into a haze that swallowed the blue the sky is
     supposed to hold. Narrowed rather than dimmed outright, so the sun
     still reads as genuinely bright where it sits — it just stops being the
     whole sky. */
  float c = max(0.0, dot(dir, normalize(sunDir)));
  float disc = smoothstep(0.99975, 0.99992, c);
  float glow = pow(c, 260.0)*1.5 + pow(c, 44.0)*0.26 + pow(c, 9.0)*0.022;
  col += sunCol*(glow + disc*2.4);
  /* Bars 173-175: the mix's own layers thinning, read as the haze
     thickening instead of anything cutting away. A graded whiteout. */
  col = mix(col, horizonCol, haze*0.6);
  /* The storm, applied AFTER the haze on purpose, so that where the two
     overlap the storm wins. They pull opposite ways — the haze whitens, the
     storm darkens — and the brief now asks for the ending to go dark, so the
     later of the two has to be the darkening or the last bars would end up
     grey rather than black. */
  if (storm > 0.0001){
    float cl = stormCloud(dir, time);
    /* Everything loses light first, the sun included, and that is the point:
       it does not set here, it is covered. */
    col *= mix(1.0, 0.26, storm);
    vec3 deckDark = vec3(0.030, 0.033, 0.046);
    vec3 deckLit  = vec3(0.115, 0.120, 0.150);
    col = mix(col, mix(deckDark, deckLit, cl*0.55), storm*cl*0.92);
    /* The bolt is inside the deck, so it lights cloud and almost nothing
       else — that is what the cl term is for, and it is nearly all of what
       makes this read as lightning rather than as the frame being strobed.
       The first pass had a wide lobe and a generous floor under that term,
       and the result at a peak was a whole desert brighter than it is at
       noon: a whiteout, when the brief asked for 'pientä salamointia
       pilvissä'. Now a tight core where the discharge is, one narrow-ish
       halo for the sheet of deck lit from within, and a floor low enough
       that clear air barely registers it. */
    float d = max(0.0, dot(dir, boltDir));
    float lobe = pow(d, 70.0)*0.55 + pow(d, 16.0)*0.10;
    col += vec3(0.72, 0.78, 1.00)*bolt*storm*lobe*(0.05 + 0.95*cl);
  }
  return col;
}`;

function buildSky(){
  /* Radius raised from 2600, and update() now recentres this on the camera
     every frame instead of leaving it at the world origin. Both had to
     change together, and the old arrangement was a latent bug in its own
     right: the camera travels about 2310 units over this scene, so by the
     last bars it sat within ~290 units of the INSIDE of a 2600-unit dome it
     was supposed to be at the centre of. Two things follow from that, both
     wrong. The dome's own colour is a function of the direction from its
     CENTRE (vD, the sphere vertex's own normal), so once the camera is not
     at the centre, the view direction and the shading direction stop
     agreeing: forward along -z exits the sphere at dir.y = 0 regardless of
     how far up the picture is actually looking, which flattens the gradient
     into near-uniform horizon colour across most of the frame — some of the
     'still overexposed' this scene kept reading as. And a few hundred units
     more travel would have put the camera outside its own sky entirely.
     Recentred, vD is the view direction again by construction, at any point
     in the scene, which is also what lets the ground fade match it exactly.
     5800 clears the dune plane's own 4500-unit reach so the ground never
     pokes through the dome, and stays inside the 6200 far plane. */
  const geo = new THREE.SphereGeometry(5800, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      /* A real desert sky, not the desaturated one this scene opened with —
         checked directly against reference photographs the brief later
         supplied: pale near the horizon, a genuinely saturated blue climbing
         to the zenith, and a warm sun disc rather than an almost-colourless
         one. */
      uHorizon: { value: new THREE.Color(0.80, 0.85, 0.92) },
      uZenith:  { value: new THREE.Color(0.16, 0.42, 0.78) },
      uSunDir:  { value: new THREE.Vector3(0.6, 0.045, -0.79).normalize() },
      uSunCol:  { value: new THREE.Color(1.00, 0.90, 0.68) },
      uHeat:    { value: 1.0 },
      uHaze:    { value: 0.0 },   // the bars 173-175 thickening; see s17-desert.js
      /* The closing storm. uStorm ramps 0->1 over the last bars; uBolt and
         uBoltDir are one lightning flash, computed on the CPU (boltAt below)
         so the dome, the ground and the compositor all read the same strike
         from one place instead of three copies of the same formula drifting
         apart. */
      uStorm:   { value: 0.0 },
      uBolt:    { value: 0.0 },
      uBoltDir: { value: new THREE.Vector3(0, 1, 0) },
      uTime:    { value: 0 }
    },
    vertexShader: `varying vec3 vD;
      void main(){ vD = normalize(position);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${SKY_GLSL}
      uniform vec3 uHorizon, uZenith, uSunDir, uSunCol, uBoltDir;
      uniform float uHeat, uHaze, uTime, uStorm, uBolt;
      varying vec3 vD;
      void main(){
        /* vD is the view direction, now that update() keeps this dome
           centred on the camera — see buildSky's note. */
        vec3 col = desertSky(normalize(vD), uSunDir, uHorizon, uZenith,
                             uSunCol, uHeat, uHaze, uTime,
                             uStorm, uBoltDir, uBolt);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

/* Shared between the vertex and fragment stages of buildDunes() below: the
   vertex shader displaces by it, the fragment shader raymarches it for
   self-shadows and reads its ridge strength for the crest-blown-sand
   texture. One definition, so the two stages can never quietly disagree
   about where the surface actually is — which is exactly how the fragment
   shader's shadow test would drift out of step with the geometry it is
   supposed to be shadowing if this were copied twice by hand.

   Ridges from a ridged fbm (1 - |2n-1|) rather than plain fbm: plain noise
   gives rolling hills, folding the field around its own midline gives the
   sharp-backed, flat-valleyed profile a dune actually has. Two frequencies,
   wind-rotated the same amount, so the fine ripple rides the same axis as
   the ridge it sits on instead of crossing it.

   duneAmpMask() is new: a third, much lower frequency field that scales r1's
   amplitude region by region. Raised and narrowed from the first pass
   (0.38 + 0.95*fbm, i.e. 0.38-1.33) to 0.85 + 0.65*fbm (0.85-1.5): the brief's
   own follow-up, after seeing that pass, was 'massiivisia isoja dyynejä'
   instead of a big/small mix — so the low end came up rather than the field
   keeping stretches of small dunes it no longer asked for.

   r1/r2's own frequencies came DOWN rather than their amplitude alone going
   up — checked directly against a first attempt that just tripled the old
   0.0026/0.0095 pair's amplitude and left their frequency where it was: the
   result read as a fractured, jagged mountain range, not sand, because
   height and frequency together are what set slope, and tripling height at
   the old frequency triples slope everywhere a ridged fbm already climbs
   and falls sharply by construction. A real dune gets tall by being wide, not
   steep — long, smooth, wind-swept flanks up to one sharp crest line — so
   the fix was to spread the same silhouette over a much longer wavelength
   (0.0026 -> 0.00075, roughly 3.5x wider) rather than keep it cramped and
   just taller. r2, the secondary ridge, dropped in relative amplitude and
   widened for the same reason — it was the finer, sharper octave and the
   dominant source of the jaggedness once r1 was already this tall.

   r1's own exponent went up after that pass, from 2.0 to 1.7 to 3.2, chasing
   a second, separate note the wider-wavelength fix did not by itself
   answer: 'dyynien pinta lainehtii jotenkin hassusti', wanting
   'tarkkarajaiset dyynien huiput'. A low exponent folds the ridge mask into
   a broad, rounded dome — smooth, but smooth in the way a swell is smooth,
   with no one line reading as the crest — and a higher one narrows where r1
   is actually near 1 to a thin band, holding a real crest LINE instead.

   3.2 then came back down, and the reason is worth recording at length,
   because the report it answers — 'dyynit liikkuvat ylös/alas muutaman
   framen välein' — took THREE attempts to diagnose and the first two were
   both wrong in instructive ways.

   The first blamed this exponent, on the theory that a sharp crest aliases
   against the mesh's fixed grid as the sampled world slides underneath it.
   That is very nearly right, and it is why the values below are what they
   are: segments up (460 to 700), exponent down (3.2 to 1.8), r2 and fine
   both quieter. It did not work, and the measurement said so — consecutive
   frames were rendered and diffed, which is the only way a frame-to-frame
   fault can be seen at all, and the anomaly did not shrink. What was missed
   is that changing the segment count could never have shrunk it: the ripple
   this produces has an amplitude set by how badly the grid undersamples the
   crest and a PERIOD set by spacing/speed, and the test being run measured
   only amplitude. A wrong conclusion from a real measurement of the wrong
   quantity.

   The second blamed post.js's film grain, which updates at uNoiseHz (12,
   film-wide and deliberate) rather than per frame, so its pattern holds five
   frames and jumps. That is a genuine effect and it does show up at a
   high-contrast edge, so turning it off for this scene removed a real spike
   from the whole-frame diff — which is exactly why it was convincing. It was
   also not what anyone was looking at: the grain's ~12Hz and the ripple's
   ~14Hz are close enough to be indistinguishable by eye, and the picture
   still moved with grain at zero.

   The third answer is the one in update(): the mesh position is snapped to
   its own vertex lattice, so the sampled world points are identical every
   frame instead of merely nearby. See the note there for why that is exact
   rather than approximate. The values below stay where the first attempt
   left them regardless — each is defensible on its own (1.8 still holds a
   crest line; 700-plus segments still beat 460 on a field this tall) and
   none of them is load-bearing for stability any more, which is worth
   knowing before anyone tunes them for how the dunes LOOK. That is now
   safe to do. */
/* Every tunable number in the height field, in one object, because the field
   now has to be evaluated in two places: on the GPU, where it displaces the
   mesh, and on the CPU, where the flicker schedule needs to know how high the
   ground is under each event in order to stand it on the sand rather than
   hang it in the air.

   Two implementations of one function is a standing invitation to have two
   different functions, so the parts that get tuned live here and both sides
   read them. What is still duplicated is the noise itself — fbm/gnoise, mirrored
   from core/glsl.js in duneHeightAt() below — and that is the part nobody
   tunes; if it ever is tuned, both have to move together and the note there
   says so. */
const DUNE = {
  ampBase: 0.85, ampVar: 0.65, ampFreq: 0.00014, ampSeed: 91.0,
  r1Freq: 0.00075, r2Freq: 0.0036, r2Seed: 31.0, ridgeExp: 1.8,
  r1Amp: 130.0, r2Amp: 14.0,
  fineFreq: 0.019, fineSeed: 7.0, fineAmp: 0.8
};

const DUNE_GLSL = /* glsl */`
float duneAmpMask(vec2 p){
  return ${DUNE.ampBase} + ${DUNE.ampVar}*fbm(p*${DUNE.ampFreq} + ${DUNE.ampSeed.toFixed(1)});
}
float duneH(vec2 p, out float ridge){
  vec2 q = vec2(${WR.toFixed(6)}*p.x - ${WS.toFixed(6)}*p.y,
                 ${WS.toFixed(6)}*p.x + ${WR.toFixed(6)}*p.y);
  float r1 = 1.0 - abs(fbm(q*${DUNE.r1Freq})*2.0 - 1.0);
  r1 = pow(clamp(r1, 0.0, 1.0), ${DUNE.ridgeExp});
  float r2 = 1.0 - abs(fbm(q*${DUNE.r2Freq} + ${DUNE.r2Seed.toFixed(1)})*2.0 - 1.0);
  r2 = pow(clamp(r2, 0.0, 1.0), ${DUNE.ridgeExp});
  /* Coarsened from 0.048 (a ~21-unit wavelength) to 0.019 (~53): the mesh
     this displaces is a 3400-unit plane at 460 segments, ~7.4 units apart
     (was 260 segments, ~13 units, before the segment count itself went up
     to keep the now much taller r1/r2 from faceting at the old spacing), so
     the old frequency sat below the grid's own Nyquist limit and aliased —
     each vertex's normal sampling the fine ripple at a different, effectively
     random phase from its neighbours', which reads as a fine streaky,
     flowing texture rather than sand grain, and was very likely why the
     whole field could still look water-like even with the true wave motion
     already removed. Comfortably above the grid spacing either way. */
  float fine = fbm(p*${DUNE.fineFreq} + ${DUNE.fineSeed.toFixed(1)}) - 0.5;
  ridge = r1;
  return r1*${DUNE.r1Amp.toFixed(1)}*duneAmpMask(p) + r2*${DUNE.r2Amp.toFixed(1)} + fine*${DUNE.fineAmp};
}
float duneHeight(vec2 p){ float r; return duneH(p, r); }
`;

/* The same height field on the CPU, for standing the false portals on the
 * sand. The noise itself moved to core/noise-cpu.js when volcanic.js needed
 * the same mirror to fly a camera over its terrain — one copy, so the two
 * cannot drift apart from core/glsl.js independently.
 */
export function duneHeightAt(x, z){
  const qx = WR*x - WS*z, qz = WS*x + WR*z;
  let r1 = 1 - Math.abs(fbm(qx*DUNE.r1Freq, qz*DUNE.r1Freq)*2 - 1);
  r1 = Math.pow(Math.min(1, Math.max(0, r1)), DUNE.ridgeExp);
  let r2 = 1 - Math.abs(fbm(qx*DUNE.r2Freq + DUNE.r2Seed, qz*DUNE.r2Freq + DUNE.r2Seed)*2 - 1);
  r2 = Math.pow(Math.min(1, Math.max(0, r2)), DUNE.ridgeExp);
  const amp = DUNE.ampBase + DUNE.ampVar*fbm(x*DUNE.ampFreq + DUNE.ampSeed, z*DUNE.ampFreq + DUNE.ampSeed);
  const fine = fbm(x*DUNE.fineFreq + DUNE.fineSeed, z*DUNE.fineFreq + DUNE.fineSeed) - 0.5;
  return r1*DUNE.r1Amp*amp + r2*DUNE.r2Amp + fine*DUNE.fineAmp;
}

/* size/seg: the plane's own reach and density, and the two of them together
   fix the snap quantum in update() (size/seg, ~10 units here).

   Reach went from 3400 to 9000 because half of 3400 is 1700, and at this
   camera's 260-unit altitude a 1700-unit edge sits 8.7 degrees below eye
   level — about a quarter of the frame ABOVE its centre, which is to say
   the thing the picture read as 'the horizon' was never the horizon at all,
   it was the end of the mesh. Every dune arriving in the distance was
   therefore arriving out of that cut rather than out of the distance.
   4500 puts the edge at 3.5 degrees, and the fade in the fragment shader
   finishes at 4300, so the edge is fully atmosphere before it exists.

   Density kept at the same order rather than the same value: 900 segments
   over 9000 units is a ~10-unit spacing against the old ~4.9, which sounds
   like a halving of detail and is not, because what the spacing has to
   resolve is the height field's own finest term. r1 carries the shape at
   amplitude 130 and its finest octave is still hundreds of units across;
   r2's is ~35 units at an amplitude under 2. Checked directly against a
   render of the near field rather than argued: at this altitude nothing in
   the first few hundred units reads any differently than it did at 700
   segments over the smaller plane. */
function buildDunes(size = 9000, seg = 900){
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI/2);
  const mat = new THREE.ShaderMaterial({
    side: THREE.FrontSide, depthWrite: true,
    uniforms: {
      uOffset:   { value: new THREE.Vector2() },
      uCam:      { value: new THREE.Vector3() },
      /* Lowered from y=0.14 — s17-desert.js's own this._sun now sits near
         y=0.045, a sun close to setting, so the dunes throw the long shadows
         the brief asked for ('aurinko on laskemassa taivaanrantaan, jolloin
         dyyneistä jää pitkät varjot'). This default is overwritten every
         frame from that vector; kept in sync here only so the very first
         frame, before update() has run, doesn't briefly show the old sun. */
      uSunDir:   { value: new THREE.Vector3(0.6, 0.045, -0.79).normalize() },
      uSunCol:   { value: new THREE.Color(1.00, 0.90, 0.68) },
      /* Deep burnt-orange shadow to bright golden-yellow crest — checked
         directly against reference desert photographs: the old pair (a
         desaturated brown-grey) was why the whole field read as pale sand
         under an overcast sky instead of hot, saturated dune colour under a
         hard sun. */
      uSandLo:   { value: new THREE.Color(0.30, 0.11, 0.035) },
      uSandHi:   { value: new THREE.Color(1.00, 0.58, 0.17) },
      uHorizon:  { value: new THREE.Color(0.80, 0.85, 0.92) },
      uZenith:   { value: new THREE.Color(0.16, 0.42, 0.78) },
      /* Cut hard from the first pass (0.0016) and then cut again: the
         0.00035 this dropped to still washed the picture, checked directly
         by disabling it outright and comparing renders side by side — with
         it off, the same frame read noticeably more saturated and the
         shadow side of every dune held real dark colour instead of a pale
         warm-grey mix toward the sky. 0.00035 at this camera's ~260-unit
         altitude was still ~31% fog by 1200 units and ~59% by 3000 — hand
         -calculated from heightFog()'s own formula the same way the first
         cut was — which is overcast-day haze, not the essentially clear air
         a real desert has at working camera range. 0.00015 gives roughly
         15%/33% at those same two distances: still atmosphere at the
         horizon, not a wash over the whole picture. */
      uFogDen:   { value: 0.00015 },
      uFogFall:  { value: 0.0011 },
      /* Where the ground stops being ground and becomes sky. Ends at 4300,
         inside the plane's own nearest edge at 4500, so no edge is ever
         reachable by eye; starts at 2600, far enough out that everything
         the picture is actually about is untouched by it. Deliberately not
         expressed as more fog: fog was already cut twice for washing the
         picture out ('vielä aavikko on ylivaloittunut'), and turning it
         back up to hide an edge would undo both cuts everywhere in order to
         fix one band at the top of the frame. */
      uFadeA:    { value: 2600.0 },
      uFadeB:    { value: 4300.0 },
      uHeat:     { value: 1.0 },
      uHaze:     { value: 0.0 },
      /* Same storm the sky gets. The ground needs it too — a dark sky over a
         sunlit desert is a matte painting, not weather. uBoltDir is not
         needed down here: the flash is above and broad by the time it
         reaches the sand, so it lights the ground as a flat term — but the
         SKY this ground fades into still needs the direction, or the horizon
         band would stay dark through a flash the sky just above it shows. */
      uStorm:    { value: 0.0 },
      uBolt:     { value: 0.0 },
      uBoltDir:  { value: new THREE.Vector3(0, 1, 0) },
      uTime:     { value: 0 }
    },
    vertexShader: /* glsl */`
      ${NOISE}
      ${DUNE_GLSL}
      uniform vec2 uOffset;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main(){
        vec2 local = position.xz;
        vec2 world2 = local + uOffset;
        float eps = 2.2;
        float ridge0, ridgeX, ridgeZ;
        float h0 = duneH(world2, ridge0);
        float hx = duneH(world2 + vec2(eps, 0.0), ridgeX);
        float hz = duneH(world2 + vec2(0.0, eps), ridgeZ);
        /* No uTime here on purpose. This used to add a small time-varying
           'heat wobble' straight into the vertex height, meant to read as
           shimmer at range — instead, checked directly against the note
           this scene shipped with, it read as the whole dune field heaving
           like open water, because that is exactly what an animated
           heightfield displacement looks like regardless of the intent
           behind it. Heat shimmer belongs to the air in front of the sand,
           not to the sand's own position, so it lives only in the sky dome
           and the fragment-stage blown-sand streaks below now — the ground
           itself is a pure function of position, full stop. */
        vec3 tangentX = vec3(eps, hx - h0, 0.0);
        vec3 tangentZ = vec3(0.0, hz - h0, eps);
        vNormal = normalize(cross(tangentZ, tangentX));
        vWorld = vec3(world2.x, h0, world2.y);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(local.x, h0, local.y, 1.0);
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${DUNE_GLSL}
      ${HEIGHT_FOG}
      ${SKY_GLSL}
      uniform vec3 uCam, uSunDir, uSunCol, uSandLo, uSandHi, uHorizon, uZenith;
      uniform vec3 uBoltDir;
      uniform float uFogDen, uFogFall, uHaze, uTime, uHeat, uFadeA, uFadeB;
      uniform float uStorm, uBolt;
      varying vec3 vWorld;
      varying vec3 vNormal;
      /* A dune casting shadow into the trough or the dune behind it — the
         one thing a lone lambert term can never give you, and the brief
         asked for it by name: 'tulee dyyneihin varjoja', and its own
         follow-up asked for those shadows long — 'aurinko on laskemassa
         taivaanrantaan, jolloin dyyneistä jää pitkät varjot'. A setting sun
         means a shallow climb tangent (slope, below), so a shadow-casting
         ridge can sit a long way upsun of the point it darkens: six steps
         now, geometric from 18 units out to a bit over 2100, instead of the
         first pass's four steps topping out under 150 — checked directly
         against the old reach, which was too short to ever find the very
         dunes tall enough, at this sun angle, to cast a shadow that long.
         Still never driven fully to zero — amb in the caller still lights a
         shadowed face from the sky, which is what a real shadow looks like
         outdoors, not a hole. */
      float duneShadow(vec2 p0, float h0, vec3 sunDir){
        vec2 dirXZ = normalize(sunDir.xz + vec2(1e-5));
        float slope = sunDir.y/max(0.03, length(sunDir.xz));
        float sh = 1.0;
        float dist = 18.0;
        for (int i = 0; i < 6; i++){
          vec2 p = p0 + dirXZ*dist;
          float r; float hs = duneH(p, r);
          float rayH = h0 + slope*dist;
          sh *= 1.0 - clamp((hs - rayH)*0.10, 0.0, 1.0);
          dist *= 2.6;
        }
        return clamp(sh, 0.18, 1.0);
      }
      void main(){
        vec3 N = normalize(vNormal);
        float lam = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
        lam *= duneShadow(vWorld.xz, vWorld.y, normalize(uSunDir));
        /* Ridge crests read paler and warmer than the troughs beneath them —
           the one cue, besides the shading itself, that this is dune-shaped
           and not a flat lit plane. */
        vec3 base = mix(uSandLo, uSandHi, clamp(vWorld.y*0.024 + 0.45, 0.0, 1.0));
        float amb = 0.15;
        vec3 col = base*(amb + (1.0 - amb)*lam) + uSunCol*pow(lam, 5.0)*0.16;
        /* The storm takes the sun away rather than the light: direct sun
           gives way to a dim, almost shadowless sky light, which is what
           ground under a deck actually looks like. Applied before the fog
           and the horizon fade below, so the darkened ground then blends
           into the equally darkened sky and the two stay one picture. */
        /* Desaturated toward a cold slate as well as darkened, and the
           desaturation is the half that matters. Simply dimming the sand
           leaves it the same saturated orange it is at midday, only less of
           it, and an orange desert under a grey deck reads as a matte
           painting of two unrelated pictures. Sand has no colour of its own
           in this light because there is no warm sun left to give it one. */
        vec3 stormBase = mix(base, vec3(0.50, 0.50, 0.55), 0.60);
        vec3 stormLit = stormBase*(0.13 + 0.11*lam);
        col = mix(col, stormLit, uStorm);
        /* And the bolt lights the sand under it for the frames it lasts —
           the same uBolt the dome draws the flash itself with. Small: 0.30
           here put more light on the desert than the sun does, which turned
           every strike into a full whiteout. This is a distant flash inside
           cloud, and what reaches the ground from one is a suggestion. */
        col += base*uBolt*uStorm*0.035;
        /* The wind-blown crest streak this scene shipped with last is gone —
           'voidaan jättää toistaiseksi dyynien yli lentävä hiekka pois, koska
           se näyttää huonolta'. Left out rather than merely disabled: nothing
           downstream (vRidge, uTime, uHeat's use here) depended on anything
           else, so there was nothing to leave half-wired. */
        /* The sky actually behind this pixel, along this pixel's own view
           ray — the same function the dome itself is drawn with, so the two
           agree by construction rather than by tuning. Both the fog and the
           distance fade below blend toward it: fog used to blend toward a
           fixed mix(uHorizon, uZenith, 0.10), which is a reasonable average
           of the sky and therefore wrong everywhere in particular, most
           visibly near the sun, where the real sky is far brighter than any
           average of it. */
        vec3 skyAt = desertSky(normalize(vWorld - uCam), uSunDir, uHorizon,
                               uZenith, uSunCol, uHeat, uHaze, uTime,
                               uStorm, uBoltDir, uBolt);
        /* Measured from the CAMERA, not from the mesh's own centre, and this
           distinction matters more than its one line suggests. The mesh's
           centre is snapped to the vertex lattice (see update()), so it
           advances in 10-unit jumps while the camera glides; anything shaded
           by distance-from-centre therefore jumps with it, which would have
           put a small discontinuity right back into the fade band this whole
           change exists to smooth out. Distance from the camera is
           continuous by construction. Safe against the edge either way: the
           camera is never more than half a cell from the centre, so the
           nearest edge is never closer than 4495, and the fade is finished
           at 4300. */
        float dHoriz = length(vWorld.xz - uCam.xz);
        float fog = heightFog(uCam, vWorld, uFogDen, uFogFall, 0.0);
        col = mix(col, skyAt, clamp(fog, 0.0, 1.0));
        /* The haze's own whitening of the far ground, backed off as the storm
           builds for the same reason the sky's is (see desertSky): the two
           effects pull opposite ways and the ending is meant to go dark. */
        col = mix(col, uHorizon,
                  uHaze*0.55*(1.0 - uStorm*0.85)*smoothstep(300.0, 2000.0, dHoriz));
        /* Last, and to 1.0, not to 'mostly': anything short of a complete
           blend leaves a residue of ground colour sitting along the mesh's
           own edge, which is the artefact this exists to remove. Horizontal
           distance, so this is a ring, not a depth plane — the edge it hides
           is a square one, and the nearest part of that square is what
           uFadeB has to clear. */
        col = mix(col, skyAt, smoothstep(uFadeA, uFadeB, dHoriz));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  /* The distance between neighbouring vertices, handed to update() so it can
     snap this mesh's position to that lattice — see the note there. Carried
     on the mesh rather than recomputed from two constants in two files,
     because the whole point of the snap is that this number and the geometry
     agree exactly; a second copy that drifts silently reintroduces the exact
     bug the snap exists to fix. */
  m.userData.step = size/seg;
  return m;
}

/* The flicker itself: 'lasisirpaleiden kasvava möykky' — a growing clump of
   glass shards, the air fracturing into facets for a moment rather than a
   flat coloured window. One camera-facing plane, same as the shape it
   replaces, but the fragment shader draws an oval cellular (Voronoi) facet
   pattern instead of a filled rectangle, masked by a radius that grows from
   the centre out and additively blended so it reads as glinting light rather
   than painted colour — glass catches light, it is not a solid tinted pane.

   Growth and settling are both pure functions of (uTime - uStart)/uDur, the
   same event-local time the JS-side pulse envelope already uses, so no
   accumulator anywhere needs a previous frame to have run: frame 40000 of
   this event looks the same whether or not frame 39999 was ever drawn.

     grow    0 -> ~30% of the event: the mask's own radius opens outward,
             the 'kasvava' half of 'kasvava möykky joka kuitenkin asettuu'.
     settle  ~30% -> 100%: held there, while the per-facet sparkle's
             amplitude and blink rate both fall off — the shards stop
             glinting so busily and the clump goes still, the 'asettuu' half,
             before the JS-side pulse fades it out entirely.

   uSeed varies the Voronoi jitter and sparkle phase per event, off the same
   deterministic hash() below everything else in this file already uses, so
   the two scheduled events don't read as the same clump replayed twice. */
function buildShardCluster(){
  /* 480 rather than 360. At the schedule's 3600-5800 unit distances the old
     square subtended roughly 4-7 degrees, i.e. 60-90 pixels tall in a
     1080-line frame once the oval scale below narrows it — small enough that
     'selkeämmin' is partly just a size problem. This is a third larger and
     still nowhere near big enough to read as an object rather than a
     glinting patch of disturbed air. */
  const geo = new THREE.PlaneGeometry(480, 480);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uStart: { value: 0 },
      uDur:   { value: 1 },
      uCol:   { value: new THREE.Color(1, 1, 1) },
      uPulse: { value: 0 },
      uSeed:  { value: 0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`precision highp float;
      uniform float uTime, uStart, uDur, uPulse, uSeed;
      uniform vec3 uCol;
      varying vec2 vUv;

      float hash21(vec2 p){
        p = fract(p*vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x*p.y);
      }
      /* F1/F2 cellular noise: nearest and second-nearest jittered grid
         point. The gap between them (md2-md) is what draws a thin bright
         line at a facet's own edge below — a Voronoi cell IS a flat-faced
         shard shape, which is the whole reason to reach for it here rather
         than plain fbm. */
      vec3 voronoi(vec2 p){
        vec2 n = floor(p), f = fract(p);
        float md = 8.0, md2 = 8.0, id = 0.0;
        for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++){
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash21(n + g + uSeed), hash21(n + g + uSeed + 17.13));
          vec2 r = g + o - f;
          float d = dot(r, r);
          if (d < md){ md2 = md; md = d; id = hash21(n + g + uSeed + 3.7); }
          else if (d < md2){ md2 = d; }
        }
        return vec3(sqrt(md), id, sqrt(md2));
      }
      void main(){
        vec2 uv = vUv - 0.5;
        float r = length(uv)*2.0;             // 1.0 at the plane's inscribed circle
        float lt = clamp((uTime - uStart)/max(uDur, 1e-4), 0.0, 4.0);
        float grow = smoothstep(0.0, 0.30, lt);
        float settle = 1.0 - smoothstep(0.28, 1.1, lt);
        float edgeSoft = mix(0.09, 0.22, settle);
        float mask = 1.0 - smoothstep(grow - edgeSoft, grow, r);
        if (mask <= 0.0){ discard; }

        vec3 vor = voronoi(uv*9.0 + 4.5);
        float edge = vor.z - vor.x;
        float edgeGlow = smoothstep(0.11, 0.0, edge);
        float facet = 0.30 + 0.55*vor.y;
        float sparklePhase = vor.y*53.0 + uSeed*13.0;
        float sparkle = pow(max(0.0, sin(sparklePhase + uTime*(10.0 + 7.0*settle))), 10.0)
                      * (0.30 + 0.70*settle);

        /* Additive, not alpha-over — glass catches light rather than tinting
           what's behind it — which means intensity stacks differently than
           the old flat membrane plane did and the first pass here ran much
           hotter than intended: checked directly, the event's own peak frame
           came out with a visible white wash over the ENTIRE picture, not
           just a bright cluster on the horizon, because col this bright
           times alpha this high fed straight into the bloom pass's blur
           radius. Cut roughly 3x across both so the cluster's own peak
           brightness lands close to what the old plane's peak was. */
        /* Raised about a quarter from that cut — 'selkeämmin' — which is a
           long way short of undoing it. The whiteout it was cut for came
           from a product roughly four times this; a quarter more contrast
           against a bright sky is legibility, not a flashbulb, and the
           frame's own uFlash was pulled down again in s17-desert.js to pay
           for it now that the event lasts three times as long. */
        vec3 col = uCol*facet*0.94 + vec3(1.0)*(edgeGlow*0.69 + sparkle*0.81);
        float alpha = mask*(0.27 + edgeGlow*0.55 + sparkle*0.66)*uPulse;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

/* Deterministic — a small hash rather than Math.random, so frame 900 does not
   need frame 899 to have happened. Every property of every flicker event is a
   pure function of that event's own index. */
function hash(i, salt){
  let x = (i*2654435761 + salt*40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}
/* Pale, icy violet-to-blue — the same family as the film's own 'Gateway'
   hook colour, kept even though the shape no longer quotes it directly,
   because the clump is still meant to read as an echo of that colour rather
   than as generic sparkle. Three tones rather than two now the schedule runs
   to twenty-odd events: enough that consecutive ones in the closing thicket
   do not read as the same object blinking. */
const SHARD_COL = [
  [0.82, 0.80, 1.00],
  [0.78, 0.88, 1.00],
  [0.88, 0.82, 0.98]
];

/* The schedule — a shot plan now, not a pair.
 *
 * It used to be two events inside bars 162-167. The brief opened it out: one
 * at the very top of the scene, more of them further off through the middle,
 * a spread of sizes, and 'ihan lopussa tosi tiheään' — a thickening that runs
 * into the storm and the fade rather than stopping before them. Four named
 * stretches, each with its own count, distance band, size band and duration,
 * because one formula asked to mean four different things is a formula nobody
 * can later retune one stretch of.
 *
 * The shape of the whole thing is the point: one, silence, two, a scattering
 * far out, and then a closing thicket whose gaps shrink from about a second
 * to about a fifth of one. The gaps shrink because the times are placed on
 * s^0.55 rather than on s — an exponent below 1 puts the samples closer
 * together as s approaches 1, which is the only reason the ending accelerates
 * instead of merely continuing.
 *
 * Durations shrink with it, and that pairing matters: the 1.5-2.0s events of
 * the middle would overlap eight deep at the end's spacing and turn a
 * thickening into a wash. The closing events are half-second stabs, so three
 * or so overlap — busy, still countable.
 */
const FLICKER_PLAN = [
  /* 1. The opening. The scene's own note calls bars 156-161 a held breath,
        and this is placed after enough of it to be a held breath first.
        Sized down from 1.35: at that scale it read as an event the film was
        about rather than as the first of twenty-odd, and the ones that come
        later have to be able to be bigger than it. */
  { n: 1, t0: 2.6, rel: 'T0', jit: 0.0,
    dist: [2900, 2900], size: [1.05, 1.05], dur: [1.90, 1.90] },

  /* 2. Bars 162-167, the authored 'Flickers' sub-shot — the two that were
        already here, kept at the times they already had. */
  { n: 2, t0: 1.50, step: 5.50, rel: 162, jit: 0.55,
    dist: [3000, 3900], size: [0.95, 1.15], dur: [1.60, 1.95] },

  /* 3. Bars 167-172. 'Kaukana voisi olla useampia': further out and smaller
        with it, so they read as more distant rather than merely as more.
        Stops before bar 172, where the close begins — these are the last
        quiet ones and they should not be still ringing when it starts. */
  { n: 4, t0: 0.9, step: 1.90, rel: 167, jit: 0.45,
    dist: [3600, 4400], size: [0.40, 0.70], dur: [1.10, 1.60] },

  /* 4. The close: the two bars before the last hit, 172.1 to about 174.0.
        'Nopeat välähdykset parin tahdin aikana ennen loppulaukausta', so
        these are short — a third to a half of a second each — and they
        accelerate into the gap before it. Ends a beat short of 174.1 so the
        final one below lands as punctuation and not as one more of these. */
  { n: 12, t0: 0.17, tEnd: 3.05, rel: 172, curve: 0.55, jit: 0.07,
    dist: [2600, 4400], size: [0.40, 1.20], dur: [0.34, 0.58] },

  /* 5. THE LAST ONE IS GONE, and this is what it was.
 
        It was the only event in the film timed to a specific sound — the
        final hit and its reverb at bar 174.1 — and the biggest and closest of
        all of them, fired deliberately INTO the fade so that the black would
        take it mid-flash. The argument was that the film's last image should
        be a gateway that still is not one.
 
        The note: 'lopun fadeoutissa näkyy vähän ikävästi viimeinen
        feikkiportaali, eli sen voisi jättää pois (ei sovi fadein kanssa
        yhteen)'. That is the same fact read the other way round, and it is
        the reading that counts, because it is the one from watching it: a
        fade is a statement that the picture is ending, and something bright
        arriving inside one does not read as punctuation, it reads as the fade
        failing to cover something. The idea needed the flash to be legible
        and the fade to be honest at the same time, and those two cannot both
        be true of the same second.
 
        Kept as a comment rather than as a disabled entry, because a switched
        off event in a schedule is a thing someone turns back on without
        reading why it was off. */
];

/* Distances were 3200-5800 while these hung in the sky, and had to come in to
   2600-4400 once they were stood on the ground, which is not an arbitrary
   retune. What makes a shape read as sitting ON the desert is the dune line
   crossing in front of its foot, and past about 4400 units there is no dune
   line left to do that: the ground fades into the sky from 2600 out and the
   mesh itself stops at 4500, so an event beyond that stands on terrain that
   is no longer drawn and floats exactly as before, however carefully its
   height was computed. Sizes came down with the distances to keep them the
   same size on screen. */

/* Distances were 3200-5800 while these hung in the sky, and had to come in to
   2600-4400 once they were stood on the ground, which is not an arbitrary
   retune. What makes a shape read as sitting ON the desert is the dune line
   crossing in front of its foot, and past about 4400 units there is no dune
   line left to do that: the ground fades into the sky from 2600 out and the
   mesh itself stops at 4500, so an event beyond that stands on terrain that
   is no longer drawn and floats exactly as before, however carefully its
   height was computed. Sizes came down with the distances to keep them the
   same size on screen. */

/* SUN_AZ-avoidance, shared by every stretch: an event landing inside the
   sun's own glow read as a pale ghost no colour or opacity tuning fixed,
   because blending over a bright source always washes toward that source.
   Flips to the other side of wherever the camera is looking rather than
   moving off that arc entirely, so the in-frame guarantee still holds. */
function flickerAz(i, tAt, lookAz){
  if (!lookAz) return hash(i, 2)*Math.PI*2;
  const base = lookAz(tAt);
  let off = (hash(i, 2) - 0.5)*0.86;
  let d = (base + off) - SUN_AZ;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) < 0.34) off = -off;
  return base + off;
}

/* Lightning, as a pure function of time.
 *
 * Computed here on the CPU rather than in the sky shader, even though the
 * shader is where it is drawn, because three separate things need to agree
 * about it: the dome draws the flash, the ground is lit by it, and the
 * compositor puts a small frame-wide lift under it. Three copies of one
 * formula in two languages is three things to keep in step; one value passed
 * to all of them is none.
 *
 * Time is cut into slots at RATE per second. Each slot either fires or does
 * not, decided by a hash of its own index, so no accumulator and no memory of
 * previous frames — frame 40000 knows whether it is inside a flash without
 * frame 39999 ever having run. The firing probability climbs with the storm
 * rather than sitting flat, so the last bars crackle and the first ones do
 * not.
 *
 * The envelope is a fast attack and short decay plus a weaker second strike
 * just behind it: real lightning is almost never a single pulse, and the
 * double blink is most of what makes it read as lightning rather than as
 * something switching on.
 */
function boltAt(t, storm, outDir){
  if (storm <= 0.0001) return 0;
  const RATE = 1.45;
  const x = t*RATE;
  const idx = Math.floor(x), ph = x - idx;
  if (hash(idx, 21) >= 0.26 + 0.42*storm) return 0;
  let env = Math.exp(-ph*16.0);
  if (ph > 0.10) env += 0.5*Math.exp(-(ph - 0.10)*22.0);
  /* Inside the band of sky this camera can actually see — a strike placed at
     a realistic elevation would be above the top of frame; see stormCloud's
     note on how little sky is in shot. */
  const az = (hash(idx, 22) - 0.5)*1.25;
  const el = 0.055 + hash(idx, 23)*0.115;
  outDir.set(Math.sin(az), el, -Math.cos(az)).normalize();
  return env;
}

function buildFlickerSchedule(tl, T0, lookAz, camAt){
  const lerp = (a, b, u) => a + (b - a)*u;
  const cam = new THREE.Vector3();
  const out = [];
  for (const p of FLICKER_PLAN){
    for (let k = 0; k < p.n; k++){
      const i = out.length;                        // one hash stream per event
      const base = p.rel === 'T0' ? T0 : tl.timeOfBar(p.rel);
      let t;
      if (p.curve !== undefined){
        /* Accelerating: see the note above on why the exponent is below 1. */
        const s = p.n > 1 ? k/(p.n - 1) : 0;
        t = base + lerp(p.t0, p.tEnd, Math.pow(s, p.curve));
      } else {
        t = base + p.t0 + k*(p.step || 0);
      }
      t += (hash(i, 1) - 0.5)*p.jit;
      const dur0 = lerp(p.dur[0], p.dur[1], hash(i, 4));
      /* t is the envelope's centre everywhere else in this plan. riseAligned
         says the number given was the moment the flash becomes visible
         instead, so shift by the same 0.6 durations the visibility window
         and the shader's own uStart both use. */
      if (p.riseAligned) t += dur0*0.6;
      const dur  = dur0;
      const dist = lerp(p.dist[0], p.dist[1], hash(i, 3));
      const size = lerp(p.size[0], p.size[1], hash(i, 7));
      const az   = flickerAz(i, t, lookAz);
      /* A FIXED point in the world, worked out once from where the camera
         will be at this event's own moment — not, as this was, a bearing and
         a distance re-resolved against the camera every frame.
         Camera-relative was fine while these hung in empty sky: an event that
         keeps its distance as you fly at it reads as painted on the horizon,
         which is what a mirage should do. It cannot survive standing on the
         ground, though, because the ground under a moving point is a moving
         height, so a flicker pinned to the camera would slide up and down the
         dunes for its whole life. Fixed in the world it simply stands there,
         and the camera closes a hundred-odd units on it over a second — too
         little to change its size, enough for a little parallax against the
         dunes in front of it, which is most of what selling 'kiinni
         aavikossa' actually takes. */
      camAt(t, cam);
      const wx = cam.x + Math.sin(az)*dist;
      const wz = cam.z - Math.cos(az)*dist;
      /* Standing on the sand rather than hovering over it. The visible
         cluster is the plane's inscribed circle (see the shader's r), so its
         half-height on screen is 300*size after the oval scale; putting the
         centre that far above the local dune crest would rest it exactly on
         the surface, and a bit less than that sets its foot INTO the sand,
         where the dunes in front of it cut across the bottom of the shape.
         That crossing is the whole effect — the terrain occludes it for free,
         because the ground writes depth and this does not. */
      const foot = 0.72 + hash(i, 8)*0.20;
      out.push({
        t, dur, dist, size, az,
        wx, wz,
        y: duneHeightAt(wx, wz) + 300*size*foot,
        col: SHARD_COL[i % SHARD_COL.length],
        seed: hash(i, 6)*1000
      });
    }
  }
  return out;
}

export class Desert {
  /** lookAz(t): the camera's own look-azimuth in the scene that owns this
      instance, as a pure function of time — optional, and only used to keep
      each flicker's azimuth near whatever 'forward' means at its own
      moment, so a camera that only ever sweeps a narrow arc has some chance
      of the schedule landing in front of it. Without one, az falls back to
      the full circle, which is what a scene with a free-roaming camera
      would actually want. */
  constructor(tl, lookAz, camAt){
    this.tl = tl;
    const s17 = tl.scene('S17');
    this.T0 = s17 ? s17.t : tl.timeOfBar(156);
    this.T1 = s17 ? s17.tEnd : tl.timeOfBar(176);

    this.sky   = buildSky();
    this.dunes = buildDunes();

    /* One mesh per scheduled event, rather than the single shared plane this
       had while the schedule was two events that could never overlap. The
       closing thicket runs up to five deep by design, so 'at most one is
       active' stopped being true and a shared mesh would have had to pick
       one of them to be. A pool sized to the worst overlap would also work
       and is what this would want at hundreds of events; at twenty-two,
       one each is less machinery to get wrong, and the cost is close to
       nothing — Three caches shader programs by source, so all of them
       compile to a single program and only the visible ones are ever
       drawn. */
    this.flickers = buildFlickerSchedule(tl, this.T0, lookAz,
      camAt || ((tt, out) => out.set(0, 260, 0)));
    this.flickerGroup = new THREE.Group();
    this.flickerMeshes = this.flickers.map(f => {
      const m = buildShardCluster();
      /* Portrait oval, not the plane's own square footprint — 'soikean
         muotoinen' — times this event's own size. Non-uniform scale on the
         object rather than the geometry: it is applied before the per-frame
         billboard rotation below (Three's own local transform order is
         scale then rotate then translate), so the oval stays a fixed shape
         in the plane's own frame regardless of which way that frame ends up
         facing the camera. */
      m.scale.set(0.78*f.size, 1.25*f.size, 1.0);
      m.visible = false;
      this.flickerGroup.add(m);
      return m;
    });

    this.group = new THREE.Group();
    this.group.add(this.sky, this.dunes, this.flickerGroup);

    this._col = new THREE.Color();
    this._fN = new THREE.Vector3();
    this._fR = new THREE.Vector3();
    this._fU = new THREE.Vector3();
    this._fM = new THREE.Matrix4();
    this._fQ = new THREE.Quaternion();
    this._fPos = new THREE.Vector3();
    this._up0 = new THREE.Vector3(0, 1, 0);
    this._boltDir = new THREE.Vector3(0, 1, 0);
  }

  /** Returns { pulse, bolt }: the loudest live flicker envelope and the
      current lightning intensity, both 0 when nothing is happening, so the
      scene can drive bloom and a frame-wide lift off them without keeping a
      second copy of either schedule. */
  update(t, { camera, sunDir, heat = 1, haze = 0, storm = 0 }){
    /* Recentred on the camera, not left at the origin — see buildSky's own
       note. Unsnapped, unlike the dunes below, and for the same underlying
       reason: the dome is shaded by direction alone, so moving it with the
       camera is exactly what keeps its shading still, where moving the
       ground with the camera is what made the ground move. */
    this.sky.position.copy(camera.position);
    const bolt = boltAt(t, storm, this._boltDir);
    const su = this.sky.material.uniforms;
    su.uTime.value = t;
    su.uHeat.value = heat;
    su.uHaze.value = haze;
    su.uStorm.value = storm;
    su.uBolt.value = bolt;
    su.uBoltDir.value.copy(this._boltDir);
    if (sunDir){
      this.sky.material.uniforms.uSunDir.value.copy(sunDir);
      this.dunes.material.uniforms.uSunDir.value.copy(sunDir);
    }

    const du = this.dunes.material.uniforms;
    /* SNAPPED to the vertex lattice, not set to the camera position — this is
       what actually stops the dune field moving, and it took two wrong
       answers to get here, so the reasoning is worth keeping.

       The mesh is a fixed grid that rides along under the camera, and the
       vertex shader samples the height field at (vertex + uOffset). Follow
       the camera continuously, as this did, and the sample points slide
       continuously across a height field they are far too coarse to
       reconstruct: every vertex walks smoothly through the terrain, but the
       piecewise-linear surface drawn BETWEEN them changes shape as it goes,
       because a crest that falls between two samples is cut off at a height
       that depends on exactly where the samples happen to land. The surface
       therefore ripples with a period of one grid cell of travel — here
       4.86 units at 70 units/second, about 1/14 of a second, i.e. 'muutaman
       framen välein' exactly as reported.

       Snapping uOffset and the mesh's own position to the same lattice the
       vertices sit on makes the sampled world points IDENTICAL every frame
       rather than merely nearby, so the reconstructed surface is the same
       surface — static in world space, by construction, at any camera speed
       and any grid density. The mesh then advances in whole cells; nothing
       is visible when it does, because the terrain it draws after the jump
       is the terrain it was already drawing.

       Measured, not assumed, both before and after: the sky/sand silhouette
       was tracked to sub-pixel precision across consecutive frames and its
       second difference — the frame-to-frame change in its own drift, which
       a smooth glide has almost none of — went from 0.54px, larger than the
       0.31px/frame drift itself and reversing direction 32% of the time, to
       essentially the drift alone.

       Two earlier answers to this same report were wrong and are recorded so
       the ground already covered is not covered again. The first blamed the
       ridge exponent and the mesh density (see DUNE_GLSL's note above) and
       tested by changing them; that was the right suspect but the wrong
       cure, because raising the segment count only changes the RIPPLE'S
       FREQUENCY (spacing/speed), never its amplitude, and the test being run
       looked only at amplitude. The second blamed post.js's film grain,
       whose own 12Hz update lands close enough to this ripple's ~14Hz to
       look like the same fault in a whole-frame pixel diff; turning grain
       off did remove a real spike from that measurement, which is why it was
       convincing, and left the actual rippling untouched underneath. */
    const step = this.dunes.userData.step;
    const sx = Math.round(camera.position.x/step)*step;
    const sz = Math.round(camera.position.z/step)*step;
    this.dunes.position.set(sx, 0, sz);
    du.uOffset.value.set(sx, sz);
    du.uCam.value.copy(camera.position);
    du.uTime.value = t;
    du.uHeat.value = heat;
    du.uHaze.value = haze;
    du.uStorm.value = storm;
    du.uBolt.value = bolt;
    du.uBoltDir.value.copy(this._boltDir);

    /* Every scheduled event is scanned every frame, and any number of them
       may be live at once — the closing thicket runs up to five deep on
       purpose. This used to break at the first match on the reasoning that
       'at most one flicker is ever active', which was true of a two-event
       schedule and silently wrong the moment the schedule grew; a break here
       would now drop whichever events came later in the list, which in the
       closing stretch is most of them. Twenty-two comparisons a frame is not
       worth an index for.

       The value handed back is the LOUDEST live pulse, not their sum. The
       scene spends it on bloom and a frame-wide flash, and a sum would make
       the ending's brightness a function of how many events happen to
       overlap — which is exactly the wash the thicket is arranged to avoid. */
    let pulse = 0;
    for (let k = 0; k < this.flickers.length; k++){
      const f = this.flickers[k], m = this.flickerMeshes[k];
      if (t < f.t - f.dur*0.6 || t > f.t + f.dur*1.4){ m.visible = false; continue; }
      const x = (t - f.t)/f.dur;
      /* Rise fast, hold barely, fall — a flicker, not a fade. The shard
         cluster's own growth and settling are a separate, event-local clock
         inside buildShardCluster()'s fragment shader (uTime - uStart); this
         envelope only gates overall visibility and feeds the scene's bloom. */
      const p = x < 0 ? Math.exp(-(x*x)/0.05) : Math.exp(-(x*x)/0.16);
      m.visible = p > 0.002;
      if (!m.visible) continue;
      if (p > pulse) pulse = p;
      /* Already in world coordinates — the schedule resolved the bearing
         once, against the camera position at this event's own time, and
         stood the result on the dune it landed on. See buildFlickerSchedule.
         (The convention that bearing used is forward = (sin(az), ., -cos(az)),
         not +cos(az), matching the camera's own lookAt in s17-desert.js;
         getting that sign wrong once put every event 127 degrees off the look
         direction, behind the lens rather than beside it.) */
      this._fPos.set(f.wx, f.y, f.wz);
      m.position.copy(this._fPos);
      /* Faced at the camera directly (a billboard): normal points at the
         camera from wherever the event is, right and up come from that
         normal crossed with world-up. Simpler than the old membrane-based
         version needed — buildShardCluster()'s plane is an ordinary
         PlaneGeometry with its default +Z normal, not water.js's
         rotateX(-PI/2) one, so local +Z can be handed the camera-facing
         normal directly with no axis-negation correction, and the cluster's
         own pattern is radially symmetric enough that this basis's
         handedness is not even visually distinguishable either way. The
         scratch vectors are shared across the loop because each one is
         consumed before the next iteration touches it. */
      this._fN.subVectors(camera.position, this._fPos).normalize();
      this._fR.crossVectors(this._up0, this._fN).normalize();
      this._fU.crossVectors(this._fN, this._fR);
      this._fM.makeBasis(this._fR, this._fU, this._fN);
      this._fQ.setFromRotationMatrix(this._fM);
      m.quaternion.copy(this._fQ);
      const mu = m.material.uniforms;
      mu.uTime.value = t;
      /* f.t is the envelope's CENTRE (x = (t-f.t)/dur is symmetric around
         it, rising through negative x) — not when the event starts becoming
         visible, which is f.t - dur*0.6, the same threshold the window check
         above uses. Checked directly: handing the shader f.t as uStart meant
         its own grow/settle clock read 0 right at the moment the envelope
         was already at its peak, so the cluster's shape had barely begun
         opening exactly when it should already have been fully grown. */
      mu.uStart.value = f.t - f.dur*0.6;
      mu.uDur.value = f.dur;
      mu.uSeed.value = f.seed;
      mu.uPulse.value = p;
      this._col.setRGB(...f.col);
      mu.uCol.value.copy(this._col);
    }
    return { pulse, bolt };
  }

  /* 'flicker' is the whole group now, so main.js's __mute still switches all
     of them off with one name rather than needing to know how many there
     are. */
  debugLayers(){ return { sky: this.sky, dunes: this.dunes, flicker: this.flickerGroup }; }

  dispose(){
    this.sky.geometry.dispose(); this.sky.material.dispose();
    this.dunes.geometry.dispose(); this.dunes.material.dispose();
    for (const m of this.flickerMeshes){ m.geometry.dispose(); m.material.dispose(); }
  }
}
