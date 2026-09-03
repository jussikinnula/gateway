import * as THREE from 'three';
import { NOISE } from '../core/glsl.js';

/* Floating islands (S11).
 *
 * 'Islands of earth hanging in space, each with its own thin atmosphere.
 * Waterfalls fall off their edges into nothing. Roots hang below them.'
 *
 * Five pieces. The first four are the brief; the fifth was an aurora, which
 * the shot list argues for at length — and which is now a nebula instead. The
 * argument for the aurora was that it proves a shell is an ATMOSPHERE rather
 * than a glow, and that argument still stands; what changed is that the
 * atmospheres now show the light of a star on their own limbs, which proves
 * the same thing about each body separately, and the sky was wanted for
 * something a curtain over one island could not do — putting the whole field
 * inside somewhere. See buildNebula().
 *
 *   buildBodies()  the islands. A cone below a disc, displaced — the shape is
 *                  the cliché for a reason: it is what a piece of ground looks
 *                  like when it has been torn out rather than cut.
 *
 *   buildShells()  one thin atmosphere per island. Additive, fresnel-weighted
 *                  so it is brightest at the limb, which is the only place a
 *                  shell of air is ever visible.
 *
 *   buildFalls()   water leaving an edge and thinning into vapour before it
 *                  reaches anything, because there is nothing to reach.
 *
 *   buildVines()   the curtain of growth spilling over each rim. There used
 *                  to be a second, longer population of hanging roots beside
 *                  it; see the note above buildVines() for why it is gone.
 *
 *   buildNebula()  the sky, and the volume the whole field is inside of.
 *
 * Nothing here is on the beat. The shot list was explicit about the aurora and
 * it applies to the whole world, the nebula included: 'it must NOT move to the
 * beat, which is the one thing in this film that would give it away.'
 */

function hash(i, salt){
  let x = (i*2654435761 + salt*40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}

/* The islands, laid out once. Positions are hashed rather than authored so the
   field can be regenerated identically, and spread along -Z because the camera
   travels that way through all three shots. */
const N_ISLANDS = 14;

function islandLayout(){
  const out = [];
  for (let i = 0; i < N_ISLANDS; i++){
    /* Sizes, and the SPREAD of them is the point — 'useampia eri kokoisia
       objekteja'. A field where every rock is within a factor of two of every
       other has no scale in it at all: the eye has nothing to measure against
       and reads them all as the same object at different distances. Cubing the
       hash puts most of them small and a few of them very large, which is what
       a broken-up landmass looks like. */
    const rad = 70 + Math.pow(hash(i, 5), 3)*640;
    /* And the corridor has to be kept clear OF THE SIZE, not of a constant.
       The camera flies a fixed path through this field; when the islands were
       all a couple of hundred units across, a flat 300-unit standoff was
       plenty, and the moment one of them became seven hundred across the same
       standoff put the camera inside it. Distance from the axis scales with
       the island's own radius, so a big island is far away and a small one can
       pass close — which is also the honest way to make a field read as deep. */
    /* Placed to one SIDE of the corridor or the other, not on a ring around
       it. A ring puts an island wherever the angle lands, and an angle that
       lands near zero puts a four-hundred-unit rock directly on the flight
       path — which is exactly what happened: measured, the camera passed 355
       units INSIDE island zero. The corridor is a line, so the clearance has
       to be lateral. */
    const side = hash(i, 2) < 0.5 ? -1 : 1;
    const lat = rad*1.60 + 280 + hash(i, 1)*900;
    out.push({
      x: side*lat + (hash(i, 6) - 0.5)*160,
      /* A shallow vertical spread, and it is a camera decision rather than a
         world one. The shot now orbits above the plateaus and looks slightly
         down, which is what keeps the undersides out of frame — and an island
         four hundred units higher than the camera shows its keel no matter
         where the camera is pointed. Kept within a couple of island-heights of
         each other, the field reads as a broken layer rather than as a
         scatter, which is also closer to what it is. */
      y: -170 + hash(i, 3)*360,
      z: -620 - i*300 - hash(i, 4)*280,
      rad,
      seed: hash(i, 7)
    });
  }
  separate(out);
  return out;
}

/* Pushed apart until no two of them touch.
 *
 * The placement above puts each island where its own hashes say, and two
 * hashes have no way of knowing about each other: measured, island six sat
 * three hundred and seventy units INSIDE island five, and three more pairs
 * were within a hundred units of contact. Two rocks fused into one read as a
 * modelling mistake rather than as a pair, which is the whole complaint —
 * 'muutama objekti on vielä päällekkäin tai ihan vieri vieressä'.
 *
 * A relaxation rather than a re-roll: the layout's own decisions — the size
 * spread, the side of the corridor, the shallow vertical band — are what make
 * the field read, and rejection sampling would quietly undo them. Each
 * overlapping pair is pushed apart along the line between its centres, the
 * smaller giving way more, and the corridor clearance is re-imposed after
 * every pass so the camera's path stays clear of all of it.
 *
 * The radius used is a fifth over the nominal, because the outline noise takes
 * the finished rock out past 1.3 of it and the separation has to be measured
 * against the shape that will exist, not the sphere it started as. */
function separate(isl){
  const R = o => o.rad*1.42;
  for (let pass = 0; pass < 90; pass++){
    let moved = false;
    for (let i = 0; i < isl.length; i++){
      for (let j = i + 1; j < isl.length; j++){
        const a = isl[i], b = isl[j];
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        let d = Math.hypot(dx, dy, dz);
        /* Clear air between them, and how much is set by the SMALLER of the
           two: a hundred units between two seven-hundred-unit rocks still
           reads as a pair that has been glued, and the same hundred between
           two small ones is a canyon. */
        const want = R(a) + R(b) + 0.18*Math.min(a.rad, b.rad) + 70;
        if (d >= want) continue;
        if (d < 1e-3){ dx = 1; dy = 0; dz = 0; d = 1; }
        const push = want - d;
        const wa = R(b)/(R(a) + R(b)), wb = R(a)/(R(a) + R(b));
        const ux = dx/d, uy = dy/d, uz = dz/d;
        /* Damped in the vertical. The field is meant to be a broken LAYER,
           and letting a collision throw an island four hundred units up turns
           it into a scatter — and shows its keel to a camera that is meant to
           be looking down on plateaus. */
        a.x -= ux*push*wa; a.y -= uy*push*wa*0.30; a.z -= uz*push*wa;
        b.x += ux*push*wb; b.y += uy*push*wb*0.30; b.z += uz*push*wb;
        moved = true;
      }
    }
    /* And the corridor, every pass, because a push can put one back into it. */
    for (const o of isl){
      const need = o.rad*1.60 + 280;
      if (Math.abs(o.x) < need) o.x = (o.x < 0 ? -1 : 1)*need;
    }
    if (!moved) break;
  }
}


/* How many azimuth sectors the bulge profile is measured in. Thirty-two is a
   sector every eleven degrees, which is finer than any fall is wide. */
const BULGE_SECT = 32;

/* ---------------------------------------------------------------------------
 * The rock.
 *
 * Three passes of this world were a displaced ConeGeometry, and the verdict on
 * it was that it did not look like anything: 'Sama perusongelma kuin
 * tulivuorissa, ei näytä yhtään. Kannattaa hakea koko objektia joka on
 * generoitu kivi.' It also rendered as a checkerboard of black and grey
 * triangles that survived four different attempts to fix the normals.
 *
 * Both had the same cause, and it was neither the normals nor the attribute
 * plumbing the old notes blamed. The displacement was built out of terms like
 * sin(x*y*2.7) — a PRODUCT of two coordinates, whose spatial frequency grows
 * without bound as you move away from the origin. Past a couple of units the
 * field oscillates faster than the mesh can sample it, so neighbouring
 * vertices get effectively unrelated displacements, triangles fold through
 * each other, and computeVertexNormals() faithfully reports the mess. It is
 * the undersampling trap this project has now hit in four environments, in its
 * most disguised form yet: the field was not merely too fine, it had no
 * fixed scale at all.
 *
 * So the noise here is proper 3D gradient noise, band-limited by construction,
 * and the base mesh is a subdivided icosahedron rather than a cone — uniform
 * triangles, no poles, no seam, and indexed, so smooth normals are actually
 * available. What comes out is a rock: an irregular plan outline, a flat top
 * with a hard rim, sedimentary banding on the cliffs, and a torn keel under
 * it that is nothing like a solid of revolution.
 * ------------------------------------------------------------------------ */

function hash33(x, y, z){
  let a = Math.sin(x*127.1 + y*311.7 + z*74.7)*43758.5453;
  let b = Math.sin(x*269.5 + y*183.3 + z*246.1)*43758.5453;
  let c = Math.sin(x*113.5 + y*271.9 + z*124.6)*43758.5453;
  a -= Math.floor(a); b -= Math.floor(b); c -= Math.floor(c);
  return [a*2 - 1, b*2 - 1, c*2 - 1];
}

/* Gradient noise in three dimensions, quintic fade. Zero at every lattice
   point, structure between them, and — the part that matters here — one fixed
   feature size per octave. */
function gnoise3(x, y, z){
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx*fx*fx*(fx*(fx*6 - 15) + 10);
  const uy = fy*fy*fy*(fy*(fy*6 - 15) + 10);
  const uz = fz*fz*fz*(fz*(fz*6 - 15) + 10);
  const g = (cx, cy, cz) => {
    const h = hash33(ix + cx, iy + cy, iz + cz);
    return h[0]*(fx - cx) + h[1]*(fy - cy) + h[2]*(fz - cz);
  };
  const mix = (a, b, k) => a + (b - a)*k;
  const x00 = mix(g(0,0,0), g(1,0,0), ux), x10 = mix(g(0,1,0), g(1,1,0), ux);
  const x01 = mix(g(0,0,1), g(1,0,1), ux), x11 = mix(g(0,1,1), g(1,1,1), ux);
  return mix(mix(x00, x10, uy), mix(x01, x11, uy), uz)*0.9 + 0.5;
}

/* Four octaves, each rotated in the xz plane so no two lattices stay aligned —
   the same argument core/glsl.js makes for its 2D fbm, and the same fix. */
function fbm3(x, y, z){
  let a = 0.5, sum = 0, px = x, py = y, pz = z;
  for (let i = 0; i < 4; i++){
    sum += a*gnoise3(px, py, pz);
    const rx = 0.80181*px - 0.59758*pz;
    const rz = 0.59758*px + 0.80181*pz;
    px = rx*2.07 + 7.3; py = py*2.07 - 4.1; pz = rz*2.07 + 11.7;
    a *= 0.5;
  }
  return sum;
}

/* An indexed, subdivided icosahedron. three's own IcosahedronGeometry is
   non-indexed — every triangle carries its own three vertices — so
   computeVertexNormals() on it produces FACET normals and the result is flat
   shaded no matter what else is done. Building it here keeps the sharing, and
   sharing is what makes a smooth rock possible at all. */
function icosphere(sub){
  const t = (1 + Math.sqrt(5))/2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ].map(v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0]/l, v[1]/l, v[2]/l]; });
  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];
  for (let s = 0; s < sub; s++){
    const mid = new Map(), out = [];
    const midpoint = (a, b) => {
      const key = a < b ? a*100000 + b : b*100000 + a;
      if (mid.has(key)) return mid.get(key);
      const va = verts[a], vb = verts[b];
      const m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
      const l = Math.hypot(m[0], m[1], m[2]);
      verts.push([m[0]/l, m[1]/l, m[2]/l]);
      const idx = verts.length - 1;
      mid.set(key, idx);
      return idx;
    };
    for (const [a, b, c] of faces){
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      out.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = out;
  }
  return { verts, faces };
}

/* One point of one island, from a direction on the unit sphere.
 *
 * Returns the local-space position and a `band` in 0..1 — 1 on the ground at
 * the top, 0 on the cliff and the keel — which the colouring reads. `band` is
 * computed from the UNDISPLACED latitude on purpose: read off the displaced
 * position it flips between neighbouring vertices, because the displacement on
 * a cliff is several times the width of the band the threshold spans, and the
 * island renders as a confetti of green and grey triangles. That mistake has
 * already cost this file three passes and the note is staying.
 */
/* ---- the lake's plan, decided once and used twice -----------------------
 *
 * rockPoint() carves the basin to this outline and measureCourses() reads the
 * waterline straight off it. The pass before this one MEASURED the waterline
 * instead — walking outward from the lake's centre until the ground fell
 * below the water — and a walk like that cannot tell the bowl it is looking
 * for from the hollow in the hills next to it. So on some bearings it kept
 * going, flooded the neighbour, and came back with the two-lobed blob that is
 * in the render; on others it ran into its own search cap and came back with a
 * perfectly circular arc. Both were visible at once. Deciding the shape and
 * then cutting the rock to it cannot do either, and it costs one function.
 */
function ss2(a, b, t){ const k = Math.min(1, Math.max(0, (t - a)/(b - a))); return k*k*(3 - 2*k); }

/** The basin's radius on a bearing, in the island's own frame. Sampled on a
    circle so it wraps at +-pi without a seam, like every other outline here. */
function lakeRAt(wc, ang){
  const c = Math.cos(ang), s = Math.sin(ang), f = wc.f + 1;
  return wc.lakeR*(0.87 + 0.27*fbm3(c*1.9 + f*3.1, f*1.7, s*1.9 + f*5.3));
}

/* How full the bowl is, as a fraction of how deep it was cut. */
const LAKE_FILL = 0.68;
/* And where that surface meets the bowl: the radius, as a fraction of the
   basin's, at which the cut is exactly the freeboard. Solved from the same
   curve the carve uses rather than tuned by eye, so the shore and the fill
   stay in step if either one is ever changed. */
const LAKE_SHORE_F = (() => {
  let lo = 0.12, hi = 1.0;
  for (let i = 0; i < 40; i++){
    const m = (lo + hi)/2;
    if (ss2(1, 0.12, m) > 1 - LAKE_FILL) lo = m; else hi = m;
  }
  return (lo + hi)/2;
})();

function rockPoint(px, py, pz, seed, wc){
  const th = Math.atan2(pz, px);
  const ca = Math.cos(th), sa = Math.sin(th);

  /* The plan outline. Sampled on a CIRCLE — noise at (cos, sin)*k — so it
     wraps without a seam at +-pi, which is the same trick the volcanoes' gully
     field uses. This alone is most of what stops the shape reading as a solid
     of revolution. */
  const out = 0.80 + 0.42*fbm3(ca*1.55 + seed*13.1, seed*5.5, sa*1.55 + seed*7.7);

  /* The profile. A low exponent on (1 - y^2) is what turns a sphere's top into
     a PLATEAU with a hard rim rather than a dome: the horizontal radius stays
     near its maximum until the latitude is high, then falls off a cliff. The
     underside gets a high exponent and a pinch, so it tapers into a keel. */
  let y, hr, pe = py;
  if (py >= 0){
    /* RESAMPLED, not reshaped. The profile below is exactly the one this had
       before — same radius for the same height, so the silhouette is
       untouched — but the sphere is walked across it differently, and that
       turned out to be the thing under most of the water's problems.
 
       With radius = (1 - lat^2)^0.14, a latitude of 0.4 is still at 98 per
       cent of the radius: nearly every vertex of the top hemisphere lands in
       the outer fiftieth of the deck and the middle of it is a handful of
       enormous triangles. A lake a fifth of a radius across had TWO vertices
       under it. That is why the basin came out as a crude dent whatever it
       was carved to, why the surface grid could only report a staircase, and
       why the river had to be laid on a blend of points that were not there.
 
       So the latitude is used as the PLAN RADIUS directly — vertices spread
       evenly from rim to centre — and the height is taken from the latitude
       that profile would have had at that radius. Same surface; the mesh now
       actually samples it. A lake now has forty vertices under it. */
    const pr = 1 - py;                                   // plan radius, even
    pe = Math.sqrt(Math.max(0, 1 - Math.pow(pr, 1/0.14)));  // the old latitude
    hr = pr*out;
    y = 0.15*Math.pow(pe, 0.45);
  } else {
    /* The underside, and it is the part that says these were torn out of
       something. Longer than it was by two thirds — 'kappaleiden alaosat
       voisivat olla pidempiä, ja juurimaisia' — and split into PRONGS rather
       than tapered to a single point: an angular field pinches the rock
       between the lobes and lets the lobes themselves hang lower, so the keel
       descends as several roots instead of as one carrot. The pinch and the
       drop both scale with k squared, so the split opens up as it goes down
       and the shoulder just under the rim stays solid. */
    const k = -py;
    const prong = fbm3(ca*2.9 + seed*23.0, seed*4.0, sa*2.9 + seed*19.0);
    hr = Math.pow(1 - py*py, 0.50)*out*(1 - 0.50*Math.pow(k, 1.6));
    hr *= 1 - (1 - prong)*0.62*k*k;
    y = -2.25*Math.pow(k, 1.05) - prong*1.05*k*k;
  }

  /* The rock itself, in three dimensions, and stronger underneath: the top of
     a floating island is ground and the bottom is a break. */
  const nx = px*1.9 + seed*17.0, ny = py*1.9 + seed*29.0, nz = pz*1.9 + seed*41.0;
  const lump = fbm3(nx, ny, nz) - 0.5;
  const rid = 1 - Math.abs((fbm3(nx*2.7 + 11.0, ny*2.7 + 11.0, nz*2.7 + 11.0))*2 - 1);
  /* And a third, finer term for the faces. Ridged rather than smooth, because
     a ridged field has creases in it and a smooth one only has hills — the
     difference between a rock and a beanbag. */
  const crag = 1 - Math.abs((fbm3(nx*5.4 + 31.0, ny*5.4 + 31.0, nz*5.4 + 31.0))*2 - 1);
  const below = Math.min(1, Math.max(0, -py*1.4 + 0.30));
  const disp = lump*0.38 + (rid - 0.5)*0.40*below + (crag - 0.5)*0.115;

  /* Sedimentary banding on the cliff, and only on the cliff — bands over the
     ground surface would be stripes on a lawn. Cut in the horizontal, which is
     what a bedding plane does to a rock face. */
  const side = 1 - Math.min(1, Math.abs(pe)*1.7);
  /* Bedding planes. A sine gives a corrugation; rock beds are FLAT with steps
     between them, so the wave is pushed toward a square by a power curve and
     the result terraces the cliff instead of rippling it. */
  const raw = Math.sin(y*15.0 + fbm3(nx*0.9, ny*0.9, nz*0.9)*3.4);
  const band = Math.sign(raw)*Math.pow(Math.abs(raw), 0.35);

  hr *= 1 + disp + band*0.085*side;
  /* The ground on top is not a plane either, but its relief is a tenth of the
     cliff's — it is a field, not a mountain. */
  let relief = 0;
  if (py > 0){
    /* The ground on top is not a plane and not a dome either — 'kappaleen
       sisällä voisi olla myös kumpuilevaa seutua'. Two octaves, and the finer
       one is deliberately kept at four and a half rather than six: at six its
       wavelength is three vertices of the icosphere and the hills alias into
       the facets, which is the same ceiling the cliffs have. */
    relief = (fbm3(ca*hr*2.2 + seed*3.0, 9.0, sa*hr*2.2 + seed*8.0) - 0.5)*0.200*pe
           + (fbm3(ca*hr*4.5 + seed*13.0, 4.0, sa*hr*4.5 + seed*17.0) - 0.5)*0.070*pe;
  }
  else        y += disp*0.55;

  /* Cracks in the keel, narrow and vertical, cut by a ridged field on the
     circle. They are geometry AND a placement channel: the keel list they
     produce is what the hanging growth is placed from, so what comes out of a
     fissure came out of a fissure rather than out of a hash that happened to
     land near one. */
  let crack = 0;
  if (py < 0){
    const k = -py;
    const cf = 1 - Math.abs(fbm3(ca*4.6 + seed*53.0, k*2.4, sa*4.6 + seed*67.0)*2 - 1);
    crack = Math.min(1, Math.max(0, (cf - 0.74)/0.24))*Math.min(1, k*2.2);
    hr *= 1 - crack*0.11;
  }

  let X = ca*hr, Z = sa*hr;

  /* The water's own landscape, cut into the rock rather than laid on top of
     it. Three pieces, all on the top surface only:
 
       THE BASIN. A bowl, so a flat water plane inside it cannot intersect the
       ground — which is the whole reason the lake had bites out of it.
 
       THE CHANNEL. A groove from the basin's rim outward. The river then lies
       IN something instead of on something, which is the difference between a
       river and a painted stripe.
 
       AND THE NOTCH. The channel keeps cutting all the way out, so the rim is
       lower where the water leaves. Water goes over an edge at its low point;
       carving that low point is what gives the fall a reason to be where it
       is. */
  let wet = 0;
  if (wc && py > 0){
    const lx = Math.cos(wc.la)*wc.lakeAt, lz = Math.sin(wc.la)*wc.lakeAt;
    const dl = Math.hypot(X - lx, Z - lz);
    /* The bowl is cut to the SAME outline the water is drawn on — see
       lakeRAt(). That is the whole of what makes a waterline possible to
       predict rather than to hunt for. */
    const LR = lakeRAt(wc, Math.atan2(Z - lz, X - lx));
    const basin = ss2(LR, LR*0.12, dl);
    let cut = basin;

    const rx = Math.cos(wc.la), rz = Math.sin(wc.la);
    const LR0 = lakeRAt(wc, wc.la);
    const tt = (X - lx)*rx + (Z - lz)*rz;
    if (tt > 0){
      /* Perpendicular distance to a centreline that meanders — measured
         against the bend rather than against a straight ray, or the groove and
         the ribbon drawn in it would part company halfway down. */
      const per = -(X - lx)*rz + (Z - lz)*rx;
      const bend = wc.bend*Math.sin(Math.min(1, tt/1.05)*Math.PI);
      const w = wc.chanW*(0.65 + 0.75*Math.min(1, tt/1.05));
      /* Fully cut BY THE TIME IT REACHES THE SHORE, not after it. The lake
         sits in a bowl and the bowl has a rim; a channel that only reaches
         full depth outside that rim has to leave the rim intact across the
         mouth, and the river then runs underneath its own bank for the first
         stretch and appears to begin a third of the way down the valley. The
         notch through the rim is the outlet. */
      const chan = ss2(w, w*0.25, Math.abs(per - bend))*ss2(LR0*0.15, LR0*0.60, tt);
      /* THE SILL IS AT THE WATERLINE, and that is the whole point of this
         number. A lake leaves by its lowest outlet, and the outlet is at the
         surface by definition — that IS what sets the surface. The channel
         used to be cut to a fixed fraction of the basin's depth, deeper than
         the lake's freeboard, so the groove floor at the mouth was most of a
         bowl BELOW the water it was supposed to be carrying: the ribbon lay on
         that floor and the two were visibly at different heights — 'joki on
         eri tasolla kuin järvi, ne eivät näytä olevan samaa'. So the cut
         starts at exactly the freeboard, where the groove floor and the lake
         surface are the same height, and deepens outward from there. */
      /* A little BELOW the freeboard, not exactly at it. Exactly at it and
         the mesh's own roughness leaves a hump of a unit or two across the
         mouth — and the ribbon, which may only descend, then runs underneath
         it and the river appears to start a third of the way down the
         valley. An outlet is cut slightly below the surface it drains. */
      const sill = (1 - LAKE_FILL) + 0.10;
      const cf = sill + (0.62 - sill)*ss2(LR0*0.80, LR0*2.60, tt);
      cut = Math.max(cut, chan*cf);
    }
    /* And the hills are FLATTENED where the water is.
 
       This is what was wrong with the lakes: the rolling ground is up to a
       fifth of the radius peak to trough and the basin was cut only a
       twentieth deep, so the hills swamped it. The measured waterline then
       collapsed to almost nothing on whichever bearings a hill happened to
       rise through the surface, and the lake came back as a jagged polygon
       with pieces missing — 'järvissä on artifakteja'. A basin has to be
       deeper than the terrain it is cut into, and the floor of it has to be a
       floor. */
    /* Flattened over a WIDER area than the basin is cut. A hill rising right
       at the waterline still bites a notch out of the lake however deep the
       bowl is; the ground has to be quiet for a little way beyond the shore. */
    /* And FULLY flattened inside the basin, not almost. A twelfth of the
       relief left in is still a hill a few units high standing in the shallows,
       and a flat sheet of water laid over it is cut by it — which is where the
       bites out of the lake came from. Inside the shore the ground is a floor;
       it eases back to the rolling country over the next radius out. */
    const flat = Math.max(cut, ss2(LR*1.90, LR*0.95, dl));
    y += relief*(1 - flat);
    y -= cut*wc.depth;
    wet = cut;
  } else {
    y += relief;
  }

  return { x: X, y, z: Z, crack, wet, lat: pe, pr: (py >= 0 ? 1 - py : -1),
           grass: Math.min(1, Math.max(0, (pe - 0.24)/0.20)) };
}

/* The silhouette table: bearings x altitude bands, in the island's OWN frame
   and in units of its radius. Built in buildBodies(), read by buildFalls(). */
const PROF_S = 64, PROF_B = 56, PROF_Y0 = -3.9, PROF_Y1 = 0.45;
function profBand(y){
  const k = Math.floor((y - PROF_Y0)/(PROF_Y1 - PROF_Y0)*PROF_B);
  return Math.min(PROF_B - 1, Math.max(0, k));
}
/** The furthest the rock reaches near a bearing and a height, in local units.
    Widened by a few cells in both directions on purpose: the table is filled
    from vertices, so a cell can be empty where the rock is merely thinly
    sampled, and every error here has to be outward. */
function profAt(o, localAng, localY, sectSpan = 2, bandSpan = 1){
  if (!o.prof) return 0;
  const s0 = Math.floor(((localAng + Math.PI*3)%(Math.PI*2))/(Math.PI*2)*PROF_S)%PROF_S;
  const b0 = profBand(localY);
  let m = 0;
  for (let b = b0 - bandSpan; b <= b0 + bandSpan; b++){
    if (b < 0 || b >= PROF_B) continue;
    for (let sd = -sectSpan; sd <= sectSpan; sd++){
      const sIdx = (s0 + sd + PROF_S*2)%PROF_S;
      const v = o.prof[b*PROF_S + sIdx];
      if (v > m) m = v;
    }
  }
  return m;
}

function buildBodies(isl){
  /* One geometry per island, displacement baked in, normals from the result.
     Fourteen small meshes is a rounding error against a jungle, and it buys
     genuinely different shapes rather than one shape scaled fourteen ways —
     which is the request: several objects of different sizes, each a rock. */
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  /* Five subdivisions: 10242 vertices, 20480 faces. Four was not enough, and
     the reason is the one this project keeps rediscovering — the rock detail
     has to be COARSER than the mesh sampling it, so the mesh sets the ceiling
     on how craggy the rock is allowed to be. At four subdivisions an edge is a
     ninth of the radius and anything sharper than a boulder aliased; at five
     it is a nineteenth and the cliffs can have faces. */
  const { verts, faces } = icosphere(5);

  for (let i = 0; i < isl.length; i++){
    const o = isl[i];
    const n = verts.length;
    const pos = new Float32Array(n*3);
    const col = new Float32Array(n*3);
    /* Everything that has to stand on this island later — trees, waterfalls,
       vines, roots — is placed from THESE points rather than from a formula
       about where the island probably is. The geometry is the only thing that
       knows its own shape, and anything placed by a second opinion about it
       floats. */
    const top = [], rim = [], keel = [];
    /* The widest the rock gets below the rim, per azimuth sector. The falls
       need it: a fall dropped straight down from a lip goes THROUGH the cliff
       wherever the rock below bulges out past that lip, which it does on most
       of these — the outline is irregular and the displacement is largest just
       under the shoulder. Measured from the mesh rather than assumed, because
       the mesh is the only thing that knows. */
    const bulge = new Float32Array(BULGE_SECT);
    /* And the same measurement resolved by HEIGHT as well as by bearing.
     *
     * The bulge above is one number per bearing — the widest the rock gets
     * anywhere below the rim — and a fall hung on it is pushed out past the
     * widest point of the whole cliff for the whole of its drop, or, where
     * that number is read at the wrong bearing, not pushed out at all. What
     * the water actually needs to clear is the rock AT ITS OWN HEIGHT, which
     * is a surface, not a number: sixty-four bearings by fifty-six bands of
     * altitude, each holding the furthest the rock reaches in that cell. */
    const prof = new Float32Array(PROF_S*PROF_B);
    let maxR = 0;

    for (let v = 0; v < n; v++){
      const p = verts[v];
      const q = rockPoint(p[0], p[1], p[2], o.seed, o.wc);
      pos[v*3] = q.x; pos[v*3 + 1] = q.y; pos[v*3 + 2] = q.z;

      /* Rock, with its bands showing in the colour as well as the profile, and
         grass over the top. */
      const shade = 0.80 + 0.20*Math.sin(q.y*17.0 + o.seed*9.0);
      const r = 0.088*shade, g0 = 0.079*shade, b = 0.076*shade;
      /* And the grass is not one colour. A plateau painted in a single green
         reads as a lid however good the rock under it is, which is what the
         last pass looked like from above; a slow variation with some genuinely
         dark patches in it reads as ground with things growing on parts of
         it. */
      const gv = fbm3(p[0]*3.4 + o.seed*61.0, p[1]*3.4, p[2]*3.4 + o.seed*23.0);
      /* Bare wet rock in the bed. Grass growing down the middle of the
         channel is the tell that the two were generated by different code. */
      const gr = q.grass*(0.42 + 0.58*gv)*(1 - Math.min(1, q.wet*1.6));
      col[v*3]     = r  + gr*0.042;
      col[v*3 + 1] = g0 + gr*0.165;
      col[v*3 + 2] = b  + gr*0.038;

      /* Three bands, and where they are drawn matters: `top` is the plateau
         the grass covers, `rim` is the shoulder just under it where the ground
         breaks, and `keel` is the underside. Sorted on the EFFECTIVE latitude
         q.lat, not on the sphere's own: the top hemisphere is now walked by
         plan radius rather than by latitude (see rockPoint), so p[1] no longer
         means what these thresholds were chosen against — sorting on it would
         put the band edges at a different place on the rock. q.lat is the
         latitude the old profile would have had here, which is what they were
         written for, and it is what the grass threshold uses too, so the two
         still line up by construction and vegetation cannot end up hanging off
         bare rock. */
      const lat = q.lat;
      const qr = Math.hypot(q.x, q.z);
      maxR = Math.max(maxR, qr);
      {
        const ps = Math.floor(((Math.atan2(q.z, q.x) + Math.PI*3)%(Math.PI*2))/(Math.PI*2)*PROF_S)%PROF_S;
        const pb = profBand(q.y), pi = pb*PROF_S + ps;
        if (qr > prof[pi]) prof[pi] = qr;
      }
      if (lat < 0.32){
        const sect = Math.floor(((Math.atan2(q.z, q.x) + Math.PI*3)%(Math.PI*2))/(Math.PI*2)*BULGE_SECT) % BULGE_SECT;
        bulge[sect] = Math.max(bulge[sect], Math.hypot(q.x, q.z));
      }
      if (lat > 0.40) top.push([q.x, q.y, q.z]);
      /* The shoulder, and this one is taken by PLAN RADIUS rather than by
         latitude. It is a narrow ring at the very edge of the deck, and a
         narrow ring in radius is a razor-thin band in latitude once the top is
         walked by radius — thin enough that a small island came back with an
         empty rim and the vines had nothing to hang from. */
      else if (q.pr > 0.955 && q.pr < 0.9995) rim.push([q.x, q.y, q.z]);
      else if (lat < -0.40) keel.push([q.x, q.y, q.z, q.crack]);
    }

    const idx = new Uint32Array(faces.length*3);
    for (let f = 0; f < faces.length; f++){
      idx[f*3] = faces[f][0]; idx[f*3 + 1] = faces[f][1]; idx[f*3 + 2] = faces[f][2];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();

    const m = new THREE.Mesh(geo, mat);
    m.position.set(o.x, o.y, o.z);
    m.scale.setScalar(o.rad);
    m.rotation.y = o.seed*6.28;
    m.frustumCulled = false;
    group.add(m);

    /* Kept in the layout so every other builder can reach them, already in
       WORLD space — the island's own rotation and scale applied once, here,
       rather than by four callers who each have to remember to. */
    const cy = Math.cos(m.rotation.y), sy = Math.sin(m.rotation.y);
    const toWorld = (a) => [o.x + (a[0]*cy + a[2]*sy)*o.rad,
                            o.y + a[1]*o.rad,
                            o.z + (-a[0]*sy + a[2]*cy)*o.rad];
    o.top = top.map(toWorld);
    o.rim = rim.map(toWorld);
    /* Sorted so the deepest cracks come first: whatever hangs off a rim takes
       from the front, so it hangs out of fissures rather than off flat rock. */
    keel.sort((a, b) => b[3] - a[3]);
    o.keel = keel.map(a => { const w = toWorld(a); w.push(a[3]); return w; });
    /* In world units, and in world azimuth: the mesh is rotated by the
       island's own yaw, so a sector index taken in local space would be off by
       that rotation everywhere it is used. */
    o.bulge = bulge; o.bulgeYaw = m.rotation.y; o.bulgeR = o.rad;
    /* The widest the island gets anywhere, in local units. The atmosphere is
       sized off THIS rather than off a constant: the outline noise takes some
       of these out past 1.5, and a shell scaled by a flat 1.42 left the
       plateau sticking through it — 'osassa kappaleita ilmakehä ei kata koko
       kantta'. */
    o.maxR = maxR;
    /* THE TABLE HAS HOLES IN IT, and they are exactly where the cliff is.
     *
     * Each cell holds the furthest the rock reaches at one bearing and one
     * band of altitude, filled from the vertices that land in it. On the deck
     * and the keel that is dense. On a NEAR-VERTICAL face it is not: a band is
     * a seventieth of the island's height, and where the surface is a wall the
     * vertices step past several bands at once and leave whole cells empty.
     * An empty cell reads as 'no rock here' — so a fall hung on this table was
     * told it had clearance through the middle of a cliff, and forty per cent
     * of its pixels came back drawn inside the rock. That is the blockage.
     *
     * Filled BETWEEN the topmost and bottommost hit in each bearing only:
     * inside that span a hole is a sampling gap and the rock is certainly
     * there, and outside it there is genuinely nothing to clear. */
    for (let sIdx = 0; sIdx < PROF_S; sIdx++){
      let f0 = -1, f1 = -1;
      for (let b = 0; b < PROF_B; b++) if (prof[b*PROF_S + sIdx] > 0){ if (f0 < 0) f0 = b; f1 = b; }
      if (f0 < 0) continue;
      for (let b = f0 + 1; b < f1; b++){
        if (prof[b*PROF_S + sIdx] > 0) continue;
        let a = b - 1; while (a > f0 && prof[a*PROF_S + sIdx] === 0) a--;
        let c = b + 1; while (c < f1 && prof[c*PROF_S + sIdx] === 0) c++;
        prof[b*PROF_S + sIdx] = Math.max(prof[a*PROF_S + sIdx], prof[c*PROF_S + sIdx]);
      }
    }
    o.prof = prof;
  }

  /* Two lights, and they are the only lights in the film outside a shader.
     The star this world's atmospheres catch is a long way off, so this is a
     dim key from its direction and a fill from the nebula — enough to separate a grass top from a rock
     flank and nothing like enough to look lit. */
  const key = new THREE.DirectionalLight(0x9fd4e8, 2.30);
  key.position.set(0.35, 0.62, 0.70);
  const fill = new THREE.AmbientLight(0x3d4a5a, 2.10);
  group.add(key, fill);
  group.userData.mat = mat;
  return group;
}

/* Trees per island, scaled by how much plateau there is to put them on — a
   fixed count spreads a big island thin and crowds a small one. */

/* A uniform grid over an island's top points, built once.
 *
 * Two things need to ask 'how high is the ground at (x, z)' many times — the
 * water courses and the forest — and a linear scan of two thousand vertices
 * per query is affordable for a river and not for two thousand trees. More
 * importantly the forest needs to sample the plateau UNIFORMLY BY AREA, and
 * the vertex list is not that: the icosphere's cap is evenly spaced on the
 * SPHERE, and the profile that flattens it into a plateau compresses almost
 * the whole disc into a narrow band of latitudes. Taking trees straight off
 * the vertex list therefore planted a ring of forest round the rim and left
 * the middle of every island bare, which is exactly what it looked like.
 *
 * With a grid the forest can pick a point uniformly in the disc and then ask
 * the ground where it is.
 */
function topGrid(o){
  const N = 28;
  const cells = new Array(N*N);
  const R = o.rad*1.35;
  const at = (x, z) => {
    const i = Math.min(N - 1, Math.max(0, Math.floor((x - o.x + R)/(2*R)*N)));
    const j = Math.min(N - 1, Math.max(0, Math.floor((z - o.z + R)/(2*R)*N)));
    return j*N + i;
  };
  for (const p of o.top){
    const c = at(p[0], p[2]);
    (cells[c] || (cells[c] = [])).push(p);
  }
  return { o, N, R, cells, at };
}

/** Ground height at (x, z), or null if the grid has nothing near it — which
    is how the forest knows it has wandered off the plateau. */
/* The HIGHEST the finished mesh gets near a point, not the blend of what is
   around it. gridY() is a smoothed reading and a smoothed reading cannot see a
   bump — and a bump is exactly what puts a hole in a sheet of water laid over
   it. Used only by measureCourses(), and only to be conservative with. */
function gridPeak(g, x, z, rad){
  const N = g.N, o = g.o, cw = 2*g.R/N;
  const i0 = Math.floor((x - o.x + g.R)/cw), j0 = Math.floor((z - o.z + g.R)/cw);
  const sp = Math.max(1, Math.ceil(rad/cw)), r2 = rad*rad;
  let best = null;
  for (let j = j0 - sp; j <= j0 + sp; j++){
    if (j < 0 || j >= N) continue;
    for (let i = i0 - sp; i <= i0 + sp; i++){
      if (i < 0 || i >= N) continue;
      const list = g.cells[j*N + i];
      if (!list) continue;
      for (const q of list){
        const d = (q[0] - x)*(q[0] - x) + (q[2] - z)*(q[2] - z);
        if (d <= r2 && (best === null || q[1] > best)) best = q[1];
      }
    }
  }
  return best;
}

function gridY(g, x, z){
  /* Blended over the nearest few, not the single nearest — the same staircase
     argument topYAt() makes, and the reason it matters here is that the river
     is laid on this: a ribbon following a staircase is under the ground on
     half its steps, which is why the water was in the geometry, visibly
     correct on its own, and invisible in the composite. */
  const N = g.N, o = g.o, K = 6;
  const i0 = Math.floor((x - o.x + g.R)/(2*g.R)*N);
  const j0 = Math.floor((z - o.z + g.R)/(2*g.R)*N);
  const bd = new Array(K).fill(1e18), by = new Array(K).fill(0);
  let any = false;
  for (let j = j0 - 1; j <= j0 + 1; j++){
    if (j < 0 || j >= N) continue;
    for (let i = i0 - 1; i <= i0 + 1; i++){
      if (i < 0 || i >= N) continue;
      const list = g.cells[j*N + i];
      if (!list) continue;
      for (const p of list){
        const d = (p[0] - x)*(p[0] - x) + (p[2] - z)*(p[2] - z);
        if (d < bd[K - 1]){
          let q = K - 1;
          while (q > 0 && bd[q - 1] > d){ bd[q] = bd[q - 1]; by[q] = by[q - 1]; q--; }
          bd[q] = d; by[q] = p[1]; any = true;
        }
      }
    }
  }
  /* Beyond a cell's own width there is no plateau under this point. */
  const lim = (2*g.R/N)*(2*g.R/N)*2.2;
  if (!any || bd[0] > lim) return null;
  let ws = 0, ys = 0;
  for (let i = 0; i < K; i++){
    if (bd[i] > 1e17) continue;
    const w = 1/(bd[i] + 1e-3);
    ws += w; ys += w*by[i];
  }
  return ys/ws;
}

/* Where nothing grows: the lake, and the corridor the river runs down.
   Written once because the forest and the undergrowth both need it, and two
   copies of it would drift — the tell that the plants and the water were
   generated by different code is a bush standing in the stream. */
function wetZones(o, courses){
  return courses.filter(C => C.o === o).map(C => ({
    lr: C.lakeR*o.rad*1.30, ax: C.lc[0], az: C.lc[2],
    /* Cleared along the WATER, not along the whole valley: the valley's sides
       are exactly where a wood belongs. */
    bx: C.lip[0], bz: C.lip[2], w: C.riverW*o.rad*3.0
  }));
}
function inWet(wet, x, z, k = 3.0){
  for (const W of wet){
    if (Math.hypot(x - W.ax, z - W.az) < W.lr) return true;
    /* Distance to the channel, as distance to the segment from the lake to the
       lip — the meander is inside that corridor. */
    const vx = W.bx - W.ax, vz = W.bz - W.az;
    const l2 = vx*vx + vz*vz;
    const tt = Math.min(1, Math.max(0, ((x - W.ax)*vx + (z - W.az)*vz)/l2));
    if (Math.hypot(x - (W.ax + vx*tt), z - (W.az + vz*tt)) < W.w*k) return true;
  }
  return false;
}

const TREE_DENSITY = 4400;
function treeCount(o){ return Math.max(40, Math.min(2000, Math.round(TREE_DENSITY*o.rad/700))); }

function buildTrees(isl, courses){
  /* The forest. Asked for by name — 'objektin päällä on kasvillisuutta,
     metsää, vesiputousta' — and it is the one thing that makes the top of one
     of these read as GROUND rather than as a green-painted lid.
   *
   * A canopy cone and nothing else. At the ranges this scene works at a tree
   * is a few pixels tall and a trunk is under one, so a trunk would be an
   * aliasing machine and no more; the silhouette of a stand of conifers is
   * entirely in the canopies. Instanced, one draw for the whole world.
   *
   * Placed on the island's OWN top vertices, so a tree cannot stand in the
   * air over a dip or sink into a rise. */
  const geo = new THREE.ConeGeometry(1, 2.0, 6, 1, false);
  geo.translate(0, 1.0, 0);
  /* A white per-vertex colour, and it is not decoration: three only multiplies
     instanceColor into the shaded colour when USE_COLOR is defined, which is
     to say when the material has vertexColors on — and a material with
     vertexColors on and no `color` attribute reads the attribute default,
     which is black. White here is what lets the per-instance colour through. */
  const white = new Float32Array(geo.attributes.position.count*3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(white, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

  let total = 0;
  for (const o of isl) total += Math.min(treeCount(o), o.top.length);
  const m = new THREE.InstancedMesh(geo, mat, total);
  const cols = new Float32Array(total*3);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < isl.length; i++){
    const o = isl[i];
    const g = topGrid(o);
    /* Nothing grows in the water. Without this the forest stands in the lake
       and down the middle of the river, which is the one place on the island
       the eye is certain nothing should be. */
    const wet = wetZones(o, courses);
    const count = Math.min(treeCount(o), o.top.length);
    let tries = 0;
    for (let j = 0; j < count && tries < count*8; ){
      tries++;
      /* Uniform BY AREA over the plateau: sqrt on the radius, and the height
         asked of the ground rather than taken from a vertex. A point that
         lands off the plateau is simply retried — which is also how the
         forest ends up following an irregular outline without being told
         what that outline is. */
      const rr = o.rad*1.02*Math.sqrt(hash(k*3 + tries, 43));
      const aa = hash(k*3 + tries, 44)*Math.PI*2;
      const tx = o.x + Math.cos(aa)*rr, tz = o.z + Math.sin(aa)*rr;
      const ty = gridY(g, tx, tz);
      if (ty === null) continue;
      if (inWet(wet, tx, tz)) continue;
      /* A range rather than a size. A forest of identical cones is a texture;
         the same cones at three times the spread of heights is a forest, and it
         costs nothing. */
      const th = hash(k, 42);
      const h = o.rad*(0.009 + th*th*0.042);
      v.set(tx, ty - h*0.10, tz);
      q.setFromAxisAngle(up, hash(k, 45)*6.28);
      s.set(h*0.44, h, h*0.44);
      m.setMatrixAt(k, mm.compose(v, q, s));
      const t = hash(k, 46);
      cols[k*3]     = 0.030 + t*0.020;
      cols[k*3 + 1] = 0.085 + t*0.075;
      cols[k*3 + 2] = 0.038 + t*0.022;
      k++; j++;
    }
  }
  /* Anything not placed is parked at the origin at zero scale — the instance
     count was reserved up front and an unwritten matrix is the identity, which
     would put a full-size tree in the middle of the field. */
  { const zero = new THREE.Vector3(0, 0, 0), one = new THREE.Quaternion(), sz = new THREE.Vector3(0, 0, 0);
    for (; k < total; k++) m.setMatrixAt(k, mm.compose(zero, one, sz)); }
  m.instanceMatrix.needsUpdate = true;
  m.instanceColor = new THREE.InstancedBufferAttribute(cols, 3);
  m.frustumCulled = false;
  return m;
}

function buildGas(isl){
  /* Gas INSIDE the atmosphere, which is a different thing from the shell.
   *
   * 'Voitaisiin vähän lisätä objektien biosfääreihin kaasua, eli ilmakehän
   * sisällä vähän kaasua joka aiheuttaa pienen optisen vääristymän ja
   * värjäytymän katsottuna avaruutta vasten.'
   *
   * The shell is a fresnel line: it says where the air ends and it is
   * additive, so it can only ever brighten. Air with something IN it does the
   * opposite as well — it takes the colour of what is behind it and shifts
   * it — so this layer blends normally rather than additively, and against
   * open space that reads as a tint rather than as a glow.
   *
   * Two things give it the optical quality:
   *
   *   IT IS NOT EVEN. The density is a slow three-dimensional field drifting
   *   through the shell, so the gas is banked and streaked; a star seen
   *   through a bank is dimmed and tinted and one seen through a gap is not,
   *   which is most of what makes a volume look like a volume.
   *
   *   AND ITS EDGE MOVES. The surface is displaced along its own normal by the
   *   same field, so the boundary between air and space is a soft irregular
   *   thing that shifts — the shimmer of looking through a lot of air, which
   *   is as close to refraction as anything can get without a copy of the
   *   frame behind it to bend.
   *
   * Only on the islands, not on the debris: fourteen of these is a haze and a
   * hundred and eighty is fog. */
  const geo = new THREE.SphereGeometry(1, 40, 26);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(0.35, 0.62, 0.70).normalize() },
      uSunCol: { value: new THREE.Color(1.00, 0.86, 0.72) }
    },
    vertexShader: /* glsl */`
      ${NOISE}
      ${NEBULA_GLSL}
      attribute float aIdx;
      uniform float uTime;
      uniform vec3 uSun;
      varying vec3 vN, vView, vDir, vSunV;
      varying float vIdx;
      void main(){
        vIdx = aIdx;
        vDir = normalize(position);
        /* The boundary shifts. Frequency three on a sphere carrying forty by
           twenty-six vertices is a dozen samples per feature — the field has
           to be coarser than the mesh reading it, the same ceiling everything
           in this file runs into. */
        float d = nfbm(vDir*3.0 + vec3(0.0, uTime*0.019, uTime*0.011) + vIdx*4.0);
        vec3 pp = position*(1.0 + (d - 0.5)*0.085);
        vN = normalize(mat3(instanceMatrix)*normal);
        vec4 mv = modelViewMatrix*instanceMatrix*vec4(pp, 1.0);
        vView = -mv.xyz;
        vSunV = normalize((viewMatrix*vec4(uSun, 0.0)).xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${NEBULA_GLSL}
      uniform float uTime;
      uniform vec3 uSunCol;
      varying vec3 vN, vView, vDir, vSunV;
      varying float vIdx;
      void main(){
        vec3 n = normalize(vN), v = normalize(vView);
        /* How much gas the ray goes through. Squared rather than cubed: the
           shell's own line is the sharp one, and this is the body of air
           behind it, which reaches further in. */
        float rim = pow(1.0 - abs(dot(n, v)), 3.2);
        vec3 p = vDir*2.3 + vec3(0.0, uTime*0.013, uTime*0.008) + vIdx*7.0;
        float dens = nfbm(p);
        float bank = smoothstep(0.40, 0.82, nfbm(p*2.4 + 19.0));
        /* Teal where it is thin and a warmer olive in the banks, and warmer
           again where the ray looks toward the star through it. */
        vec3 col = mix(vec3(0.16, 0.36, 0.40), vec3(0.34, 0.46, 0.33), bank);
        float fwd = pow(max(0.0, dot(-v, normalize(vSunV))), 5.0);
        col = mix(col, uSunCol*0.85, 0.18 + 0.40*fwd);
        /* Faint. The first pass at this was six times stronger and the
           atmospheres came out as glass domes — soap bubbles with a hard
           circular edge, which is the opposite of the point: a body of air is
           something you notice at the limb and do not notice anywhere else.
           Nearly all of it is in the rim term, and the rest is a suggestion. */
        float a = (0.012 + 0.75*rim)*(0.30 + 0.90*dens)*(0.55 + 0.65*bank)*0.055;
        /* And the brightest part is a BAND just inside the limb, not the limb
           itself. At the silhouette the shell simply stops, so a term that
           peaks there draws a hard circle — an outline round the island rather
           than a body of air behind one. Easing it off over the last few
           degrees puts the maximum where the ray really is longest through
           something that is still in front of the rock. */
        a *= 1.0 - 0.55*pow(rim, 3.0);
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
      }`
  });
  const m = new THREE.InstancedMesh(geo, mat, isl.length);
  const idx = new Float32Array(isl.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < isl.length; i++){
    const o = isl[i];
    v.set(o.x, o.y - o.rad*0.30, o.z);
    /* Just inside the shell, so the shell's fresnel line still reads as the
       edge of the atmosphere and this is what is held in by it. */
    const R = o.rad*Math.max(1.30, (o.maxR || 1.15)*1.22)*0.965;
    s.set(R, R*0.90, R);
    m.setMatrixAt(i, mm.compose(v, q, s));
    idx[i] = i;
  }
  m.instanceMatrix.needsUpdate = true;
  m.geometry.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
  m.frustumCulled = false;
  m.renderOrder = 3;
  return m;
}

function buildShells(isl, extra = []){
  /* The atmospheres. A sphere per island, additive, back-faces only so the
     shell is seen from outside without the near hemisphere doubling it. The
     whole effect is in the fresnel: a shell of air is invisible looking
     through it and bright looking along it, so the brightness has to go to the
     limb and nowhere else. */
  const geo = new THREE.SphereGeometry(1, 28, 20);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uLit:  { value: 0 },        // 'Everybody!' — one island lights from within
      uWhich:{ value: -1 },
      uCol:  { value: new THREE.Color(0.36, 0.72, 0.86) },
      /* The star. There is one, a long way off, and the whole reason to say so
         is the limb: 'myös ilmakehästä heijastuu auringon valo'. It is the same
         direction the Lambert key in buildBodies() uses, so the lit side of a
         shell and the lit side of the rock inside it are the same side. */
      uSun:  { value: new THREE.Vector3(0.35, 0.62, 0.70).normalize() },
      uSunCol: { value: new THREE.Color(1.00, 0.86, 0.72) }
    },
    vertexShader: /* glsl */`
      attribute float aIdx;
      uniform vec3 uSun;
      varying vec3 vN;
      varying vec3 vView;
      varying vec3 vSunV;
      varying float vIdx;
      void main(){
        vIdx = aIdx;
        vN = normalize(mat3(instanceMatrix)*normal);
        vec4 mv = modelViewMatrix*instanceMatrix*vec4(position, 1.0);
        vView = -mv.xyz;
        /* The sun has to be compared against the surface in VIEW space, since
           that is where the normal ends up; carrying the world normal through
           as well would mean maintaining two of them. */
        vSunV = normalize((viewMatrix*vec4(uSun, 0.0)).xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      uniform float uLit, uWhich;
      uniform vec3 uCol, uSunCol;
      varying vec3 vN;
      varying vec3 vView;
      varying vec3 vSunV;
      varying float vIdx;
      void main(){
        vec3 n = normalize(vN), v = normalize(vView);
        /* Limb brightening. pow on (1 - |n.v|) rather than on (1 - n.v): the
           back faces point away, and taking the absolute value is what keeps
           the rim bright instead of the whole hemisphere. */
        float rim = pow(1.0 - abs(dot(n, v)), 3.4);
        float a = rim*0.075;
        vec3 col = uCol;

        /* Sunlight, and it is two different things.
         *
         *   The LIT LIMB: air scatters most of what falls on it, so the side
         *   of the shell facing the star is far brighter than the rest of the
         *   rim. Half the rim glowing and half of it dark is the single cue
         *   that says a body is being illuminated from somewhere rather than
         *   glowing on its own — which is what the note asked for.
         *
         *   FORWARD SCATTER: looking towards the star THROUGH the air is
         *   brighter still and much warmer, because that is the direction dust
         *   and gas scatter into. It only shows on the crescent where the
         *   view ray and the sunlight nearly agree, and it is what makes a
         *   thin atmosphere read as air rather than as a painted outline. */
        vec3 sn = normalize(vSunV);
        float lit = max(0.0, dot(n, sn))*0.5 + 0.5;      // wrapped, air is thin
        float fwd = pow(max(0.0, dot(-v, sn)), 6.0);
        col = mix(col, uSunCol, 0.30 + 0.45*fwd);
        a *= 0.28 + 1.70*lit*lit;
        a += rim*fwd*0.085;
        /* One island lights from within on the cue. Compared as a distance
           rather than an equality because vIdx is interpolated. */
        float me = step(abs(vIdx - uWhich), 0.5);
        col += vec3(0.55, 0.85, 1.00)*uLit*me*1.4;
        a += uLit*me*0.10*rim;
        if (a < 0.002) discard;
        gl_FragColor = vec4(col*a, a);
      }`
  });
  /* Every floating body gets one, the small ones included — 'laita
     ilmakehäkupua kaikkiin kappaleisiin'. A field where only the large rocks
     have air reads as a field where the small ones are props. */
  const all = isl.concat(extra);
  const m = new THREE.InstancedMesh(geo, mat, all.length);
  const idx = new Float32Array(all.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < all.length; i++){
    const o = all[i];
    v.set(o.x, o.y - o.rad*0.30, o.z);
    /* Wider than the island and slightly flattened — an atmosphere is a shell
       around a body, and a sphere exactly the island's width reads as a
       bubble stuck to it. */
    const R = o.rad*Math.max(1.30, (o.maxR || 1.15)*1.22);
    s.set(R, R*0.90, R);
    m.setMatrixAt(i, mm.compose(v, q, s));
    idx[i] = i;
  }
  m.instanceMatrix.needsUpdate = true;
  m.geometry.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
  m.frustumCulled = false;
  m.renderOrder = 4;
  return m;
}

/* Two per island rather than eleven across the field, and the count follows
   the islands so a new island cannot arrive without water on it. */
const FALLS_PER = 2, FALL_SEGS = 44;


/* Where the water is, decided once.
 *
 * The lake, the river and the fall have to agree about the same course to the
 * unit, and three builders each picking their own from the same hash is
 * exactly the kind of agreement that survives until someone changes one of
 * them. So the courses are laid out here and all three read them.
 *
 * Only the big islands get water. 'Pienemmistä kappaleista poistaisin sen
 * kokonaan' — and there is a reason beyond the note: a fall is drawn at a
 * width proportional to the island, so on a small one it is a few units
 * across and renders as a scratch. A rock that size would not hold a river
 * anyway.
 *
 * And no two courses are alike: the lake's size and how far inland it sits,
 * the river's width, how much it meanders and which way, and whether the
 * island has one course or two, are all drawn per island.
 */
const WATER_MIN_RAD = 240;

/* Where the water is, decided BEFORE the rock is built — and that reordering
 * is the fix for most of what was wrong with it.
 *
 * The lake used to be a fan whose every vertex was dropped onto the terrain,
 * which makes a warped sheet, not a lake: wherever the ground rose through it
 * the surface was clipped away and the lake came back with straight-edged
 * bites taken out of it. That is what the artefacts were. A lake surface is
 * FLAT, at one height, and the reason it does not intersect the ground is that
 * the ground is a BASIN under it.
 *
 * So the rock has to know where the water is going to be, which means the
 * course cannot be chosen from the finished mesh. It is chosen here from the
 * layout alone — a bearing, a distance in, a size — and rockPoint() carves the
 * basin, the channel that leaves it and the notch in the rim where the water
 * goes over. Everything downstream then reads a shape that was made for it.
 *
 * All of these are in LOCAL units, fractions of the island's radius, because
 * that is the space rockPoint() works in.
 */
function waterCourses(isl){
  const out = [];
  for (let i = 0; i < isl.length; i++){
    const o = isl[i];
    if (o.rad < WATER_MIN_RAD) continue;
    /* One lake and one river. A catchment has one lowest point and the water
       in it leaves by one mouth; two of each side by side read as decoration
       rather than as drainage. */
    const f = i*4;
    const C = {
      o, f,
      /* The bearing the water leaves on, in the island's own frame — the same
         atan2(z, x) rockPoint() uses. */
      la: hash(f, 11)*Math.PI*2,
      lakeAt: 0.30 + hash(f, 61)*0.22,
      /* Bigger than the last pass, because the shore is now cut where the
         water is drawn rather than hunted for on the mesh — 'lisää vettä'. */
      lakeR:  0.19 + hash(f, 62)*0.13,
      /* How deep the basin is cut, and how wide and deep the channel is. */
      /* Deeper than the hills it is cut into — see the note in rockPoint(). */
      depth:  0.130 + hash(f, 63)*0.070,
      /* The VALLEY's half-width, and it is deliberately several times what
         the river in it is. The last pass cut a groove 0.05 of a radius wide
         into a mesh whose vertices are 0.053 of a radius apart: the carve
         fell between the samples and the mesh came back without it, which is
         why there was no channel in the ground and why the ribbon laid on the
         ground was buried in it. Same ceiling as the cliffs and the hills —
         the mesh decides how fine the terrain is allowed to be. */
      chanW:  0.115 + hash(f, 12)*0.055,
      /* The water in it, which has no such limit: it is its own ribbon. */
      riverW: 0.025 + hash(f, 14)*0.015,
      bend:   (hash(f, 51)*2 - 1)*0.10
    };
    o.wc = C;
    out.push(C);
  }
  return out;
}

/* The height of the plateau at a point, from the island's own top vertices.
   A nearest-point lookup rather than an evaluation of rockPoint(): the mesh
   is the surface, and a second opinion about where it is would put the water
   through it or above it. */
function topYAt(o, x, z){
  /* An inverse-distance blend of the nearest few, not the single nearest.
     The top vertices are a twentieth of a radius apart, so a nearest-point
     lookup gives a STAIRCASE — and a ribbon laid on a staircase is above the
     ground on half its steps and buried in it on the other half, which is
     exactly what the first pass drew: a river in disconnected white
     rectangles. Blending recovers a smooth surface from the same points. */
  const K = 6;
  const bd = new Array(K).fill(1e18), by = new Array(K).fill(0);
  for (const p of o.top){
    const d = (p[0] - x)*(p[0] - x) + (p[2] - z)*(p[2] - z);
    if (d < bd[K - 1]){
      let j = K - 1;
      while (j > 0 && bd[j - 1] > d){ bd[j] = bd[j - 1]; by[j] = by[j - 1]; j--; }
      bd[j] = d; by[j] = p[1];
    }
  }
  let ws = 0, ys = 0;
  for (let i = 0; i < K; i++){
    const w = 1/(bd[i] + 1e-3);
    ws += w; ys += w*by[i];
  }
  return ys/ws;
}


/* A stone. Not an island.
 *
 * These used to be built with rockPoint(), which is the ISLAND shape — a
 * plateau over a keel — scaled down and squashed. Sunk a third of the way into
 * the ground, what was left above it was the flat top of a tiny plateau, and
 * close to the camera the banks of the river were strewn with what read
 * unmistakably as lily pads. A boulder has no up and no down and no profile;
 * it is a sphere with the lumps beaten into it, which is all this is. */
function boulderPoint(px, py, pz, seed){
  const nx = px*2.2 + seed*17.0, ny = py*2.2 + seed*29.0, nz = pz*2.2 + seed*41.0;
  const lump = fbm3(nx, ny, nz) - 0.5;
  const rid  = 1 - Math.abs(fbm3(nx*2.6 + 11.0, ny*2.6 + 11.0, nz*2.6 + 11.0)*2 - 1);
  /* Ridged for the creases, the same reason the cliffs use one: a smooth field
     has hills in it and a ridged field has edges. */
  const crag = 1 - Math.abs(fbm3(nx*5.1 + 31.0, ny*5.1 + 31.0, nz*5.1 + 31.0)*2 - 1);
  const r = 1 + lump*0.44 + (rid - 0.5)*0.30 + (crag - 0.5)*0.15;
  return { x: px*r, y: py*r, z: pz*r, up: Math.max(0, py) };
}

const LIP_ROCKS = 9, BANK_ROCKS = 40;

/* Everything under the trees.
 *
 * 'Objekteissa joissa on puita, voisi lisätä puiden joukkoon vähän muuta
 * pienkasvillisuutta ja yksityiskohtia.' A wood drawn as canopies alone reads
 * as a pattern stamped on a lawn, and the reason is that there is exactly one
 * size of thing on the ground: every object in frame is a cone the same few
 * pixels tall, so the eye has nothing to build a scale out of. What fixes it
 * is not more trees but SMALLER things between them — scrub, low bushes, a few
 * stones — at a quarter of a tree and three times the number, so the ground
 * has two scales on it instead of one.
 *
 * A faceted blob rather than a cone: undergrowth is round and a conifer is
 * not, and at this range the silhouette is all there is to tell them apart.
 * Wide and low ones read as bushes, taller ones as scrub, and the handful
 * given a grey colour read as stones lying in the grass. */
const SCRUB_PER_TREE = 2.4;

function buildUndergrowth(isl, courses){
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const white = new Float32Array(geo.attributes.position.count*3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(white, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

  let total = 0;
  for (const o of isl) total += Math.round(Math.min(treeCount(o), o.top.length)*SCRUB_PER_TREE);
  const m = new THREE.InstancedMesh(geo, mat, total);
  const cols = new Float32Array(total*3);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < isl.length; i++){
    const o = isl[i];
    const g = topGrid(o);
    const wet = wetZones(o, courses);
    const count = Math.round(Math.min(treeCount(o), o.top.length)*SCRUB_PER_TREE);
    let tries = 0;
    for (let j = 0; j < count && tries < count*8; ){
      tries++;
      const rr = o.rad*1.02*Math.sqrt(hash(k*5 + tries, 91));
      const aa = hash(k*5 + tries, 92)*Math.PI*2;
      const tx = o.x + Math.cos(aa)*rr, tz = o.z + Math.sin(aa)*rr;
      const ty = gridY(g, tx, tz);
      if (ty === null) continue;
      /* Closer to the water than the trees are allowed: scrub is what grows on
         a bank. */
      if (inWet(wet, tx, tz, 1.5)) continue;
      const th = hash(k, 93);
      const h = o.rad*(0.0014 + th*th*th*0.0105);
      const wide = 0.85 + hash(k, 94)*1.15;
      const tall = 0.40 + hash(k, 95)*0.85;
      v.set(tx, ty + h*tall*0.35, tz);
      q.setFromAxisAngle(up, hash(k, 96)*6.28);
      s.set(h*wide, h*tall, h*wide*(0.75 + hash(k, 97)*0.5));
      m.setMatrixAt(k, mm.compose(v, q, s));
      const t = hash(k, 98), stone = hash(k, 99);
      if (stone > 0.93){
        /* A stone, and the same grey the boulders use so the two read as the
           same rock at two sizes. */
        const gv = 0.055 + t*0.030;
        cols[k*3] = gv; cols[k*3 + 1] = gv*1.02; cols[k*3 + 2] = gv*1.05;
      } else {
        /* And the green is not the forest's green. Undergrowth catches more
           light than a canopy does and it is more olive than blue, which is
           what separates the two layers instead of making one look like small
           copies of the other. */
        cols[k*3]     = 0.044 + t*0.042;
        cols[k*3 + 1] = 0.092 + t*0.086;
        cols[k*3 + 2] = 0.036 + t*0.026;
      }
      k++; j++;
    }
  }
  { const zero = new THREE.Vector3(0, 0, 0), one = new THREE.Quaternion(), sz = new THREE.Vector3(0, 0, 0);
    for (; k < total; k++) m.setMatrixAt(k, mm.compose(zero, one, sz)); }
  m.instanceMatrix.needsUpdate = true;
  m.instanceColor = new THREE.InstancedBufferAttribute(cols, 3);
  m.frustumCulled = false;
  return m;
}

function buildBoulders(isl, courses){
  /* Rocks, at the two places where bare ground reads as unfinished.
   *
   *   AT THE LIP. 'Vesiputouksen alkukohta ... ei ole oikean näköinen.' It was
   *   not: the river simply stopped and the fall began, on a smooth edge, with
   *   nothing to say why the water leaves there and not two hundred units
   *   along. A lip is where the rock is hardest — that is WHY the water goes
   *   over it there — so it is the one part of an edge that has boulders on
   *   it, and putting them there gives the fall a reason and a foreground.
   *
   *   ALONG THE BANKS. A river with a clean edge is a canal. The rocks are
   *   what a channel throws out of itself.
   *
   * Same rock as everything else here, from the same function at the coarsest
   * subdivision — three shapes is enough at this size, and the scale and yaw
   * per instance hide the repeat.
   */
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const { verts, faces } = icosphere(2);
  const idx = new Uint32Array(faces.length*3);
  for (let f = 0; f < faces.length; f++){
    idx[f*3] = faces[f][0]; idx[f*3 + 1] = faces[f][1]; idx[f*3 + 2] = faces[f][2];
  }

  /* Where they go, gathered first so each shape knows its own count. */
  const sites = [];
  for (const C of courses){
    const o = C.o;
    const dirX = C.dir[0], dirZ = C.dir[1];
    const px = -dirZ, pz = dirX;
    const g = C.grid;

    for (let i = 0; i < LIP_ROCKS; i++){
      /* EITHER SIDE OF THE WATER, never across it. These used to be scattered
         over a band centred on the lip, which put a third of them in the
         middle of the notch — and since the water writes no depth, a stone
         standing in the stream is drawn straight through it and reads as a
         boulder floating on the surface. The fall leaves the lip half its own
         sheet-width wide either way, so the stones start outside that and go
         further out; what they are for is the shoulders the water leaves
         BETWEEN, which is what a lip looks like. */
      const sd = (i & 1) ? 1 : -1;
      const rs = o.rad*(0.016 + hash(C.f*31 + i, 83)*0.032);
      const across = sd*(C.fw*1.9 + hash(C.f*31 + i, 81)*C.fw*1.7 + rs*0.7);
      /* Some sit back from the edge and some overhang it. */
      const along = (hash(C.f*31 + i, 82) - 0.35)*C.fw*2.2;
      const bx = C.lip[0] + px*across + dirX*along;
      const bz = C.lip[2] + pz*across + dirZ*along;
      const gy = gridY(g, bx, bz);
      sites.push({ x: bx, y: (gy === null ? C.lip[1] : gy), z: bz,
                   s: rs, seed: hash(i, 84) });
    }

    const t0 = LAKE_SHORE_F*lakeRAt(C, C.la)*o.rad;
    for (let i = 0; i < BANK_ROCKS; i++){
      const u = 0.05 + (i/BANK_ROCKS)*0.92;
      const t = t0 + (C.lipT - t0)*u;
      const bend = C.bend*o.rad*Math.sin(Math.min(1, t/(1.05*o.rad))*Math.PI);
      const cx = C.lc[0] + dirX*t + px*bend;
      const cz = C.lc[2] + dirZ*t + pz*bend;
      const side = (i & 1) ? 1 : -1;
      /* ON the banks, and that means CLEAR OF THE WATER. The ribbon's own
         half-width here is riverW*(0.80 + 0.55u) and its drawn edge wanders a
         further quarter out on the shader's own noise, so anything inside
         about 1.6 of that is under the stream — and a stone under a surface
         that writes no depth is a stone drawn on top of it. Hence the clear
         margin, and the stone's own radius on top of that so it is beside the
         water rather than leaning into it. */
      const rs = o.rad*(0.005 + hash(C.f*57 + i, 86)*0.016);
      const w = o.rad*C.riverW*(0.80 + 0.55*u)*1.60
              + rs*1.15 + o.rad*C.riverW*hash(C.f*57 + i, 85)*1.1;
      const bx = cx + px*side*w, bz = cz + pz*side*w;
      const gy = gridY(g, bx, bz);
      if (gy === null) continue;
      sites.push({ x: bx, y: gy, z: bz, s: rs, seed: hash(i, 87) });
    }
  }

  const SHAPES = 3;
  for (let sh = 0; sh < SHAPES; sh++){
    const seed = 0.11 + sh*0.27;
    const n = verts.length;
    const pos = new Float32Array(n*3), col = new Float32Array(n*3);
    for (let v = 0; v < n; v++){
      const p = verts[v];
      const q = boulderPoint(p[0], p[1], p[2], seed);
      pos[v*3] = q.x; pos[v*3 + 1] = q.y*0.80; pos[v*3 + 2] = q.z;
      const shade = 0.78 + 0.22*Math.sin(q.y*17.0 + seed*9.0);
      /* A little moss on what faces up, and nothing like the plateau's green —
         a boulder in a river is wet rock, not a lawn. */
      const gr = q.up*0.30;
      col[v*3]     = 0.105*shade + gr*0.030;
      col[v*3 + 1] = 0.098*shade + gr*0.090;
      col[v*3 + 2] = 0.094*shade + gr*0.028;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
    geo.computeVertexNormals();

    const mine = sites.filter((_, i) => i % SHAPES === sh);
    if (!mine.length) continue;
    const m = new THREE.InstancedMesh(geo, mat, mine.length);
    const mm = new THREE.Matrix4(), q4 = new THREE.Quaternion();
    const v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < mine.length; i++){
      const d = mine[i];
      /* Sunk a third into the ground: a rock resting exactly on a surface
         reads as a prop placed on it. */
      v3.set(d.x, d.y - d.s*0.22, d.z);
      q4.setFromAxisAngle(up, d.seed*6.28);
      s3.set(d.s*(0.85 + hash(i, 88)*0.5), d.s*(0.7 + hash(i, 89)*0.5),
             d.s*(0.85 + hash(i, 90)*0.5));
      m.setMatrixAt(i, mm.compose(v3, q4, s3));
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    group.add(m);
  }
  group.userData.mat = mat;
  return group;
}


/* What the finished rock says about each course.
 *
 * The carve above decides where the water goes; only the mesh knows what
 * height that turned out to be, and three numbers have to come from it:
 *
 *   THE WATER LEVEL. Flat, one value, taken from the basin's floor plus a
 *   fill. This is what makes the lake a lake rather than a warped sheet.
 *
 *   THE WATERLINE. Where that flat plane meets the bowl, found by walking out
 *   along a few bearings until the ground rises through it. Guessing a radius
 *   instead is how a lake ends up with its edge hanging in the air on one side
 *   and buried on the other.
 *
 *   THE LIP. Where the plateau actually stops along the channel — walked
 *   outward until the ground falls away. The river ends there and the fall
 *   starts there, which is the only way the two can meet: the old version ran
 *   the ribbon to a rim VERTEX, which is already on the cliff, so the last
 *   quads of the river stuck out into the air as a flat white slab. That slab
 *   is the 'putouksen huuli' in the report.
 */
function measureCourses(courses){
  for (const C of courses){
    const o = C.o, g = topGrid(o);
    C.grid = g;
    const lx = o.x + Math.cos(C.la)*C.lakeAt*o.rad;
    const lz = o.z + Math.sin(C.la)*C.lakeAt*o.rad;
    /* World-space bearing: the mesh is rotated by the island's own yaw, so the
       carve's local bearing has to be turned into it. */
    const wa = C.la - o.bulgeYaw;
    C.dir = [Math.cos(wa), Math.sin(wa)];
    /* The carve is in local space; rotate the lake's centre with it. */
    const cy = Math.cos(o.bulgeYaw), sy = Math.sin(o.bulgeYaw);
    const rlx = Math.cos(C.la)*C.lakeAt*o.rad, rlz = Math.sin(C.la)*C.lakeAt*o.rad;
    C.lc = [o.x + rlx*cy + rlz*sy, 0, o.z - rlx*sy + rlz*cy];
    /* The floor: the LOWEST the grid gets inside the bowl, not the single
       sample at its centre. The grid's cells are a fourteenth of a radius and
       the flat part of the floor is smaller than one of them, so the centre
       sample is a blend that sits above the true bottom — and a water level
       measured from it floats. */
    let floor = null;
    for (let i = 0; i < 9; i++){
      const a = i*2.4, r = (i === 0 ? 0 : C.lakeR*o.rad*0.30);
      const yy = gridY(g, C.lc[0] + Math.cos(a)*r, C.lc[2] + Math.sin(a)*r);
      if (yy !== null && (floor === null || yy < floor)) floor = yy;
    }
    C.level = (floor === null ? o.y : floor) + C.depth*o.rad*LAKE_FILL;

    /* The waterline. Read off the outline the bowl was cut to, not hunted for
       on the finished mesh — see lakeRAt(). The carve is in the island's own
       frame and this is in the world's, so the bearing is turned into it
       before the outline is asked about it, and the result is pulled in by
       three per cent: the grid the level was measured on is a smoothed
       version of the mesh, and of the two ways that can be wrong, a lake that
       stops a little short of its shore is a wet margin and a lake that
       overshoots it is a bite out of the water. */
    C.shore = [];
    const N = 72;
    const an = [];
    for (let i = 0; i < N; i++){
      const a = (i/N)*Math.PI*2;
      an.push(LAKE_SHORE_F*lakeRAt(C, a + o.bulgeYaw)*o.rad*0.97);
    }

    /* Two corrections, and between them they are what stops the water having
       holes in it. Both are bounded — neither can take the lake anywhere the
       carve did not put it, which is the trap the measuring version fell into.
 
       THE LEVEL comes up to clear the highest the mesh actually reaches inside
       the bowl. The bowl is analytic and smooth; the mesh that carries it is
       not, and cannot be — at five subdivisions the vertices are a nineteenth
       of a radius apart and a lake is only five or six of them across, so the
       triangles chord across the bottom and the rock's own displacement puts a
       wrinkle in the floor that the flattening does not reach. Both leave rock
       standing above an analytically correct waterline, and rock standing
       above a waterline is the bite out of the lake.
 
       AND THE SHORE comes IN, per bearing, wherever the ground at that bearing
       is still above the water. Inward only, never out: the search starts on
       the outline the basin was cut to and can only give ground back. */
    /* Wide enough to always contain a vertex: at five subdivisions they are a
       nineteenth of a radius apart, and a probe narrower than that comes back
       empty most of the time and reads as "no ground here". */
    /* Both read straight off the vertices, in a fan of bearing bins.
 
       The pass before this asked a disc-shaped probe for the highest ground
       near a point, and the probe had to be as wide as the old vertex spacing
       to find anything at all — which meant that a sample well inside the
       lake reported the BANK, three spacings away and most of a bowl higher.
       The level was then lifted to clear a bank that was never under the
       water, the bowl filled to the brim, and the lake came out flush with
       the field around it: 'järvet leijuvat ilmassa, eivät ole kuopassa'. The
       measurement was wrong, not the carve.
 
       Now the deck is evenly sampled there are a couple of hundred vertices
       under a lake, so nothing has to be probed for: the vertices near the
       lake are sorted into bearing bins and each bin is its own radial
       profile of the ground. */
    const bins = [];
    for (let i = 0; i < N; i++) bins.push([]);
    const anMax = Math.max(...an);
    for (const q of o.top){
      const dx = q[0] - C.lc[0], dz = q[2] - C.lc[2];
      const d = Math.hypot(dx, dz);
      if (d > anMax*1.30) continue;
      const b = Math.floor((((Math.atan2(dz, dx) + Math.PI*2)%(Math.PI*2))/(Math.PI*2))*N)%N;
      bins[b].push([d, q[1]]);
    }
    /* The highest the ground gets WELL INSIDE the lake — the part that has to
       be under water whatever the mesh did with the bowl. */
    let peak = null;
    for (let i = 0; i < N; i++){
      for (const [d, y] of bins[i]){
        if (d <= an[i]*0.88 && (peak === null || y > peak)) peak = y;
      }
    }
    C.levelAnalytic = C.level;
    if (peak !== null) C.level = Math.max(C.level, peak + C.depth*o.rad*0.020);

    /* And the shore comes in, per bearing, to just inside the nearest vertex
       that is still above the water. Inward only, from the outline the basin
       was cut to. */
    for (let i = 0; i < N; i++){
      let r = an[i];
      for (let b = -1; b <= 1; b++){
        for (const [d, y] of bins[(i + b + N)%N]){
          if (y > C.level && d < r) r = d*0.94;
        }
      }
      C.shore.push(Math.max(r, an[i]*0.45));
    }
    /* Smoothed round the circle: the walk moves in three-and-a-half per cent
       steps, so two neighbouring bearings can differ by a step on a perfectly
       smooth bank, and a fan built on that has a saw edge. */
    const walked = C.shore.slice();
    for (let pass = 0; pass < 2; pass++){
      const src = C.shore.slice();
      for (let i = 0; i < N; i++){
        C.shore[i] = (src[(i + N - 1)%N] + src[i]*2 + src[(i + 1)%N])/4;
      }
    }
    /* Smoothing averages, and an average can push a bearing back OUT over the
       bump the walk just backed away from. Clamped to what the walk found. */
    for (let i = 0; i < N; i++) C.shore[i] = Math.min(C.shore[i], walked[i]);

    /* And the lip: outward along the channel until the plateau runs out —
       ALONG THE MEANDER, not along the straight ray.
 
       This is where the fall and the river parted company. The ribbon is drawn
       on a centreline that bends, by up to a tenth of a radius at its widest;
       the lip was walked straight out from the lake, so the point the fall was
       hung on and the point the river actually ended at were that far apart,
       and the water went over the edge somewhere the stream never reached. Two
       measurements of the same curve, taken differently — the recurring shape
       of every bug in this file. */
    const dx = C.dir[0], dz = C.dir[1], px = -dz, pz = dx;
    const bendAt = t => C.bend*o.rad*Math.sin(Math.min(1, t/(1.05*o.rad))*Math.PI);
    let t = C.lakeR*o.rad, lastY = C.level, lastT = t;
    for (let k = 0; k < 200; k++){
      const b = bendAt(t);
      const yy = gridY(g, C.lc[0] + dx*t + px*b, C.lc[2] + dz*t + pz*b);
      if (yy === null) break;
      lastY = yy; lastT = t;
      t += o.rad*0.012;
    }
    const lb = bendAt(lastT);
    C.lip = [C.lc[0] + dx*lastT + px*lb, lastY, C.lc[2] + dz*lastT + pz*lb];
    C.lipT = lastT;
    /* The fall is the river's own width, near enough. It used to be two and
       a half times it, which was survivable while the ribbon was a plane at a
       fixed bearing and usually seen at an angle; now that it turns to face
       the camera it shows all of that width all of the time, and at the old
       number it read as a searchlight rather than as water. */
    C.fw = o.rad*C.riverW*1.35;
    C.len = o.rad*(0.9 + hash(C.f, 13)*1.3);
    C.ang = Math.atan2(C.lip[0] - o.x, C.lip[2] - o.z);
    C.ang0 = Math.atan2(C.lip[2] - o.z, C.lip[0] - o.x);
    /* The outward direction FROM THE ISLAND'S CENTRE, which is not the
       direction the channel runs in — the lake is offset, so the channel's
       bearing from the lake and the lip's bearing from the island differ by
       twenty or thirty degrees. buildFalls() was hanging the water on the
       channel's bearing, which put it that far round the rim from the lip it
       was supposed to be leaving: on several islands that is inside the rock,
       which is where the falls went. */
    const ox = C.lip[0] - o.x, oz = C.lip[2] - o.z;
    C.lipR = Math.hypot(ox, oz);
    C.outDir = [ox/C.lipR, oz/C.lipR];
    /* How far out the water ends up hanging, decided HERE rather than inside
       buildFalls, because two builders need it and a number computed twice is
       a number that will disagree with itself. buildDebris keeps the floating
       rocks out of this column; buildFalls flies the water down it. */
    {
      const locA = C.ang0 + o.bulgeYaw;
      const sect = Math.floor(((locA + Math.PI*3)%(Math.PI*2))/(Math.PI*2)*BULGE_SECT)%BULGE_SECT;
      let bulge = 0;
      for (let b = -2; b <= 2; b++) bulge = Math.max(bulge, o.bulge[(sect + b + BULGE_SECT*2)%BULGE_SECT]);
      C.outR = Math.max(C.lipR, bulge*o.bulgeR) + C.fw*2.0;
    }
  }
}

const RIVER_SEGS = 30, LAKE_SEGS = 26;

function buildWater(courses){
  /* The lake is FLAT and the river lies in its groove.
   *
   * The lake is a fan at ONE height — the measured water level — with its rim
   * on the measured waterline, so it meets the bowl instead of cutting through
   * it. The last version dropped every vertex of it onto the terrain, which is
   * a warped sheet: wherever the ground rose through it the surface was
   * clipped and the lake came back with straight-edged bites out of it. Those
   * were the artefacts.
   *
   * The river runs down the carved channel and STOPS AT THE LIP, which is
   * where the plateau stops. It used to run to a rim vertex, already on the
   * cliff, so its last quads projected into the air as a flat slab hanging
   * over the edge.
   */
  const pos = [], uvs = [], kind = [], run = [], idx = [];
  let base = 0;

  for (const C of courses){
    const o = C.o;

    /* --- the lake: a flat fan on the measured shore ---------------------- */
    const centreIdx = base;
    pos.push(C.lc[0], C.level, C.lc[2]);
    uvs.push(0.5, 0.0); kind.push(0);
    const N = C.shore.length;
    for (let i = 0; i <= N; i++){
      const a = (i % N)/N*Math.PI*2;
      const r = C.shore[i % N];
      pos.push(C.lc[0] + Math.cos(a)*r, C.level, C.lc[2] + Math.sin(a)*r);
      uvs.push(0.5, 0.0); kind.push(1); run.push(0);
      if (i < N) idx.push(centreIdx, centreIdx + 1 + i, centreIdx + 2 + i);
    }
    base += N + 2;

    /* --- the river: lake shore to lip, in the groove --------------------- */
    const dx = C.dir[0], dz = C.dir[1];
    const px = -dz, pz = dx;
    /* Starts AT the waterline on the channel's own bearing, so the ribbon
       comes out of the lake instead of beginning somewhere past it. */
    const t0 = LAKE_SHORE_F*lakeRAt(C, C.la)*o.rad*0.90, t1 = C.lipT;
    /* The centreline first, then the SURFACE, and the surface is the part
       that was wrong. A river's surface is not the ground it runs over — it
       is a monotonically descending sheet that starts at the level of the
       lake it drains. Laying the ribbon on the terrain plus a fixed lift gave
       it the terrain's own steps, and at the mouth it started most of a
       bowl-depth below the lake, which is why the two never looked like the
       same body of water. It now leaves the lake AT the lake's height and can
       only ever go down. */
    const cxs = [], czs = [], gys = [], hws = [];
    for (let i = 0; i <= RIVER_SEGS; i++){
      const u = i/RIVER_SEGS;
      const t = t0 + (t1 - t0)*u;
      /* The same meander the carve used, so the ribbon stays in its own
         groove — written once there and mirrored here, in world units. */
      const bend = C.bend*o.rad*Math.sin(Math.min(1, t/(1.05*o.rad))*Math.PI);
      cxs.push(C.lc[0] + dx*t + px*bend);
      czs.push(C.lc[2] + dz*t + pz*bend);
      const gy = gridY(C.grid, cxs[i], czs[i]);
      /* At the very lip the ground has run out; fall back to the lip's own
         height rather than dropping the segment. */
      gys.push(gy === null ? C.lip[1] : gy);
      hws.push(o.rad*C.riverW*(0.80 + 0.55*u)*(1 - 0.42*ss2(0.82, 1.0, u)));
    }
    /* How long the stream is in units of its own width — the shader needs it
       for the same reason the fall does: a fixed number of noise cells down a
       ribbon whose length is ten times its width makes cells ten times too
       tall, and a cell ten times too tall is not a ripple, it is a rail. */
    const aspect = (t1 - t0)/Math.max(1e-3, o.rad*C.riverW*2.2);
    /* And the sheet rides higher than it did. The clearance measured
       against the finished mesh was a unit or two at its tightest, which is
       inside the error of everything that produced it — and a river that is
       one unit clear of its bed is a river that gets cut by it on the next
       triangle. A tenth of the channel's own depth costs nothing to look at
       and takes the margin out of the noise. */
    const lift = o.rad*0.015;
    const ys = new Array(RIVER_SEGS + 1);
    /* THE SURFACE IS A SUFFIX MAXIMUM, and that one line is what stops the
       river disappearing into the ground.
 
       Two things have to be true at once and the last version could only
       manage one of them. The sheet may never climb — water does not run
       uphill, and a single segment that does is the first thing the eye
       catches. And it may never be BELOW the rock, or the terrain simply
       occludes it and the stream vanishes mid-slope into the hillside, which
       is what 'vesi katoaa kiven sisään' was looking at.
 
       Taking a running MINIMUM downstream satisfies the first and breaks the
       second: once the sheet has dropped it cannot come back up, so any bump
       further down buries it. Taking the running maximum BACKWARDS from the
       mouth satisfies both — the height at each station is the highest ground
       anywhere downstream of it, which is by construction non-increasing AND
       never under the rock. Physically it is also right: that is what a
       stream does when something downstream dams it, which is to say it
       ponds.
 
       And the clearance is measured against the highest VERTEX near the
       centreline rather than against the smoothed grid. The grid is a blend
       and a blend cannot see a bump; the triangles between the vertices are
       always below the highest of them, so a maximum over the ribbon's own
       width is conservative in the only direction that matters. */
    const req = new Array(RIVER_SEGS + 1);
    for (let i = 0; i <= RIVER_SEGS; i++){
      /* The probe reaches a vertex spacing PAST the ribbon's own edge. A
         triangle whose vertices are outside the ribbon can still have its
         interior underneath it, so a probe that stops at the water's edge
         misses exactly the rock that cuts it. */
      const pk = gridPeak(C.grid, cxs[i], czs[i], hws[i] + o.rad*0.028);
      const base = (pk === null ? gys[i] : Math.max(pk, gys[i]));
      /* A little more clearance at the mouth, where the sheet has to get over
         the rim rather than merely over the bed. */
      req[i] = base + lift*(1.0 + 0.9*ss2(0.65, 1.0, i/RIVER_SEGS));
    }
    ys[RIVER_SEGS] = req[RIVER_SEGS];
    for (let i = RIVER_SEGS - 1; i >= 0; i--) ys[i] = Math.max(req[i], ys[i + 1]);
    /* It leaves the lake at the lake's height when it can. If the envelope
       above is already higher, the envelope wins: raising the first vertex
       only ever adds to a value that is already the largest, so the sheet
       stays non-increasing either way. */
    ys[0] = Math.max(ys[0], C.level);
    /* The height the fall starts at: the ribbon's own last vertex, so the two
       are the same sheet of water. */
    C.lipY = ys[RIVER_SEGS];
    for (let i = 0; i <= RIVER_SEGS; i++){
      const u = i/RIVER_SEGS;
      const cx = cxs[i], cz = czs[i], y = ys[i];
      /* The ribbon is narrower than the groove it lies in — a wet bank either
         side — but not so much narrower that it is two pixels wide at the
         range this scene actually looks from. Widening as it goes, then drawn
         in again at the very end: water speeds up as the ground tips over the
         edge and a stream that speeds up narrows. */
      const w = hws[i];
      pos.push(cx - px*w, y, cz - pz*w, cx + px*w, y, cz + pz*w);
      uvs.push(0, u, 1, u); kind.push(2, 2); run.push(aspect, aspect);
      if (i < RIVER_SEGS){
        const a = base + i*2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += (RIVER_SEGS + 1)*2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(kind), 1));
  geo.setAttribute('aRun', new THREE.BufferAttribute(new Float32Array(run), 1));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aKind;
      attribute float aRun;
      varying float vRun;
      varying vec2 vUv; varying float vKind; varying vec3 vW;
      void main(){ vUv = uv; vKind = aKind; vW = position; vRun = aRun;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      uniform float uTime;
      varying vec2 vUv; varying float vKind; varying vec3 vW; varying float vRun;
      void main(){
        bool river = vKind > 1.5;
        /* What made the last pass read as fog rather than as water was not
           the colour of the water — it was that the water was BRIGHTER AND
           FLATTER THAN THE LAND. The ground here is a dark green; a smooth
           lavender disc laid on it with a soft edge is a cloud lying in a
           field, and no amount of tinting fixes that. Water reads as water
           through three things, and all three are about contrast:
 
             It is DARK. A lake is a hole that lets almost nothing back out.
             The base here sits at about the value of the forest around it,
             not four times it.
 
             It SPARKLES. What comes back out is the nebula, off crests, in
             small bright pieces — so the surface is dark with highlights on
             it rather than an even wash, and the highlights are what the eye
             reads as a liquid.
 
             And it ENDS. The shore was a fade over nearly half the radius,
             which is what dissolved the outline into vapour. A waterline is
             an edge. */
        vec3 deep = vec3(0.010, 0.024, 0.045);
        vec3 sky  = vec3(0.30, 0.20, 0.42);       // the nebula, on the surface
        vec3 lit  = vec3(0.66, 0.80, 0.94);

        float a, glint = 0.0, foam = 0.0, lip = 0.0;
        if (river){
          float across = abs(vUv.x - 0.5)*2.0;
          /* Cell count from the ribbon's own aspect ratio, exactly as the
             fall does it and for exactly the same reason: two cells of noise
             down a stream ten times longer than it is wide are cells ten
             times too tall, and what they draw is not a ripple but a rail.
             The static stretch keeps the crests lengthening downstream; vRun
             is one value for the whole ribbon, so the gradient is bounded. */
          float warp = vUv.y*(1.30 - 0.30*vUv.y);
          float ph  = warp*vRun*1.75 - uTime*vRun*0.42;
          float ph2 = warp*vRun*3.20 - uTime*vRun*0.62;
          /* The banks are not parallel lines. A ribbon with two straight edges
             laid on a hillside is a painted stripe, and close to the camera
             that is exactly what it read as. The edge wanders on its own slow
             field — the same fix the fall needed, for the same reason. */
          float ev = fbm(vec2(warp*vRun*0.55 + 3.0, -uTime*0.22));
          float edge = 0.72 + 0.52*ev;
          float bank = smoothstep(edge, edge*0.30, across);
          /* WHAT MAKES IT LOOK LIKE IT IS FLOWING is not that the texture
             moves — the last one moved and still read as a still ribbon. It
             is that the texture is STRETCHED ALONG THE FLOW and SHEARED
             ACROSS IT.
 
               Stretched: the pattern varies quickly across the channel and
               slowly along it, so what travels is a set of long thin
               streaks lying in the direction of travel. A pattern with the
               same detail in both directions travelling downstream just
               looks like a texture being dragged.
 
               Sheared: the middle runs faster than the banks, because it
               does — the bank drags on it. Every part of the surface moving
               at the same speed is a conveyor belt; a middle that outruns
               its edges is a current, and the eye knows the difference
               without being told. */
          float mid = 1.0 - 0.55*across*across;                 // the drag
          /* THE TIME TERM IS A CONSTANT. It was a rate that varied along the
             ribbon — faster downstream, slower at the banks — and that is the
             same mistake as the blinking in S9: when the phase is
             y - t*rate(y), its gradient is 1 - t*rate'(y), so the pattern's
             spatial frequency GROWS WITHOUT BOUND as the film runs. Two and a
             half minutes in, the term was twenty-four times the real one and
             the field was being sampled far above its own Nyquist. That is not
             water, it is per-pixel hash that reshuffles every frame — which is
             precisely what 'joet eivät näytä vieläkään virtaavan' was looking
             at. Moving noise sampled past Nyquist does not read as motion at
             all; it reads as grain.
 
             So the advection is at ONE speed, and everything that should vary
             along the flow is put in a STATIC spatial warp instead: the streaks
             stretch as they go, which is what accelerating water does to its
             own surface, and the gradient of that stays bounded forever. */
          float wobble = fbm(vec2(vUv.y*2.2 + 7.0, uTime*0.10))*0.35;
          /* The frequencies are set by the ribbon's size ON SCREEN, not by
             what looks right in a texture viewer. This river is fifteen or
             twenty pixels across from the distance the camera actually flies
             at, so eleven cells of noise across it is a cell and a half per
             pixel — and a field sampled below its own frequency is white
             speckle, which is exactly what it looked like: wet gravel. Three
             or four streaks across, long ones, is what reads. */
          float s1 = fbm(vec2(vUv.x*7.0 + wobble*3.0, ph));
          float s2 = fbm(vec2(vUv.x*13.0 + 31.0, ph2));
          /* Sharp: a streak has an edge. A soft threshold over the whole
             ribbon is the wash the last pass produced. */
          /* And the bank's drag reads as duller water at the edges rather
             than as slower water: the amplitude carries it, not the rate. */
          /* Wide thresholds on purpose. A narrow one turns a smooth field
             into hard-edged rails, and three chrome rails on a green field is
             what the close shots looked like; a wide one keeps it a gradient,
             which is what a rippled surface is. */
          glint = (smoothstep(0.38, 0.94, s1)*0.30 + smoothstep(0.50, 1.02, s2)*0.22)*(0.45 + 0.55*mid);
          /* White water at the banks and wherever it runs shallow — the
             standing waves that make a stream audible. */
          foam = smoothstep(0.86, 1.0, s2)*(0.06 + 0.30*across*across);
          /* THE LIP, and it was the white slab in the render.
 
             The ribbon used to brighten to half-way to white over its last
             seventh and hold full opacity to its last vertex, so it ended in a
             hard-edged luminous trapezoid lying on the rim — which is what
             'vesiputouksen alkukohta ei ole oikean näköinen' has been pointing
             at all along. Water going over an edge does the opposite of that:
             it accelerates, so it gets THINNER and SMOOTHER, and the white
             does not start until it has broken up, which is already over the
             edge and is the fall's business. So the last stretch narrows, its
             texture flattens, and it hands over by fading out rather than by
             stopping. */
          /* And capped. Close to the camera the ribbon fills a lot of frame,
             and water that reaches the highlight colour over half its width
             is chrome, not water. */
          /* And the close-range detail, gated by its own footprint exactly as
             the fall's is: three streaks across a ribbon that fills a third of
             the frame is chrome, and the same three seen from across the field
             are all there is room for. */
          vec2 mc = vec2(vUv.x*24.0, ph2*2.6);
          float fw = max(fwidth(mc.x), fwidth(mc.y));
          float det = 1.0 - smoothstep(0.30, 0.85, fw);
          glint = min(glint, 0.34);
          /* Added AFTER the cap, not before it. The cap exists to stop the
             broad rails saturating; capping the fine detail with them just
             deletes it, which is why the first attempt at this changed
             nothing on screen. */
          if (det > 0.01) glint += det*smoothstep(0.52, 0.98, fbm(mc))*0.30;
          lip = smoothstep(0.82, 1.0, vUv.y);
          glint *= 1.0 - lip*0.75;
          foam  *= 1.0 - lip*0.85;
          /* Thinner at the banks, so the wet bed shows through where the
             water runs shallow. A stream of even opacity is a decal; seeing
             the ground through its edges is most of what says there is a
             depth to it at all. */
          /* The last stretch fades out over a fifth of the ribbon rather than
             stopping. Its final row is a straight line across the stream — a
             strip has to end somewhere — and against the rim that reads as a
             clean diagonal cut through the water. It cannot be made to end
             nowhere, so it is made to end SOFTLY, and the fall fades in over
             the same distance: two soft edges overlapping read as one body of
             water, and whatever the rim does between them stops being an
             event. */
          a = pow(bank, 1.45)*0.70*(1.0 - smoothstep(0.78, 1.0, vUv.y)*0.92);
        } else {
          /* An edge, not a fade: full to within a tenth of the shore. */
          float shore = smoothstep(1.0, 0.96, vKind);
          /* The scale matters more than the brightness. At a twentieth of a
             unit the crests were the size of clouds, and clouds are what they
             looked like — a milky wash over the whole lake with two soft white
             patches in it. Ripples have to be SMALL and MANY: a couple of
             dozen across the water, so the eye reads a texture rather than a
             stain. */
          vec2 q = vW.xz*0.09;
          float s1 = fbm(q + vec2(uTime*0.075, uTime*0.046));
          float s2 = fbm(q*2.4 + vec2(-uTime*0.125, uTime*0.155) + 19.0);
          /* And sparse: a narrow band near the top of each field, so most of
             the surface stays dark and the highlights are highlights. */
          glint = smoothstep(0.68, 0.92, s1)*0.26 + smoothstep(0.72, 0.95, s2)*0.30;
          /* The wash at the edge is a hint, not a ring of light — it was
             sitting exactly where the alpha died and made a halo. */
          foam = smoothstep(0.93, 1.0, vKind)*0.14;
          a = shore*0.96;
        }
        /* Nearly all the water's own colour. A surface that is half sky is a
           mirror, and a mirror the size of a lake reads as ice. */
        vec3 col = mix(deep, sky, 0.075);
        col = mix(col, lit, clamp(glint + foam*0.9, 0.0, 1.0));
        a = clamp(a, 0.0, 1.0);
        if (a < 0.006) discard;
        gl_FragColor = vec4(col, a);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  return m;
}

function buildFalls(courses){
  /* ONE RIBBON PER FALL, not a stack of quads.
   *
   * Every seam this waterfall has ever had came from the same decision: it was
   * built as twenty separate instanced planes stacked down the drop. First they
   * overlapped, and an overlap in an additive blend is a bright band — a
   * ladder. Then they were made to abut exactly, and they still rendered with
   * dark gaps between them: the instance transforms say the top of each one is
   * the bottom of the last, and the pixels say otherwise. Rather than keep
   * arguing with it, the fall is now a single triangle strip: one row of
   * vertices per station down the drop, each pair sharing the vertices of its
   * neighbour, so there is no seam to get wrong. The drop coordinate is a
   * vertex attribute interpolated along it, which is what the shader wanted all
   * along.
   *
   * It is still billboarded about the vertical, in the vertex shader, per
   * vertex: the centreline is stored in world space and the half-width is
   * pushed out along the horizontal perpendicular to the line of sight, so the
   * sheet turns to face the camera without ever tipping. */
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aDrop;      // 0 at the lip, 1 at the far end
      attribute float aSeed;
      attribute float aSide;      // -1 or +1 across the sheet
      attribute float aHalf;      // half width at this station, world units
      attribute float aRun;       // the drop, in units of the sheet's width
      varying float vX;
      varying float vDrop;
      varying float vSeed;
      varying float vRun;
      void main(){
        vX = aSide; vDrop = aDrop; vSeed = aSeed; vRun = aRun;
        /* Billboarded about the VERTICAL only. Water falls straight down, so
           the sheet may turn to face the viewer but it may not tip — which is
           what a curtain of water does from any bearing you walk round it. A
           fixed-bearing plane is a line seen from the side, and that is what
           'vesiputoukset ovat 2D' was looking at. */
        vec4 c = modelViewMatrix*vec4(position, 1.0);
        vec3 upV = normalize((modelViewMatrix*vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 vd  = normalize(c.xyz);
        vec3 rt  = cross(upV, vd);
        float rl = length(rt);
        rt = rl > 1e-4 ? rt/rl : vec3(1.0, 0.0, 0.0);
        vec4 mv = c;
        mv.xyz += rt*(aSide*aHalf);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      uniform float uTime;
      varying float vX;
      varying float vDrop;
      varying float vSeed;
      varying float vRun;
      void main(){
        /* What was missing was STRANDS.
         *
         * The old fall was one soft band with a noise wash over it, faded out
         * downward — which is a smear of light, and a smear of light is what
         * it read as. Falling water is not a translucent sheet; it is a lot of
         * separate threads of it, close together, all moving, and the eye
         * identifies a waterfall from those threads and from almost nothing
         * else. So the body is built out of high-frequency strands across the
         * ribbon, and everything else here supports them.
         *
         * Three things beyond the strands, all of them things water does:
         *
         *   It leaves the lip NARROW and spreads as it falls, because it is
         *   accelerating away from a fixed rate of supply.
         *
         *   It falls FASTER further down, so the strands scroll faster with
         *   depth — a constant scroll rate reads as a printed pattern being
         *   dragged past, which is exactly what the first version looked like.
         *
         *   And it turns to mist at the edges, wider and softer than the body,
         *   which is what gives the thing a soft outline and a hard middle
         *   rather than a soft everything.
         */
        float x = vX;                                       // -1..1 across

        /* Interpolated down a single continuous strip. It used to be
           reconstructed inside each of twenty stacked quads from that quad's
           own value plus its uv — which was correct arithmetic on geometry
           that was not continuous, and no amount of correct arithmetic fixes
           that. See buildFalls(). */
        float dd = clamp(vDrop, 0.0, 1.0);

        /* One continuous coordinate down the whole fall, so the strands are
           not restarted at every segment boundary — a per-segment pattern is
           the tell that this is a stack of quads. */
        /* And the same correction the river needed, for the same reason and
           with worse numbers. The scroll rate used to be 2.6 + 5.2*dd, which
           put dd inside the time term: the phase gradient down the fall was
           5.2*t, so by two and a half minutes in the strands were being
           sampled thirty times above their own frequency. The fall was not
           drawing threads of water at all — it was drawing white noise that
           reshuffled every frame, which is why 'ainoat vesiputoukset jotka nyt
           näkyivät ovat ihan staattisia': noise past Nyquist has no direction
           in it, so there is nothing for the eye to see moving.
 
           One speed, and the acceleration goes into a STATIC stretch of the
           strands instead — which is what falling water actually does to them,
           and its gradient is bounded for any t. */
        float fall = dd*9.0;
        float stretch = 1.0 + 2.2*dd;
        float sp = fall/stretch;             // 0 .. 2.8, static, bounded slope
        float spn = sp/2.81;

        /* Narrow at the lip, spreading downward — and RAGGED. A sheet with
           two straight edges is a strip of metal however it is shaded, and
           that is what this looked like from close to: the one thing a real
           fall never has is a ruled outline. The width wanders on its own slow
           field, so the edges bulge and pinch as the water goes down. */
        float w = mix(0.29, 1.00, pow(dd, 0.65));
        float wv = fbm(vec2(spn*vRun*0.42 + vSeed*3.0, -uTime*0.55));
        w *= 0.72 + 0.56*wv;
        float core = smoothstep(w, w*0.26, abs(x));

        /* And the two frequencies are not equal, on purpose. A field with the
           same detail across the fall as along it makes BLOBS, and a column of
           blobs is masonry, which is what the last one looked like. Threads
           are the other way round: many across, few along. */
        /* And the aspect ratio of a NOISE CELL, in pixels, is the whole of
           what decides whether this reads as threads or as brickwork. It was
           nine cells down the fall by twenty-four across: on screen that is
           about twenty-five pixels tall by two wide, so the cells' own
           boundaries showed as horizontal bands and their contents aliased
           into vertical stripes inside them — a wall of bricks, which is
           exactly what the last one looked like. Water threads are the other
           proportion entirely: a few cells down, a dozen across, so each one
           is tall and narrow. */
        /* THE THREADS HAVE A SHAPE, and it has to be the same shape whatever
           the fall's proportions are.
 
           The frequencies used to be fixed numbers: a couple of cells of noise
           down the drop and a dozen across it. On a fall four of its own widths
           long that is roughly square and it works; on one thirty widths long —
           which most of these are — a cell is a hundred times taller than it is
           wide, and a hundred-to-one cell is not a thread, it is a smooth
           gradient with two faint stripes in it. That is what the close shots
           kept showing: a polished metal beam.
 
           So the count along the drop is derived from the fall's own aspect
           ratio (vRun, its length in units of its width) and the count across,
           for a fixed cell shape of about four to one — tall and narrow, which
           is what a thread is. The scroll rate is scaled by the same number so
           the water still crosses the drop in about the same time whatever
           size the fall is. vRun is one value per fall, so the phase gradient
           stays bounded; the lesson two rounds ago was about putting the
           INTERPOLATED coordinate in the time term, and this is not that. */
        float ph  = spn*vRun*2.00 - uTime*vRun*0.55;
        float ph2 = spn*vRun*4.00 - uTime*vRun*0.95;
        /* The cross-fall frequencies come down too: a fall forty pixels wide
           with twenty-six cells of noise across it is the same aliasing seen
           sideways. */
        /* The threads wander sideways as they fall, together, so they are not
           a set of parallel rails ruled down the sheet. */
        float wob = (fbm(vec2(spn*vRun*0.30, vSeed*13.0 - uTime*0.35)) - 0.5)*1.1;
        float strand = fbm(vec2(x*4.0 + wob + vSeed*30.0, ph));
        float streak = smoothstep(0.26, 0.86, strand);
        /* A second, finer set at a different rate, because water at this scale
           has threads inside its threads. */
        float fine = fbm(vec2(x*8.0 + wob*1.7 + vSeed*11.0, ph2));
        streak = clamp(streak + smoothstep(0.40, 1.00, fine)*0.62, 0.0, 1.6);

        /* AND A THIRD LAYER THAT ONLY EXISTS WHEN THERE IS ROOM FOR IT.
 
           The frequencies above are set by what this fall is when it is a
           thumbnail on the far side of the field — a few dozen pixels across —
           and at that size anything finer is the aliasing this file has been
           fighting all week. But the camera also flies within a radius of one
           of them, and at that range those same few threads are ten pixels
           wide each and the water reads as brushed steel.
 
           Both can be true at once if the fine detail is switched off by its
           OWN footprint. fwidth() is the derivative of the coordinate per
           pixel: when a cell of this field covers less than a pixel or two it
           cannot be drawn and is faded out, and when the camera comes close it
           fades back in. Analytic antialiasing, and it is the only honest way
           to have a surface that is right at two ranges an order of magnitude
           apart. */
        vec2 mc = vec2(x*26.0 + vSeed*5.0, ph2*3.6);
        float fw = max(fwidth(mc.x), fwidth(mc.y));
        float det = 1.0 - smoothstep(0.28, 0.80, fw);
        if (det > 0.01){
          float micro = fbm(mc);
          streak = clamp(streak + det*smoothstep(0.44, 0.98, micro)*0.75, 0.0, 2.0);
        }

        /* Spray. Wider than the body and only well below the lip. */
        /* Spray, and then GAS. 'Vesiputous haihtuu alhaalla kaasuksi' — there
           is nothing below to land in, so the fall does not end, it stops
           being water. The spray is narrow and follows the strands; the vapour
           below it is three times as wide, has no strands in it at all, and
           billows on its own much slower clock, because the moment it stops
           being organised into threads it stops being a waterfall and starts
           being a cloud. */
        float mist = smoothstep(1.7, 0.05, abs(x))*pow(dd, 1.25)
                   *(0.30 + 0.70*fbm(vec2(x*3.0 + vSeed*7.0, spn*vRun*0.9 - uTime*vRun*0.28)));
        float gasAmt = smoothstep(0.42, 0.95, dd);
        float gas = smoothstep(3.4, 0.0, abs(x))*gasAmt
                  *(0.25 + 0.75*fbm(vec2(x*1.15 + vSeed*3.0, dd*2.6 - uTime*0.22)));

        /* IT COMES APART AS IT FALLS, and this is the last thing between it
           and a strip of metal.
 
           A real fall leaves its lip as a coherent sheet and does not stay
           one: within a few of its own widths the sheet has torn into
           separate threads, and further down there is nothing continuous left
           at all. This one was a solid band the whole way — the strands were
           only ever a brightness pattern painted ON a sheet that never broke,
           and the sheet's own outline is what the eye reads. So the body is
           now MASKED by the strand field, and the mask takes over from the
           sheet with depth: coherent at the lip, threads in the middle,
           tatters at the bottom. Where the threads are not, there is nothing
           — which is what lets you see through a waterfall.
 
           And the vapour no longer erases them. It used to cut the body by
           eighty-five per cent below the halfway mark, so the entire lower
           half of every fall was a smooth featureless beam with a hard edge:
           at close range that is most of what was in frame, and it is what
           'hassun näköinen' was looking at. */
        float coh = 1.0 - smoothstep(0.06, 0.72, dd);
        float sheet = mix(smoothstep(0.40, 0.80, strand + fine*0.30), 1.0, coh);
        float body = core*sheet*(0.18 + 1.05*streak)*(1.0 - gasAmt*0.45);
        /* Dimmer than it was, for the same reason it is narrower: a quad
           that always faces the viewer puts its whole area in the frame. */
        /* More mist, and it is what softens the outline: the body has an
           edge and the spray around it does not, so the fall ends in air
           rather than in a cut. */
        float a = body*0.26 + mist*0.105*(1.0 - gasAmt*0.6) + gas*0.045;
        /* Spray thrown clear of the body — only worth drawing when there are
           pixels to draw it in, so it rides the same footprint test. */
        if (det > 0.01){
          float fly = fbm(vec2(x*9.0 + vSeed*23.0, ph2*1.7 - 4.0));
          a += det*smoothstep(0.74, 1.0, fly)*smoothstep(0.03, 0.35, dd)
              *smoothstep(2.0, 0.5, abs(x))*0.16;
        }
        /* Bright where it leaves the edge: the lip is the one place the water
           is still coherent enough to be a surface. */
        a += core*smoothstep(0.16, 0.0, dd)*0.10*(0.4 + 0.6*streak);
        a *= 1.0 - dd*0.55;
        /* And it has to END. Water that stops at 45 per cent alpha draws a
           cut line across the bottom of every fall; 'thins into vapour before
           it reaches anything' is the brief and the last fifth of the drop is
           where that happens. */
        a *= smoothstep(1.0, 0.70, dd);
        /* And it BEGINS as well as ends. The strip's first row is a straight
           line across the top of the sheet, and at full opacity that is a
           bright hard-edged wedge sitting on the lip where the river arrives —
           a cut, where what is wanted is water coming over. A couple of per
           cent of fade lets it emerge instead. */
        a *= smoothstep(0.0, 0.075, dd);
        if (a < 0.004) discard;
        vec3 col = mix(vec3(0.82, 0.93, 1.00), vec3(0.44, 0.58, 0.66), dd);
        /* And the gas is cooler and dimmer than the water it came from. */
        col = mix(col, vec3(0.30, 0.44, 0.56), gasAmt*0.7);
        gl_FragColor = vec4(col, a);
      }`
  });

  const pos = [], drop = [], seeds = [], side = [], half = [], run = [], idx = [];
  let base = 0;
  for (const S of courses){
    const o = S.o, f = S.f;
    /* At the height the ribbon ends at, not at the ground's — the river's
       surface is a sheet lifted clear of its bed, and the fall is the same
       water going over the edge. */
    const ey = (S.lipY !== undefined ? S.lipY : S.lip[1] + o.rad*0.008);
    const w0 = S.fw, len = S.len;
    /* Where the water actually falls.
     *
     * Straight down from the lip put it THROUGH the rock on most of these:
     * the outline is irregular and the displacement is largest just under the
     * shoulder, so the cliff below a lip is usually wider than the lip is. The
     * bulge profile says how much wider, per azimuth, measured off the mesh.
     *
     * So the fall leaves the lip and moves OUT over the first fifth of the
     * drop — which is what water does anyway; it has horizontal speed when it
     * goes over an edge and nothing to push it back. After that it hangs
     * clear, down the outside of the cliff. */
    const dirX = S.outDir[0], dirZ = S.outDir[1];
    const lipR = S.lipR;
    /* How far the rock reaches out below this lip — over the sectors the
       SHEET covers, not the one its centre happens to land in. The fall is
       several of its own widths across and the bulge profile is measured in
       thirty-two sectors round the island, so one sector's worth of it says
       nothing about the rock a quarter of the way along the sheet. Taking the
       widest of the neighbours is what stops one edge of the water being
       inside the cliff while the middle hangs clear — which is the straight
       diagonal cut across the fall in the close shots: not an artefact of the
       water at all, but the rock in front of it. */
    /* IN THE ISLAND'S OWN FRAME. The bulge table is filled with the LOCAL
       bearing of each vertex and was being read with the world bearing of the
       lip — the mesh is rotated by the island's yaw, so the fall was asking
       how wide the rock is somewhere else entirely on the rim. On an island
       whose yaw happens to be small it worked; on the rest it returned a
       number for a different part of the cliff, which is why the water kept
       being cut by rock that the arithmetic said was not there. */
    const locAng = S.ang0 + o.bulgeYaw;
    const sect = Math.floor(((locAng + Math.PI*3) % (Math.PI*2))/(Math.PI*2)*BULGE_SECT) % BULGE_SECT;
    let bulge = 0;
    for (let b = -2; b <= 2; b++){
      bulge = Math.max(bulge, o.bulge[(sect + b + BULGE_SECT*2) % BULGE_SECT]);
    }
    const outR = (S.outR !== undefined ? S.outR : Math.max(lipR, bulge*o.bulgeR) + w0*2.0);
    const sd = hash(f, 16);
    /* How long the drop is in units of its own width. The shader needs it to
       keep the threads the same shape on a short wide fall and a long thin
       one. */
    const aspect = len/(w0*3.4);

    /* THE PATH, decided before any of it is drawn.
     *
     * Three things set how far out the water hangs at each height, and they
     * have to be resolved against each other rather than one at a time:
     *
     *   THE ARC. Water leaving a lip has horizontal speed and nothing to push
     *   it back, so it swings out over the first tenth of the drop. The rock
     *   is widest just under the shoulder, which is exactly where the water is
     *   at that moment, so a lazier curve leaves the top of the sheet inside
     *   the cliff.
     *
     *   THE ROCK AT THAT HEIGHT. Not one number for the whole face: the
     *   silhouette table says how far the cliff reaches at this bearing and
     *   this altitude, so the sheet follows the rock out where it bulges
     *   instead of hanging at the widest point of the entire drop.
     *
     *   AND IT CANNOT COME BACK IN. Below the widest point the keel narrows,
     *   but falling water does not narrow with it — it goes straight down. A
     *   running maximum is both the physics and the safety: whatever the rock
     *   does lower down, the water is already outside it.
     */
    const rrs = [], ys = [];
    for (let i = 0; i < FALL_SEGS; i++){
      const u = i/(FALL_SEGS - 1);
      const outU = Math.min(1, u/0.14);
      const y = ey - u*len;
      ys.push(y);
      let rr = lipR + (outR - lipR)*(outU*outU*(3 - 2*outU));
      /* THE VETO DOES NOT APPLY AT THE LIP, and that is the blockage.
 
         The silhouette table is read over a window of bearings and altitudes,
         because it is filled from vertices and a cell can be empty where the
         rock is merely thinly sampled — every error in it has to be outward.
         At the lip that safety costs more than it buys: the window reaches
         seventeen degrees round the rim and two bands down into the shoulder,
         and the rim's radius varies by more than that over such a span. So the
         first station of every fall was pushed out to the widest rock in its
         neighbourhood — measured, seventy units past the lip on the largest
         island — and the water left the river with a sideways jump. Seen from
         the deck that reads as the fall being blocked and shunted aside.
 
         The lip is the one height where the rock's radius is not a guess: it
         is where the river ended, and it was walked there off the mesh. So the
         veto ramps in over the same tenth of the drop the arc does, from
         nothing at the lip to the full window below it, and its window widens
         as it goes — narrow where the answer is known, wide where it is not. */
      const veto = Math.min(1, Math.max(0, (u - 0.015)/0.125));
      /* And it hangs WELL clear, not just clear. The table answers 'how far
         does the rock reach at this bearing and this height', which is not
         quite the question: what hides a fall is any shelf that projects over
         it from where the camera happens to be, and a cliff twenty degrees
         round the rim can do that without ever being at this bearing. Two
         sheet-widths of air between the water and the rock is what it takes
         for the fall to stay a fall from the angles this scene flies. */
      const pr = profAt(o, locAng, (y - o.y)/o.rad,
                        veto > 0.5 ? 4 : 2, veto > 0.5 ? 2 : 1)*o.rad + w0*2.40;
      const need = lipR + (pr - lipR)*veto;
      if (need > rr) rr = need;
      if (i > 0 && rrs[i - 1] > rr) rr = rrs[i - 1];
      rrs.push(rr);
    }
    /* Smoothed, then re-maximised: the table is a grid and its steps would
       otherwise show as kinks down the sheet, and an average can pull a
       station back inside the rock it was moved out of. */
    for (let pass = 0; pass < 3; pass++){
      const src = rrs.slice();
      for (let i = 1; i < FALL_SEGS - 1; i++) rrs[i] = (src[i - 1] + src[i]*2 + src[i + 1])/4;
      for (let i = 1; i < FALL_SEGS; i++) if (rrs[i] < rrs[i - 1]) rrs[i] = rrs[i - 1];
    }

    for (let i = 0; i < FALL_SEGS; i++){
      const u = i/(FALL_SEGS - 1);
      /* Smooth in u — a per-station hash offset would jump sideways at every
         row and put the ladder back in by another route. */
      const wob = Math.sin(u*3.4 + hash(f, 14)*6.28)*w0*1.1*u;
      const wob2 = Math.cos(u*2.1 + hash(f, 15)*6.28)*w0*0.7*u;
      const rr = rrs[i], y = ys[i];
      const x = o.x + dirX*rr + wob, z = o.z + dirZ*rr + wob2;
      /* A constant frame; the shader narrows the water inside it, because the
         mist and the vapour need room either side of the body. */
      const hw = w0*1.7;
      pos.push(x, y, z, x, y, z);
      side.push(-1, 1); half.push(hw, hw);
      drop.push(u, u); seeds.push(sd, sd);
      run.push(aspect, aspect);
      if (i < FALL_SEGS - 1){
        const a = base + i*2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += FALL_SEGS*2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('aDrop', new THREE.BufferAttribute(new Float32Array(drop), 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seeds), 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(new Float32Array(side), 1));
  geo.setAttribute('aHalf', new THREE.BufferAttribute(new Float32Array(half), 1));
  geo.setAttribute('aRun', new THREE.BufferAttribute(new Float32Array(run), 1));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  return m;
}

/* THE HANGING ROOTS ARE GONE, and this note is what is left of them.
 *
 * 'Saarekkeista roikkuvat nauhat eivät näytä hyvältä, eli ne voisi ottaa pois
 * (eivät näytä juurilta).' Soloed with everything else muted, the layer is
 * exactly that: bundles of long, straight, parallel tapered strips hanging
 * under the rims. A root is not a strip. It branches, it thickens where it
 * splits, it wanders, and it is never parallel to the root beside it — and
 * none of those is a parameter that could have been turned up, because the
 * primitive was a tapered quad and a tapered quad has no branches in it.
 *
 * The vines below stay: they are a different population and a different
 * reading — short, dense, green, spilling over the edge — and the note is
 * about the long brown ones. They also carry the reason the two were ever
 * separated ('drawing both with one shader made the underside read as hair'),
 * which is worth keeping now that only one of them is left.
 */

const VINES_PER = 120;

function buildVines(isl){
  /* Vegetation hanging off the rim — green, short, and dense, where the roots
     are brown, long and sparse. Two populations rather than one because they
     are two different things in the reference: a curtain of growth spilling
     over the edge of the ground, and the roots of that ground reaching down
     past it. Drawing both with one shader made the underside read as hair. */
  const geo = new THREE.PlaneGeometry(1, 1, 1, 5);
  geo.translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      void main(){
        vUv = uv; vSeed = aSeed;
        vec3 p = position;
        float d = 1.0 - uv.y;
        p.x *= mix(1.0, 0.55, d);
        vec4 wp = instanceMatrix*vec4(p, 1.0);
        wp.x += sin(uTime*0.42 + aSeed*13.0)*d*d*5.0;
        wp.z += cos(uTime*0.37 + aSeed*21.0)*d*d*4.0;
        gl_Position = projectionMatrix*modelViewMatrix*wp;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      varying vec2 vUv;
      varying float vSeed;
      void main(){
        float x = abs(vUv.x - 0.5)*2.0;
        /* Leafy rather than strap-like: the edge is eaten by noise so the
           silhouette is ragged, which at this distance is the entire
           difference between foliage and ribbon. */
        float edge = 0.78 + 0.42*fbm(vec2(vSeed*17.0, vUv.y*9.0));
        float a = smoothstep(edge, edge - 0.45, x);
        a *= smoothstep(0.0, 0.16, vUv.y)*(0.45 + 0.55*vUv.y);
        if (a < 0.03) discard;
        vec3 col = mix(vec3(0.045, 0.105, 0.042), vec3(0.085, 0.175, 0.070), vUv.y);
        gl_FragColor = vec4(col, a*0.80);
      }`
  });
  const n = isl.length*VINES_PER;
  const m = new THREE.InstancedMesh(geo, mat, n);
  const seeds = new Float32Array(n);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < isl.length; i++){
    const o = isl[i];
    for (let j = 0; j < VINES_PER; j++){
      /* On the RIM, not across the underside — vegetation grows where the
         ground is, and spills from its edge. */
      const lip = o.rim[(j*7919 + 31) % o.rim.length];
      const a = Math.atan2(lip[0] - o.x, lip[2] - o.z);
      const len = o.rad*(0.05 + hash(k, 43)*0.16);
      v.set(lip[0], lip[1] + 3, lip[2]);
      q.setFromAxisAngle(up, a);
      /* Narrow, and many. The first pass used 14-40 units across at thirty
         per island, which at this range draws green BARS — the eye reads a
         wide soft-edged strip as a ribbon however ragged its edge is. Foliage
         is a lot of thin overlapping things. */
      s.set(o.rad*(0.004 + hash(k, 44)*0.009), len, 1);
      m.setMatrixAt(k, mm.compose(v, q, s));
      seeds[k] = hash(k, 45);
      k++;
    }
  }
  m.instanceMatrix.needsUpdate = true;
  m.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}

/* The nebula.
 *
 * This replaces the aurora, which was the right idea for a world of separate
 * bodies each carrying its own thin air — and the wrong one for this one:
 * 'vaihda revontuliefekti enemmän nebulamaiseksi taustaksi, eli kuin tämä
 * leijuvien kappaleiden joukko olisi nebulan sisällä.' An aurora is a local
 * thing, a curtain hanging over one body; the field wanted a place to be
 * inside of.
 *
 * Two things make a nebula read as one rather than as coloured fog:
 *
 *   DUST LANES. The bright gas is not a cloud with soft edges, it is a volume
 *   with opaque dust in front of parts of it. So the emission is multiplied by
 *   an independent, much sharper dark field — and where that field bites, the
 *   nebula is BLACK rather than dim, which is what gives it structure at every
 *   scale instead of a smooth gradient.
 *
 *   COLOUR BY DENSITY, not by position. Hydrogen at the bright cores runs
 *   pink-red and the thin outskirts scatter blue; painting a nebula in two
 *   colours by where they are in frame gives a poster, and by how much gas is
 *   there gives a nebula.
 *
 * Sampled TRIPLANAR — the same noise read on the three coordinate planes and
 * blended by the direction's own axis weights. A dome sampled in (azimuth,
 * elevation) has both poles pinched and a seam down one side, and this scene
 * looks straight up during the last shot, which is exactly where that shows.
 */
const NEBULA_GLSL = /* glsl */`
float n3(vec3 p){
  vec3 w = abs(p);
  w /= (w.x + w.y + w.z + 1e-5);
  return fbm(p.xy)*w.z + fbm(p.yz + 17.0)*w.x + fbm(p.zx + 43.0)*w.y;
}
float nfbm(vec3 p){
  return n3(p)*0.55 + n3(p*2.13 + 5.0)*0.28 + n3(p*4.37 + 11.0)*0.17;
}`;

function buildNebula(){
  const geo = new THREE.SphereGeometry(7200, 48, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 1 } },
    vertexShader: `varying vec3 vD;
      void main(){ vD = normalize(position);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${NEBULA_GLSL}
      uniform float uTime, uAmt;
      varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        /* Very slow. A nebula is light-years across and the camera crosses a
           few kilometres; nothing about it should be seen to move, and this
           drift exists only so the field is not frozen in a still. */
        vec3 p = d*2.6 + vec3(0.0, uTime*0.0016, uTime*0.0009);

        /* The gas. */
        float dens = nfbm(p);
        dens = smoothstep(0.30, 0.62, dens);
        /* A second, larger structure so the whole sky is not one texture:
           bright regions with genuinely empty sky between them. */
        float region = smoothstep(0.30, 0.62, n3(d*0.85 + 31.0));
        dens *= 0.30 + 0.70*region;

        /* The dust, and it is the part that makes this a nebula. Sharper than
           the gas and independent of it, so it cuts ACROSS the bright
           structure instead of following it. */
        float dust = smoothstep(0.60, 0.34, nfbm(d*4.4 + 61.0));
        dens *= 0.16 + 0.84*dust;

        /* Colour by how much gas is in the ray: thin outskirts scatter blue,
           thick cores run pink and then nearly white. */
        vec3 thin  = vec3(0.10, 0.22, 0.52);
        vec3 mid   = vec3(0.42, 0.16, 0.46);
        vec3 core  = vec3(0.86, 0.36, 0.40);
        vec3 col = mix(thin, mid, smoothstep(0.0, 0.55, dens));
        col = mix(col, core, smoothstep(0.55, 1.0, dens));

        /* Dim. The islands are the subject and this is the room they are in;
           a nebula bright enough to light them would be a backdrop. */
        /* Bright enough to BE the sky, and getting there took measuring the
           chain rather than turning one number up: three independent masks
           multiplied together, each averaging under a half, put the typical
           ray at eight per cent of the nominal brightness — so 0.34 was in
           practice 0.03 and the field still sat in plain black. The masks were
           widened first and the gain set afterwards. */
        float a = dens*0.85*uAmt;
        if (a < 0.002) discard;
        gl_FragColor = vec4(col*a, a);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -2;
  return m;
}

function buildStars(){
  /* Open space needs stars or it is a black card, and the islands need
     something to be silhouetted against. Points, not billboards — at this
     count the difference is a draw call and nobody can tell. */
  const N = 2600;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  for (let i = 0; i < N; i++){
    const u = hash(i, 1)*2 - 1, a = hash(i, 2)*Math.PI*2;
    const r = Math.sqrt(1 - u*u), R = 6600;
    pos[i*3] = Math.cos(a)*r*R; pos[i*3 + 1] = u*R; pos[i*3 + 2] = Math.sin(a)*r*R;
    const b = 0.25 + hash(i, 3)*0.75, w = 0.85 + hash(i, 4)*0.15;
    col[i*3] = b*w; col[i*3 + 1] = b*(0.92 + hash(i, 5)*0.08); col[i*3 + 2] = b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  /* Two pixels, not nine. gl_PointSize is a SQUARE — at nine pixels with no
     round mask the sky fills with white tiles, which is what the first render
     produced. At two they read as stars and the shape stops mattering. */
  const m = new THREE.Points(g, new THREE.PointsMaterial({
    size: 2, sizeAttenuation: false, vertexColors: true,
    transparent: true, opacity: 0.9, depthWrite: false
  }));
  m.frustumCulled = false;
  m.renderOrder = -2;
  return m;
}


const N_DEBRIS = 170, DEBRIS_SHAPES = 5;

function buildDebris(isl, courses = []){
  /* The small stuff between the big stuff.
   *
   * 'Ja myös voisi olla kappaleiden välillä pieniä kasvillisuutta sisältäviä
   * kallion halkeamia/ulkonemia.' Fourteen islands in an otherwise empty
   * volume gives the eye nothing to judge distance by: the gaps between them
   * are the same featureless black at every range, so the field reads as flat
   * however deep it is. A scatter of small rocks fills those gaps with
   * something that has a KNOWN size, and the moment there is a known size in
   * the frame everything else in it acquires a distance.
   *
   * They are the same rock as the islands, from the same function at a coarser
   * subdivision, so they are outcrops of the same material and not a second
   * kind of object. Green on top of the bigger ones, because anything with a
   * top in this world grows something.
   *
   * Five shapes rather than one, instanced: rotation and scale hide a repeat
   * at this size, but five hides it completely and costs five draws.
   */
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const { verts, faces } = icosphere(3);
  const idx = new Uint32Array(faces.length*3);
  for (let f = 0; f < faces.length; f++){
    idx[f*3] = faces[f][0]; idx[f*3 + 1] = faces[f][1]; idx[f*3 + 2] = faces[f][2];
  }

  /* Where they go: strung between consecutive islands, plus a jitter, so the
     scatter follows the field rather than filling a box the field happens to
     be inside. */
  const sites = [];
  /* Nothing floats above the islands. These are rocks and they have keels of
     their own, so one drifting over the camera shows an underside — and the
     shot is built specifically to keep those out of frame. Capped at the
     highest plateau in the field, which is the same line the camera stays
     above. */
  const ceil = isl.reduce((m, o) => Math.max(m, o.y + o.rad*0.15), -1e9);

  /* AND NOTHING IN FRONT OF A WATERFALL.
   *
   * A rock drifting past a fall is plausible; a rock parked in the middle of
   * one for the length of the shot is a fall with a piece missing, and that is
   * what it was read as. Measured at t=177: a quarter of that fall's pixels
   * never reached the frame, and muting the island rock and the debris one at
   * a time each said 'not me' — because they were both in front of nearly the
   * same pixels and either one alone still hid them. Muting the pair together
   * took it from 26 per cent to 2.
   *
   * The columns are known here: measureCourses() has already walked every lip
   * and every fall's length off the finished mesh. So a site that lands inside
   * one is pushed out of it, radially, keeping the direction it came from —
   * the same treatment overlapping islands get, and for the same reason. */
  const cols = courses.map(C => {
    const o = C.o;
    /* The column is not at the lip: the water arcs outward over the first
       tenth of the drop and then hangs there. Centred on the middle of that
       arc and wide enough to hold all of it — measured off C.outR, which
       measureCourses() worked out for exactly this reason. */
    const rMid = (C.lipR + (C.outR !== undefined ? C.outR : C.lipR))*0.5;
    const top = (C.lipY !== undefined ? C.lipY : C.lip[1]);
    return { x: o.x + C.outDir[0]*rMid, z: o.z + C.outDir[1]*rMid,
             top, bot: top - C.len,
             r: C.fw*3.4 + ((C.outR || C.lipR) - C.lipR)*0.5 + o.rad*0.04 };
  });
  const clearFalls = (p) => {
    for (const c of cols){
      if (p.y - p.s > c.top || p.y + p.s < c.bot) continue;
      let dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz), want = c.r + p.s*1.25;
      if (d >= want) continue;
      if (d < 1e-3){ dx = 1; dz = 0; }
      const k2 = want/Math.max(1e-3, d);
      p.x = c.x + dx*k2; p.z = c.z + dz*k2;
    }
  };

  for (let i = 0; i < N_DEBRIS; i++){
    const a = isl[i % isl.length], b = isl[(i*5 + 3) % isl.length];
    const k = hash(i, 71);
    sites.push({
      x: a.x + (b.x - a.x)*k + (hash(i, 72) - 0.5)*900,
      y: Math.min(ceil - 40, a.y + (b.y - a.y)*k + (hash(i, 73) - 0.5)*760),
      z: a.z + (b.z - a.z)*k + (hash(i, 74) - 0.5)*700,
      /* Small. The camera orbits BETWEEN the islands, which is where these
         are, so a hundred-unit lump lands a few of its own diameters from the
         lens and fills a third of the frame with a smooth green blob. They
         exist to give the gaps a known size, and something that fills the
         frame has stopped doing that. */
      s: 9 + Math.pow(hash(i, 75), 2.2)*58,
      seed: hash(i, 76)
    });
    clearFalls(sites[sites.length - 1]);
  }

  for (let sh = 0; sh < DEBRIS_SHAPES; sh++){
    const seed = 0.17 + sh*0.19;
    const n = verts.length;
    const pos = new Float32Array(n*3), col = new Float32Array(n*3);
    for (let v = 0; v < n; v++){
      const p = verts[v];
      const q = rockPoint(p[0], p[1], p[2], seed);
      /* Squatter than an island: these are lumps, not fragments of a
         continent, so the keel is pulled most of the way in. */
      /* Squatter than an island, but not flat: at 0.42 these came back as
         green lozenges rather than as rocks with something growing on them. */
      pos[v*3] = q.x; pos[v*3 + 1] = q.y*0.62; pos[v*3 + 2] = q.z;
      const shade = 0.80 + 0.20*Math.sin(q.y*17.0 + seed*9.0);
      const gr = q.grass*0.62*(0.30 + 0.70*fbm3(p[0]*4.0 + seed*31.0, p[1]*4.0, p[2]*4.0));
      col[v*3]     = 0.088*shade + gr*0.040;
      col[v*3 + 1] = 0.079*shade + gr*0.160;
      col[v*3 + 2] = 0.076*shade + gr*0.036;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
    geo.computeVertexNormals();

    const mine = sites.filter((_, i) => i % DEBRIS_SHAPES === sh);
    const m = new THREE.InstancedMesh(geo, mat, mine.length);
    const mm = new THREE.Matrix4(), q4 = new THREE.Quaternion();
    const v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < mine.length; i++){
      const d = mine[i];
      v3.set(d.x, d.y, d.z);
      /* Tilted, but only a little. A rock lying on its side has no top, and a
         top is where the green is. */
      q4.setFromAxisAngle(up, d.seed*6.28);
      s3.set(d.s*(0.8 + hash(i, 77)*0.6), d.s*(0.7 + hash(i, 78)*0.5),
             d.s*(0.8 + hash(i, 79)*0.6));
      m.setMatrixAt(i, mm.compose(v3, q4, s3));
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    group.add(m);
  }
  group.userData.mat = mat;
  group.userData.sites = sites;
  return group;
}

export class Islands {
  constructor(){
    this.isl = islandLayout();
    this.stars  = buildStars();
    this.nebula = buildNebula();
    /* Order matters twice over. waterCourses() FIRST, because rockPoint()
       carves the basin and the channel it describes and the rock cannot be
       built without knowing where they are; then buildBodies(), which fills in
       each island's top, rim and keel point sets and measures each course's
       lip and water level off the finished surface; and everything after that
       stands on those. */
    this.courses = waterCourses(this.isl);
    this.bodies = buildBodies(this.isl);
    measureCourses(this.courses);
    this.trees  = buildTrees(this.isl, this.courses);
    this.scrub  = buildUndergrowth(this.isl, this.courses);
    this.rocks  = buildBoulders(this.isl, this.courses);
    this.debris = buildDebris(this.isl, this.courses);
    this.vines  = buildVines(this.isl);
    this.water  = buildWater(this.courses);
    this.falls  = buildFalls(this.courses);
    this.gas    = buildGas(this.isl);
    this.shells = buildShells(this.isl,
      (this.debris.userData.sites || []).map(d => ({ x: d.x, y: d.y, z: d.z, rad: d.s })));
    this.group = new THREE.Group();
    this.group.add(this.stars, this.nebula, this.bodies, this.debris, this.rocks, this.trees, this.scrub, this.vines, this.water, this.falls, this.gas, this.shells);
  }

  /** lit: 0..1, the 'Everybody!' cue. which: which island lights, or -1. */
  update(t, { camera, lit = 0, which = -1 }){
    /* Stars and nebula ride with the camera — both are at infinity and the
       camera travels thousands of units, which without this would visibly
       parallax them against the islands. */
    this.stars.position.copy(camera.position);
    this.nebula.position.copy(camera.position);
    this.nebula.material.uniforms.uTime.value = t;
    this.vines.material.uniforms.uTime.value = t;
    this.falls.material.uniforms.uTime.value = t;
    this.water.material.uniforms.uTime.value = t;
    this.gas.material.uniforms.uTime.value = t;
    const su = this.shells.material.uniforms;
    su.uTime.value = t;
    su.uLit.value = lit;
    su.uWhich.value = which;
  }

  /* EVERY layer, and the two that were missing cost a round of chasing.
     `scrub` and `gas` were added later and never listed here, so muting them
     did nothing and reported nothing — which reads exactly like 'that layer is
     not the problem'. Thirty-eight thousand opaque instances that cannot be
     switched off are thirty-eight thousand instances that cannot be ruled out.
     A layer that cannot be soloed is a layer that cannot be debugged. */
  debugLayers(){
    return { stars: this.stars, nebula: this.nebula, bodies: this.bodies, debris: this.debris, rocks: this.rocks,
             trees: this.trees, scrub: this.scrub, vines: this.vines, water: this.water,
             falls: this.falls, gas: this.gas, shells: this.shells };
  }

  dispose(){
    for (const m of [this.stars, this.nebula, this.vines, this.water, this.falls, this.shells]){
      m.geometry.dispose(); m.material.dispose();
    }
    this.trees.geometry.dispose(); this.trees.material.dispose();
    this.rocks.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (this.rocks.userData.mat) this.rocks.userData.mat.dispose();
    this.debris.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (this.debris.userData.mat) this.debris.userData.mat.dispose();
    this.bodies.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (this.bodies.userData.mat) this.bodies.userData.mat.dispose();
  }
}
