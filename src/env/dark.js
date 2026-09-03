import * as THREE from 'three';
import { NOISE } from '../core/glsl.js';

/* The dark world (S9).
 *
 * 'Figures stand in the dark with red eyes and do not move. The strobe shows
 * them for a frame at a time.'
 *
 * Everything here follows from one decision: the figures genuinely do not
 * move. Not 'move slowly', not 'sway' — the instance matrices are written once
 * at construction and never touched again. Three things fall out of that, and
 * all three are why this world works:
 *
 *   The scene has no update cost. Only the strobe, the blink and the blaze
 *   change, and all three are uniforms.
 *
 *   The stillness is doing the acting. A crowd that breathes reads as a crowd;
 *   a crowd that is bit-for-bit identical between two strobe flashes reads as
 *   something that is not alive, and the eye works that out long before it can
 *   say why. This is the one scene in the film where the purity rule and the
 *   dramatic intent are the same sentence.
 *
 *   The strobe is allowed to touch global brightness. SCENES.md forbids that
 *   everywhere else and declares this the single exception, in its own words:
 *   'the strobe in S9 IS global brightness, because the strobe is the scene'.
 *
 * The blink and the gaze are the licensed exceptions to the stillness, and
 * they are licensed for the same reason the strobe is: neither is the crowd
 * moving, both are the crowd being ALIVE while not moving, which is worse.
 * Nothing about a blink or a glance displaces a figure by a millimetre — the
 * instance matrices are still written once and never touched. What changed is
 * only which pixels of a face are lit, which is the difference between a
 * waxwork and a room full of people deciding not to do anything.
 *
 * Three pieces:
 *
 *   buildFigures()  instanced silhouettes on a plain, placed by hash so the
 *                   crowd is deterministic, and lit almost not at all — they
 *                   are shapes that occlude, not surfaces that are seen.
 *
 *   buildEyes()     one instanced quad per figure, additive, held at the
 *                   figure's own head height. The only thing in this world
 *                   with a colour, and at the end of the scene the only thing
 *                   in this world with any light at all.
 *
 *   buildPlain()    somewhere to stand.
 *
 * There is no sky. A dome would be a light source and this world has none;
 * what little the strobe reveals falls off into black by construction.
 */

/* Deterministic placement — the same hash the desert uses, so a figure's
   position is a pure function of its index and the crowd is identical every
   time it is built. */
function hash(i, salt){
  let x = (i*2654435761 + salt*40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}

const N_FIGURES = 260;

/* Where the crowd stands. Not a disc: the camera never moves in this scene, so
   figures behind it would be built and never seen. A wedge in front, wide
   enough that the edges of frame are populated at the near distances and deep
   enough that the far ones are only ever a suggestion. */
const NEAR = 26, FAR = 340, HALF_ARC = 0.95;

/* The billboard's extent, in units of the figure's own height: x runs
   +-SPAN_X/2 and y runs 0..SPAN_Y. Both are larger than the figure because the
   figure has to be able to put a hand outside itself — see the note in
   figurePositions(). */
const SPAN_X = 0.76, SPAN_Y = 1.10;

/* Where the camera can be, for the spacing test below. The scene hands in a
   handful of samples of its own path; this is the fallback if nobody does. */
const DEFAULT_VIEWS = [{ x: 0, y: 11.5, z: 0 }];

/* How far apart two heads have to be on screen, as a multiple of the sum of
   their apparent radii. 1 means exactly touching.

   And how big a head has to be before the rule applies to it at all, in
   radians of angular RADIUS. This second number is the one that matters, and
   it took a bad frame to find it.

   Applied to every pair, the spacing rule turned away a third of the crowd and
   what came back was a chorus line: evenly spaced figures at almost identical
   sizes, standing in a row. Of course it did — a near head subtends ten times
   what a far one does, so an exclusion written in angle alone lets the front
   row veto most of the plain behind it, and what survives is whatever packs
   neatly. The distribution the crowd is built from is not something to be
   optimised; it is the crowd.

   The report was 'ihan muutama hahmo' — just a few figures. So the rule is
   scoped to the case that actually looks wrong: two heads BOTH big enough to
   read as heads, sitting on top of each other. A far head behind a near one is
   not a problem and never was, because the near one writes depth and hides it;
   a pair of distant eye-dots beside another pair is not a problem either,
   because at that size there is no head to confuse. 0.009 radians is a head
   about thirty pixels across at this lens — the size at which two eyes become
   two eyes rather than a dot. Below that, figures are left alone.

   With these numbers eleven of the first two hundred and sixty candidates are
   turned away and the rest of the crowd is exactly what it was. */
const HEAD_GAP = 1.30, HEAD_MIN = 0.009;

/* How many candidates to draw from before giving up on filling the crowd.
   Two hundred and seventy-odd are actually used; the headroom is here so a
   later change to the spacing cannot silently return a short crowd. */
const CANDIDATES = 4000;

/* One head as the camera sees it: a bearing, an elevation and an angular
   radius, all in radians, all small enough that the flat approximation is
   exact to well under a pixel at these distances. */
function headOnScreen(f, v){
  const dx = f.x - v.x, dz = f.z - v.z;
  const dist = Math.hypot(dx, dz);
  return { b: Math.atan2(dx, -dz), e: (f.h*HEAD_Y - v.y)/dist, r: f.h*HEAD_R/dist };
}

function figurePositions(views = DEFAULT_VIEWS){
  const out = [];
  /* Each accepted figure's head, precomputed for every sampled camera. */
  const seen = [];
  for (let i = 0; i < CANDIDATES && out.length < N_FIGURES; i++){
    /* Distance distributed as sqrt so the crowd is even per unit AREA rather
       than per unit depth — a linear roll piles everything at the front, which
       reads as a wall with an empty plain behind it. */
    const d = NEAR + (FAR - NEAR)*Math.sqrt(hash(i, 1));
    const a = (hash(i, 2) - 0.5)*2*HALF_ARC;
    const h = 15.5 + hash(i, 3)*4.5;           // 15.5-20 units tall

    /* The pose. Four numbers, and they are deliberately few: this is a
       silhouette seen for two frames at a time at up to three hundred units,
       so what survives is the OUTLINE — where the arms are, how wide the
       stance is, which way the body leans. Anything finer than that is
       arithmetic nobody will ever see.

       The arm angles are per-side and independently drawn, because a crowd
       whose arms are all symmetric reads as a row of paper dolls; the two
       being different by a few degrees is most of what makes 260 copies of
       one shader look like 260 people. */
    const rl = hash(i, 11), rr = hash(i, 12);
    /* Almost everyone hangs their arms. One in nine has an arm up — reaching,
       or shielding — and that is the whole variety budget: a crowd where
       every third figure is doing something is a crowd of mimes. */
    const armL = rl < 0.88 ? 0.04 + hash(i, 13)*0.22 : 1.90 + hash(i, 14)*0.70;
    const armR = rr < 0.88 ? 0.04 + hash(i, 15)*0.22 : 1.90 + hash(i, 16)*0.70;
    const stance = hash(i, 17);                       // 0 = feet together
    const lean = (hash(i, 18) - 0.5)*1.6;             // -0.8 .. 0.8

    const f = {
      x: Math.sin(a)*d + (hash(i, 6) - 0.5)*8,
      z: -Math.cos(a)*d,
      h,
      /* Width as a fixed fraction of height, and it has to be fixed: the
         silhouette below is drawn in units of HEIGHT, and it can only do that
         if it knows the quad's aspect. Widened from 0.30 when the arms were
         allowed to leave the body — a raised arm reaches about a third of the
         figure's height out from the centreline and a hand's breadth ABOVE its
         own head, and a quad that stops at the shoulders and at the crown
         clips both off square. Which is precisely the 'broken figures' report:
         not broken geometry, a hand sliced off by the edge of its own
         billboard. */
      w: h*SPAN_X,
      armL, armR, stance, lean,
      /* How far this one is turned AWAY FROM THE CAMERA — not its heading in
         the world, which is a distinction that took a round to see.

         Almost all of them face the lens, because a figure in profile is a
         shape and a figure facing you is a figure, but not all, because a
         crowd uniformly aimed at the lens is a poster. Capped well short of a
         right angle: a billboard turned edge-on is a one-pixel line, and its
         eye quad turns with it. */
      turn: (hash(i, 5) - 0.5)*(hash(i, 7) < 0.78 ? 0.5 : 1.30),
      seed: hash(i, 21)
    };

    /* And here the candidate can still be turned away.
 
       Hash placement scatters bodies evenly through a WEDGE, which is a
       statement about the world and not about the picture. On screen, two
       figures whose bearings and elevations happen to coincide draw one head
       over another, and because the only bright thing either of them has is a
       pair of eyes, what the frame shows is one silhouette with four eyes in
       it — or a pair of eyes floating on a neighbour's shoulder. It reads as
       a rendering fault rather than as a crowd, which is exactly the report.
 
       So a candidate whose head is big enough to read as one is accepted only
       if it clears every other head that size, by a third again their combined
       radii — and it has to clear them from EVERY camera position this scene
       visits, not just from one. The
       camera pans, arcs and dollies now; a separation that holds at the top of
       the scene and collapses at bar 86 is not a separation. The views come
       from the scene's own path, sampled, so the two cannot drift apart.
 
       Bodies are still allowed to overlap, and must: a crowd in which nobody
       stands behind anybody else is a chorus line. It is only the heads that
       are kept apart, because the head is where all the information is. */
    const proj = views.map(v => headOnScreen(f, v));
    let clear = true;
    for (let j = 0; j < seen.length && clear; j++){
      const other = seen[j];
      for (let k = 0; k < views.length; k++){
        const a = proj[k], b = other[k];
        if (Math.min(a.r, b.r) < HEAD_MIN) continue;   // too small to confuse
        const db = a.b - b.b, de = a.e - b.e, rr = HEAD_GAP*(a.r + b.r);
        if (db*db + de*de < rr*rr){ clear = false; break; }
      }
    }
    if (!clear) continue;
    seen.push(proj);
    out.push(f);
  }
  /* Sorted back to front, once, at build time — and this is the whole fix for
     a crowd that had a black line drawn round every figure in it.
 
     The bodies are one InstancedMesh, so three has no way to sort them: it
     sorts OBJECTS, and this is one object. The instances were therefore drawn
     in index order, which is hash order, which is neither. A near figure drawn
     before a far one blends its antialiased edge against the empty background
     and then writes depth there; the far figure arrives afterwards, is depth
     rejected along that seam, and never fills it in. The result is a half-lit
     outline around every figure that has anyone behind it — read as a deliberate
     ink line, and it was a sorting bug.
 
     Nothing in this world ever moves and the camera is nailed down, so the
     correct order is a constant and can be computed here rather than per
     frame: farthest first, so every figure blends over what is already behind
     it. Depth is still written, which is what lets a near body occlude the eyes
     behind it — the one thing the blend order alone could not do. */
  /* And now each figure's billboard is aimed at the camera, with its own turn
     laid on top.

     The first version stored `turn` as a world heading, so a quad's normal
     pointed along world +z and every figure was drawn as if the camera were
     straight in front of it. It is not: a figure at the edge of frame is seen
     from thirty degrees off, and the crowd's own wedge reaches fifty-four. Add
     a figure's own turn to that and the total angle between the view ray and
     the billboard passes eighty degrees, at which point cos of it is a seventh
     and the figure is drawn one seventh as wide as it should be. That is the
     report — bodies squashed flat, and worst at the left and right edges,
     because that is exactly where the bearing is largest. Nothing was wrong
     with those figures; they were being viewed from an angle nobody chose.

     Aiming the billboard at the camera first makes `turn` mean what it says
     everywhere in frame: a figure turned thirty degrees is drawn thirty
     degrees turned whether it stands in the middle of the shot or at the edge
     of it. The camera moves a few units across the scene and these figures
     stand tens or hundreds away, so one bearing computed here, from the middle
     of the path, holds for the whole shot to well under a degree. */
  const cam = views.reduce((a, v) => ({ x: a.x + v.x/views.length,
                                        z: a.z + v.z/views.length }), { x: 0, z: 0 });
  for (const f of out){
    const bearing = Math.atan2(cam.x - f.x, cam.z - f.z);
    f.yaw = bearing + f.turn;
  }

  out.sort((a, b) => a.z - b.z);
  return out;
}

/* The head's centre, in units of the figure's own height. The silhouette below,
   the eye placement above it and the crowd-spacing test all MUST agree about
   this or the eyes float outside the skull, which is what happened when the
   body was drawn from rectangles and the head from a circle written in the
   wrong space. One constant, read by all three. */
const HEAD_Y = 0.928, HEAD_R = 0.058, HEAD_LEAN = 0.022;

/* The figure, as a distance field.
 *
 * This replaces a silhouette assembled from four independent rectangles —
 * torso, legs, arms, head — combined with max(). That construction cannot be
 * made to hold together: each part had its own vertical range and its own
 * horizontal offset, and wherever two ranges failed to overlap the figure came
 * apart. The arm band sat at 0.128 out from the centreline while the shoulders
 * only reached 0.115, so every arm in the crowd was a rectangle floating
 * beside a body it never touched. That is the 'osa hahmoista on rikkonaisia'
 * report, and no amount of nudging those four numbers fixes it, because
 * connectedness was never something that construction could promise.
 *
 * A skeleton of capsules can promise it. Each limb is a segment between two
 * JOINTS, adjacent limbs share a joint by construction, and the union is a
 * smooth minimum — so a shoulder is not a place where two shapes happen to
 * overlap, it is a place where one shape is welded to another and the weld is
 * where the flesh would be. Head to neck to chest to pelvis to hip to knee to
 * ankle to toe: one connected run, and the arms hang off the same chest the
 * neck does. It is impossible for this figure to come apart, in any pose,
 * because there is no pose in which two joints stop being the same point.
 */
const FIGURE_GLSL = /* glsl */`
/* Capsule: distance to a segment, minus a radius. */
float sdSeg(vec2 p, vec2 a, vec2 b, float r){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}

/* Tapered capsule — iq's 2D round cone. The torso needs one: a body that is
   the same width at the waist as at the shoulders is a bottle. */
float sdCone2(vec2 p, vec2 a, vec2 b, float r1, float r2){
  vec2 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr*rr;
  float il2 = 1.0/l2;
  vec2 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec2 qq = pa*l2 - ba*y;
  float x2 = dot(qq, qq);
  float y2 = y*y*l2;
  float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}

/* Polynomial smooth minimum. k is the weld radius, in height units. */
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0 - h);
}

/* p is in units of the figure's HEIGHT, origin at the feet, x zero on the
   centreline. pose = (armL, armR, stance, lean).

   The proportions are the tabulated ones for a standing adult, expressed as
   fractions of stature, because that is how anatomy is actually written down:
   head an eighth of the figure, shoulders a fifth of the height across,
   crotch at half, knee at a quarter, elbow at the waist, fingertip at
   mid-thigh. Getting these from a table rather than from taste is why this
   reads as a person at eight pixels tall. */
float figureDist(vec2 p, vec4 pose){
  float armL = pose.x, armR = pose.y, stance = pose.z, lean = pose.w;

  /* Spine. The lean tilts the upper body over the hips — a few thousandths of
     a stature, which is nothing, and is the difference between a crowd and a
     rank. */
  vec2 pel   = vec2(lean*0.004, 0.505);
  /* The chest ENDS below the head, and by enough that the neck capsule has
     something to span. At 0.795 with a cap radius of 0.098 the torso's own
     rounded top reached 0.893 and the head's underside is at 0.870 — the body
     swallowed the neck and every figure in the crowd came out hooded. */
  vec2 chest = vec2(lean*0.014, 0.772);
  vec2 head  = vec2(lean*${HEAD_LEAN.toFixed(3)}, ${HEAD_Y.toFixed(3)});
  vec2 neck  = mix(chest, head, 0.55);

  float d = sdCone2(p, pel, chest, 0.072, 0.092);      // torso, waist to chest
  /* Welded tightly. A fat weld here fills the hollow under the jaw and puts
     the head back on the shoulders. */
  d = smin(d, sdSeg(p, chest, neck, 0.027), 0.012);    // neck
  d = smin(d, length(p - head) - ${HEAD_R.toFixed(3)}, 0.022);   // head

  /* Legs. Both hips are ON the pelvis segment, so the join is a weld and not
     an overlap; the stance opens the feet without ever detaching the thigh. */
  float sp = 0.024 + stance*0.038;
  for (int s = 0; s < 2; s++){
    float sg = s == 0 ? -1.0 : 1.0;
    vec2 hip  = vec2(pel.x + sg*0.038, 0.492);
    vec2 knee = vec2(hip.x + sg*sp*0.40, 0.262);
    vec2 ank  = vec2(hip.x + sg*sp*0.85, 0.046);
    vec2 toe  = vec2(ank.x + sg*0.020, 0.014);
    d = smin(d, sdCone2(p, hip, knee, 0.042, 0.032), 0.024);   // thigh
    d = smin(d, sdCone2(p, knee, ank, 0.032, 0.021), 0.018);   // calf
    /* The foot. Asked for by name — 'ja myös jalanterät' — and it is not
       decoration: a leg that ends in a rounded stump reads as an amputation
       at any size where the stump is more than one pixel across. */
    d = smin(d, sdSeg(p, ank, toe, 0.019), 0.016);
  }

  /* Arms. The shoulder sits on the chest capsule's own rim, so however far the
     arm swings the upper arm starts INSIDE the torso. Two segments, elbow
     carrying about half the shoulder's angle, which is what stops a raised arm
     from being a straight stick. */
  for (int s = 0; s < 2; s++){
    float sg = s == 0 ? -1.0 : 1.0;
    float ang = s == 0 ? armL : armR;
    vec2 sh  = vec2(chest.x + sg*0.084, 0.766);
    vec2 elb = sh  + 0.168*vec2(sg*sin(ang), -cos(ang));
    /* The forearm carries MORE of the shoulder's angle than the upper arm,
       not less. A raised arm whose forearm merely continues outward reaches
       four tenths of a stature sideways — off the side of its own billboard,
       which is one of the two ways figures were being cut in half. Bending it
       further up instead brings the hand back over the head, which is both
       what a raised arm actually does and what fits in the quad. */
    float a2 = ang*1.35 + 0.06;
    vec2 hnd = elb + 0.158*vec2(sg*sin(a2), -cos(a2));
    d = smin(d, sdCone2(p, sh, elb, 0.030, 0.024), 0.026);
    d = smin(d, sdCone2(p, elb, hnd, 0.024, 0.019), 0.018);
  }
  return d;
}`;

function buildFigures(pos){
  /* A plane, not a body. At these distances and this light level a silhouette
     is all that survives, and a silhouette drawn as one quad with a shaped
     alpha costs one instanced draw for the whole crowd. The shaping is the
     distance field above, evaluated per pixel. */
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);                    // pivot at the feet

  /* The pose, per instance. It has to travel as an attribute rather than as a
     uniform for the obvious reason — one draw call, 260 different people — and
     it is read in the vertex shader and passed down, because a fragment shader
     cannot see instanced attributes on its own. */
  const aPose = new Float32Array(pos.length*4);
  for (let i = 0; i < pos.length; i++){
    aPose[i*4 + 0] = pos[i].armL;
    aPose[i*4 + 1] = pos[i].armR;
    aPose[i*4 + 2] = pos[i].stance;
    aPose[i*4 + 3] = pos[i].lean;
  }
  geo.setAttribute('aPose', new THREE.InstancedBufferAttribute(aPose, 4));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: {
      uFlash: { value: 0 },
      uBlaze: { value: 0 },
      /* Darker than it looks. A strobe frame multiplies this by vLit and then
         the grade lifts it, and at 0.082 the crowd came back as pale grey
         mannequins rather than as bodies briefly caught in a light. */
      uCol:   { value: new THREE.Color(0.056, 0.053, 0.068) }
    },
    vertexShader: /* glsl */`
      attribute vec4 aPose;
      varying vec2 vUv;
      varying vec4 vPose;
      varying float vFade;
      varying float vLit;
      void main(){
        vUv = uv;
        vPose = aPose;
        /* instanceMatrix by hand. A custom ShaderMaterial on an InstancedMesh
           does NOT get the per-instance transform applied for it — three only
           does that inside its own built-in shader chunks — so leaving it out
           silently collapses every instance onto the identity and draws the
           whole crowd as one unit quad at the origin. Which is exactly what
           happened here the first time: a completely black frame with nothing
           in it at all, and no error anywhere, because nothing was wrong
           except that 260 people were standing in the same place at the size
           of a postage stamp. tunnel.js has done it correctly all along. */
        vec4 mv = modelViewMatrix*instanceMatrix*vec4(position, 1.0);
        /* Distance fade, computed here rather than as fog so it costs
           nothing: the far crowd has to dissolve into the black or the plain
           acquires a visible edge where the wedge stops. */
        vFade = 1.0 - smoothstep(150.0, 340.0, -mv.z);
        /* And how much of the strobe reaches this far. A flash lights what is
           near it and nothing else — without this the whole wedge lifts
           together and the crowd reads as a printed backdrop rather than as
           people standing at different distances in one light. */
        vLit = 1.0/(1.0 + (-mv.z)/70.0);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${FIGURE_GLSL}
      uniform float uFlash;
      uniform float uBlaze;
      uniform vec3 uCol;
      varying vec2 vUv;
      varying vec4 vPose;
      varying float vFade;
      varying float vLit;
      /* Must match SPAN_X / SPAN_Y at the top of this file — see the note
         there. Written in as literals because a shader cannot import. */
      #define SPAN_X ${SPAN_X.toFixed(3)}
      #define SPAN_Y ${SPAN_Y.toFixed(3)}
      void main(){
        /* Both axes in units of the figure's HEIGHT, which is the whole reason
           the head is round: the quad is well over twice as tall as it is
           wide, so a radius written in UV space means two different things in
           x and in y. Here it means one. */
        vec2 p = vec2((vUv.x - 0.5)*SPAN_X, vUv.y*SPAN_Y);
        float d = figureDist(p, vPose);

        /* Antialiased by the field's own screen-space gradient rather than by
           a fixed epsilon. At the front of the wedge a figure is 300 pixels
           tall and at the back it is eight; one constant edge width cannot
           serve both, and the far crowd was crawling with aliasing because it
           was being asked to. */
        float w = max(fwidth(d), 0.0012);
        float a = smoothstep(w, -w, d)*vFade;
        if (a < 0.004) discard;

        /* At the end of the scene the eyes light everything, and 'everything'
           means these bodies: a red frontal fill that arrives from the same
           direction the eyes are pointing. Without it the blaze is a picture
           of lamps in a void and the crowd disappears at the exact moment it
           is supposed to be revealed. */
        /* Lit from above and in front, which is where a strobe on a plain
           would be. Flat fill is what made these read as cut paper: a body is
           a cylinder and the light has to fall off down it. */
        float shade = 0.55 + 0.45*smoothstep(0.0, 0.85, p.y);
        vec3 col = uCol*(0.10 + 0.90*uFlash)*vLit*shade
                 + vec3(1.00, 0.20, 0.09)*uBlaze*uBlaze*2.8*(0.25 + 0.75*vLit);
        gl_FragColor = vec4(col, a);
      }`
  });
  const m = new THREE.InstancedMesh(geo, mat, pos.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pos.length; i++){
    const f = pos[i];
    v.set(f.x, 0, f.z);
    q.setFromAxisAngle(up, f.yaw);
    s.set(f.w, f.h*SPAN_Y, 1);
    m.setMatrixAt(i, mm.compose(v, q, s));
  }
  m.instanceMatrix.needsUpdate = true;
  /* Written once. Nothing in update() touches this again — see the note at
     the top of the file; the stillness is the performance. */
  m.frustumCulled = false;
  return m;
}

function buildEyes(pos){
  /* One quad per figure, carrying both eyes. Additive and depth-tested but not
     depth-writing, so a nearer figure occludes the eyes behind it — which is
     most of what sells the crowd as having depth, because the eyes are the
     only thing bright enough to read at distance. */
  const geo = new THREE.PlaneGeometry(1, 1);

  /* Per-figure blink seed. The blink has to be a pure function of (t, seed) —
     no counters, no stored 'next blink at' — so the seed is the only state
     there is and everything else is arithmetic on the clock. */
  const aSeed = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i++) aSeed[i] = pos[i].seed;
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpen:  { value: 1 },
      /* How much of the frame's own exposure the eyes are allowed to ignore.
         A pair of eyes is a SOURCE; a source does not go out because the room
         light does, and this scene's exposure is on the beat grid — see the
         licensed exception in s09-dark.js. Kept apart from uOpen because uOpen
         means how far the crowd has closed and this means something else
         entirely, and a number that means two things is a number that will be
         tuned for one of them. */
      uLive:  { value: 1 },
      uTime:  { value: 0 },
      uBlaze: { value: 0 },
      /* How hurried the crowd is. 1 at the top of the scene, higher by the
         end — the blink rate is the one thing in this world that can rise
         without anything moving. */
      uRate:  { value: 1 },
      /* The blink's clock: the integral of uRate, handed in already
         accumulated — see the note at the use site for why the raw time will
         not do. */
      uClock: { value: 0 },
      uTrack: { value: new THREE.Vector2(0, 0) },
      uCol:   { value: new THREE.Color(1.00, 0.09, 0.05) }
    },
    vertexShader: /* glsl */`
      attribute float aSeed;
      varying vec2 vUv;
      varying float vFade;
      varying float vSeed;
      varying float vScale;
      varying vec2 vLook;
      uniform float uBlaze;
      void main(){
        vUv = uv;
        vSeed = aSeed;
        /* The quad grows for the blaze. It has to: the glow is written in the
           quad's own UV space, so a glow that reaches past the quad's edge is
           simply cut off there — the eyes would get brighter without getting
           bigger, which is a lamp turning up, not a light filling a room. */
        /* On the square, matching the glow's own curve in the fragment — see
           there. A quad that grows faster than the light inside it is wasted
           fill; one that grows slower crops the light. */
        vScale = 1.0 + 11.0*uBlaze*uBlaze;
        vec3 pos = position*vScale;
        mat4 mi = modelViewMatrix*instanceMatrix;
        vec4 mv = mi*vec4(pos, 1.0);

        /* Where the camera is, expressed in this head's own frame — which is
           what a pupil actually has to know. The quad's local axes are carried
           into view space, the direction from the head to the camera (the
           camera is the origin in view space) is projected onto them, and the
           result is a two-number 'the lens is over there, and up a bit'.

           A figure square to the lens gets (0, 0) and its pupils sit centred;
           one turned away gets a sideways component and its pupils slide to
           that side of the skull. This is also the coupling the drift needed:
           the camera moving changes the bearing of every head in the crowd,
           by a lot for the front row and by almost nothing for the back, so
           the eyes pick up the parallax for free and in exactly the same
           proportion the bodies do. */
        vec3 P  = (mi*vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 ex = normalize((mi*vec4(1.0, 0.0, 0.0, 0.0)).xyz);
        vec3 ey = normalize((mi*vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 toCam = normalize(-P);
        vLook = vec2(dot(toCam, ex), dot(toCam, ey));
        /* The eyes fade later than the bodies do — at the back of the crowd
           there is nothing left but pairs of red points, which is the image
           the shot list is after. */
        vFade = 1.0 - smoothstep(200.0, 400.0, -mv.z);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      uniform float uOpen, uLive;
      uniform float uTime;
      uniform float uBlaze;
      uniform float uRate;
      uniform float uClock;
      /* The camera's own movement, as a gaze offset every eye in the crowd
         shares — see the note at the use site. */
      uniform vec2 uTrack;
      uniform vec3 uCol;
      varying vec2 vUv;
      varying float vFade;
      varying float vSeed;
      varying float vScale;
      varying vec2 vLook;

      /* The head's radius in this quad's units. The quad is placed on the head
         and made 2.2 head radii across, so the head fills 1/2.2 of it. Every
         number in this shader that has to respect the skull is written against
         this one. */
      #define HEAD_RQ 0.4545

      /* Two independent randoms from an integer and a seed. Used for the gaze
         targets, which have to be reproducible from (k, seed) alone — the
         whole gaze is recomputed from scratch on every frame and must land on
         the same numbers, or a figure's eyes jitter instead of holding. */
      vec2 h22(float k, float seed){
        vec2 v = vec2(k*127.1 + seed*311.7, k*269.5 + seed*183.3);
        return fract(sin(v)*43758.5453) - 0.5;
      }

      void main(){
        /* Scaled BACK by exactly what the vertex shader scaled the quad up
           by, so the two eyes stay where they are on the head and only the
           room around them grows. The first pass left this out and the pair
           drifted apart as the blaze came up — two lamps rising off the skull
           like horns, which is a memorable image and not this one. */
        vec2 p = (vUv - 0.5)*vScale;

        /* The blink. A pure function of (t, seed): each figure has its own
           period and its own offset into it, and the lid is a triangle inside
           the first fifth of a second of each cycle — 55 ms shut, 115 ms open
           again, which is a measured human blink and reads as one.

           Deliberately NOT synchronised to anything. A crowd that blinks on
           the beat is a crowd operating machinery; a crowd whose blinks are
           uncorrelated is a crowd of individuals, and at 260 of them there is
           always one closing somewhere, which is the effect. */
        /* The shape of a blink, and the first version did not have it. It
           ramped shut over 55 ms and straight back open over 115 ms — a
           triangle, with the closed state existing for exactly one instant.
           At sixty frames a second that is a lid that is never actually down
           in any frame that gets rendered: the eye dims and brightens and
           nothing ever closes. What a blink actually is, is three phases —
           SHUT, HELD, OPEN — and the held phase is the one the eye reads.
           Forty milliseconds down, sixty held, ninety back up. */
        /* Which is timed off uClock, not off uTime, and that distinction cost
           a round. The obvious form — fract((t + offset)/period) with the
           period divided by a rate that rises through the scene — is wrong in
           a way that is invisible until you differentiate it: when the period
           itself moves, the phase advances at 1/P MINUS t·P'/P², and with t
           around 140 that second term is five times the first. The blink rate
           was therefore set by the absolute clock of the song rather than by
           anything in this scene, and the crowd blinked several times a second
           whatever the numbers said.

           The fix is to accumulate the rate rather than divide by it. uClock
           is the integral of uRate, computed in closed form by the scene, so
           the phase advances at exactly one period per period however the rate
           moves. Multiplying back out by P0 and dividing by the current rate
           puts ph in real seconds, which is what the shape below is written
           in. */
        float period = 1.7 + fract(vSeed*7.13)*3.6;
        float ph = fract(uClock/period + vSeed*3.137)*period/max(uRate, 0.2);
        float b = ph < 0.040 ? ph/0.040
                : ph < 0.100 ? 1.0
                : ph < 0.190 ? 1.0 - (ph - 0.100)/0.090
                : 0.0;
        float lid = 1.0 - b;
        /* Except at the end, when nothing blinks. Every eye in the crowd is
           open for the blaze — a blink inside it would read as a dropped
           frame. */
        lid = mix(lid, 1.0, uBlaze);

        /* Two points, mirrored. abs() on x rather than two distance
           evaluations: the pair is symmetric by construction and cannot drift
           apart.

           Tight, and that took a correction. The first pass separated them by
           0.235 of the quad and squashed them 2.6:1 vertically with a glow
           reaching 0.40 — at which point the two glows overlap across the gap
           and the pair renders as one horizontal bar. A crowd wearing visors,
           not a crowd with eyes. Narrower separation, rounder points and a
           glow that stops before it reaches its neighbour. */
        /* Within one head-width: eyes sit about a third of a head apart and
           slightly above the head's centre. The lid divides the vertical
           term, so a closing eye is squeezed to a line rather than dimmed to
           nothing — which is what a lid actually does to a light behind it. */
        /* The gaze. Eyes are not a lamp pointed at the lens: they hold a
           direction for a second or two and then dart to another one, and the
           dart is fast — about a tenth of a second — with the hold doing all
           the work in between. Linear drift would read as the whole crowd
           slowly scanning in unison, which is a searchlight; a step-and-hold
           per figure reads as two hundred and sixty people each looking at
           something of their own.

           Both eyes take the same offset, because both eyes of one head point
           the same way. The amplitude is small on purpose — a tenth of a head
           — since these are pupils inside a skull and not the skull turning. */
        float gp = 1.5 + fract(vSeed*3.71)*2.6;
        float gk = floor((uTime + vSeed*13.0)/gp);
        float gf = fract((uTime + vSeed*13.0)/gp);
        vec2 g = mix(h22(gk, vSeed), h22(gk + 1.0, vSeed),
                     smoothstep(0.0, 0.10, gf))*vec2(0.150, 0.085);

        /* And on top of the wander, the camera. Two terms, and they do
           different jobs:

             vLook is geometry — where the lens is from this head, computed in
             the vertex shader. It is a POSITION, so it changes as the camera
             drifts and it changes far more for the front row than for the
             back. That is the parallax coupling: the eyes and the bodies pick
             up the same drift in the same proportion, which is what stops the
             gaze reading as an effect laid over the shot.

             uTrack is the camera's VELOCITY, shared by the whole crowd. A head
             does not merely know where you are, it notices you moving, and it
             notices all at once. This is what the nudge at the top of the
             scene is for: the camera settles, and two hundred and sixty pairs
             of eyes flick at the same instant. Nothing else in this world can
             do anything at the same instant. */
        g += vLook*vec2(0.20, 0.16) + uTrack;

        /* Keep them in the skull. The wander, the bearing and the velocity are
           three independent terms and there is no amplitude at which their sum
           is guaranteed small, so rather than tuning each one down until they
           cannot collide, the sum is clamped against the head itself.

           The clamp is RADIAL, on the outer eye — the one that would leave
           first — so an eye driven past the edge slides along the rim instead
           of stopping dead against it, which is what an eye at the corner of
           its socket actually looks like. HEAD_RQ is the head's radius in this
           quad's units: the quad is 2.2 head radii across, so the head fills
           1/2.2 of it, and the margin is the eye's own visible radius. */
        const float RMAX = HEAD_RQ - 0.105;
        const vec2 EYE0 = vec2(0.165, 0.045);
        float sx = g.x >= 0.0 ? 1.0 : -1.0;
        vec2 outer = vec2(EYE0.x + abs(g.x), EYE0.y + g.y);
        float L = length(outer);
        if (L > RMAX){
          outer *= RMAX/L;
          g = vec2(sx*max(0.0, outer.x - EYE0.x), outer.y - EYE0.y);
        }

        vec2 q = p - g;
        float d = length(vec2(abs(q.x) - EYE0.x, (q.y - EYE0.y)*1.35/max(lid, 0.10)));
        float core = smoothstep(0.062, 0.0, d);
        /* The glow, and only the glow, is what the blaze grows — and it grows
           on the SQUARE. Linearly, the two glows had already merged across the
           gap between the eyes by the time the blaze was a tenth up, so the
           last two seconds of the scene were a crowd with one lamp per head
           instead of a crowd with eyes. Squared, the pair stays a pair until
           the light is genuinely taking the frame. */
        float bz = uBlaze*uBlaze;
        float glow = smoothstep(0.200 + 3.20*bz, 0.0, d);
        /* And the lid takes the light with it. Squashing alone left a thin
           bright line behind a closed eyelid, which with bloom on top is not
           noticeably different from an open eye — the other half of why the
           blink did not read. A lid is opaque: below a fifth open there is
           nothing to see. */
        float shut = smoothstep(0.0, 0.20, lid);

        /* And the skull, as a mask rather than as a promise.
 
           The clamp above keeps the eye's CENTRE inside the head, which is not
           the same as keeping the eye inside the head: the core has a radius of
           its own and the glow has a much larger one, so a pupil parked at the
           rim still puts light outside the silhouette. And a clamp is only ever
           as good as the arithmetic behind it — three independent terms, a
           quad whose scale changes, a head whose centre moves with the lean.
           Every one of those is a place to be off by a little.
 
           This is not off by anything. The head is a disc of known radius
           centred on this quad, so everything the eye draws is multiplied by
           that disc and nothing can be outside it, whatever the terms above do.
           The clamp is still worth having — it is what makes an eye SLIDE
           along the rim instead of being sliced by it — but the mask is what
           makes the rule true.
 
           Released for the blaze, where the light is supposed to leave the
           head and take the frame with it. */
        float mask = mix(smoothstep(HEAD_RQ, HEAD_RQ - 0.055, length(p)), 1.0, uBlaze);

        float a = (core*1.0 + glow*(0.20 + 2.6*bz))*uOpen*uLive*vFade*shut*mask;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uCol*(0.55 + 0.45*core)*(1.0 + 12.0*bz), a);
      }`
  });
  const m = new THREE.InstancedMesh(geo, mat, pos.length);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pos.length; i++){
    const f = pos[i];
    /* The eye plane has to sit slightly in front of the body plane or the
       depth test throws it away — they are otherwise coplanar. WHICH WAY it is
       pushed is the whole question, and the first version got it wrong.

       It was pushed along the figure's own facing, six hundredths of the body
       quad's width, which is more than half a head radius. For a figure square
       to the lens that is straight towards the camera and invisible; for one
       turned fifty degrees it is mostly SIDEWAYS, and it slid the eye quad
       right off the head it belonged to. That is the report — a handful of
       figures with their eyes outside their heads, and the handful was exactly
       the twenty-odd per cent of the crowd with a big yaw.

       Pushed along the view ray instead — from the figure toward where the
       camera stands — the offset has no lateral component at all, by
       construction. The camera drifts a few units over the scene and the
       figure is tens or hundreds away, so the residual is far under a pixel.
       A third of a head radius is ample depth separation at every distance in
       the wedge, and it moves nothing on screen. */
    const nx = -f.x, nz = -f.z;
    const nl = Math.max(1e-6, Math.hypot(nx, nz));
    const fwd = f.h*HEAD_R*0.30;
    /* At the head's centre and sized to the HEAD, not to the body quad. The
       silhouette puts the head at HEAD_Y of the figure's height with a radius
       of HEAD_R of it, and the pose's lean shifts it sideways by exactly
       HEAD_LEAN*lean — all three constants are the ones the shader reads, so
       the eyes cannot end up outside the skull however the figure is posed.
       Sizing this off f.w, as the first pass did, made it as wide as the
       shoulders. */
    const lx = HEAD_LEAN*f.lean*f.h;
    v.set(f.x + Math.cos(f.yaw)*lx + (nx/nl)*fwd,
          f.h*HEAD_Y,
          f.z - Math.sin(f.yaw)*lx + (nz/nl)*fwd);
    q.setFromAxisAngle(up, f.yaw);
    s.set(f.h*HEAD_R*2.2, f.h*HEAD_R*2.2, 1);
    m.setMatrixAt(i, mm.compose(v, q, s));
  }
  m.instanceMatrix.needsUpdate = true;
  m.frustumCulled = false;
  return m;
}

function buildPlain(){
  /* The ground, and it is almost not there. A plain that the strobe catches
     even faintly gives the crowd somewhere to stand and the frame a horizon
     to have figures against; without it they hang in a void and the scene
     becomes S12 with people in it. Deliberately much darker than the figures
     so it never becomes a surface anyone looks at. */
  const geo = new THREE.PlaneGeometry(1600, 1600, 1, 1);
  geo.rotateX(-Math.PI/2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFlash: { value: 0 }, uBlaze: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main(){
        vW = position;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      uniform float uFlash;
      uniform float uBlaze;
      varying vec3 vW;
      void main(){
        float d = length(vW.xz);
        float near = 1.0 - smoothstep(30.0, 210.0, d);
        /* Very dark. The ground exists so the crowd has somewhere to stand
           and the frame has a horizon; the moment it becomes a surface worth
           looking at, the figures stop being the subject. */
        float g = 0.0022 + 0.0060*fbm(vW.xz*0.010);
        vec3 col = vec3(g*0.95, g*0.92, g)*near*(0.12 + 1.3*uFlash);
        /* The blaze reaches the floor too, and it has to reach further than
           the strobe does — a room lit by two hundred pairs of eyes has no
           falloff worth speaking of at this scale. */
        col += vec3(0.55, 0.10, 0.05)*uBlaze*uBlaze*(0.30 + 0.70*near);
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

export class Dark {
  /** `views`: camera positions this scene will actually look from, used to
      keep heads from overlapping on screen — see figurePositions(). */
  constructor({ views } = {}){
    const pos = figurePositions(views);
    this.plain   = buildPlain();
    this.figures = buildFigures(pos);
    this.eyes    = buildEyes(pos);
    this.group = new THREE.Group();
    this.group.add(this.plain, this.figures, this.eyes);
  }

  /** flash: the strobe, 0..1. open: how much of the eyes is showing — the one
      thing in this world that is allowed to be visible between flashes.
      blaze: the end of the scene, 0..1, where the eyes become the light. */
  update(t, { flash = 0, open = 1, blaze = 0, rate = 1, clock = 0, track, live } = {}){
    this.figures.material.uniforms.uFlash.value = flash;
    this.figures.material.uniforms.uBlaze.value = blaze;
    this.plain.material.uniforms.uFlash.value = flash;
    this.plain.material.uniforms.uBlaze.value = blaze;
    this.eyes.material.uniforms.uOpen.value = open;
    if (live !== undefined) this.eyes.material.uniforms.uLive.value = live;
    this.eyes.material.uniforms.uBlaze.value = blaze;
    this.eyes.material.uniforms.uRate.value = rate;
    this.eyes.material.uniforms.uClock.value = clock;
    if (track) this.eyes.material.uniforms.uTrack.value.copy(track);
    /* The blink's and the gaze's only input. A time, not an increment. */
    this.eyes.material.uniforms.uTime.value = t;
  }

  debugLayers(){ return { plain: this.plain, figures: this.figures, eyes: this.eyes }; }

  dispose(){
    for (const m of [this.plain, this.figures, this.eyes]){
      m.geometry.dispose(); m.material.dispose();
    }
  }
}
