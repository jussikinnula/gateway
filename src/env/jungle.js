import * as THREE from 'three';
import { NOISE, HEIGHT_FOG, EXTINCT } from '../core/glsl.js';

/* Density of the air at head height. Scaled per frame by the caller — mist
   sits low, and this world is looked at from twenty-five metres up for a
   third of its scene. */
const FOG_BASE = 0.055;

/* The jungle.
 *
 * The first world, and the one the film spends longest in, so it is the one
 * that has to be beautiful rather than merely legible.
 *
 * Everything recycles along the travel axis by a modulo on the camera's own
 * distance: an element sits at a fixed place in the world until it falls behind
 * the camera, then jumps a span forward, where it cannot be seen doing it. That
 * keeps the geometry count constant however far the shot travels, and — because
 * the jump is arithmetic on the camera position rather than a counter — every
 * frame is still a pure function of its own time.
 *
 * The light is one direction, from above and ahead, and every surface here
 * reads it the same way: a dapple field sampled in world space, so the sunlight
 * falling through the canopy lands on the ground, the trunks and the leaves in
 * the same places. Without that shared field the three populations look like
 * three separate objects lit by three separate lamps.
 */

/* A leaf as geometry, not as a hole punched in a card.
 *
 * The first two versions drew each leaf as a quad and discarded the fragments
 * outside its outline. That is the standard trick and it is the wrong one here:
 * a discard is a hard, per-pixel yes-or-no, so the silhouette gets no
 * antialiasing at all, and nine thousand of them turn the middle distance into
 * crawling black speckle. Antialiasing the alpha and asking for
 * alpha-to-coverage did not fix it either — coverage is only as good as the
 * multisample state it lands in, and it is one more thing that has to be true.
 *
 * A real outline has none of those problems. Twenty-six triangles a leaf is
 * nothing to a GPU, the edge is ordinary geometry, and the multisampling the
 * renderer is already paying for antialiases it like everything else. */
function leafGeometry(seg = 15){
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++){
    const y = -0.5 + i/seg;
    const hw = 0.26*(1 - (2*y)*(2*y)) + 0.004;
    pos.push(-hw, y, 0, hw, y, 0);
    uv.push(-hw + 0.5, y + 0.5, hw + 0.5, y + 0.5);
  }
  for (let i = 0; i < seg; i++){
    const a = i*2;
    idx.push(a, a+1, a+2, a+1, a+3, a+2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* A palm frond: a rib with leaflets down both sides. In this light it is a
   flat silhouette, so all that matters is the outline — and a fern or a palm is
   recognisable entirely by its outline, which is why they are worth having when
   nothing else in the frame has any detail at all. */
function frondGeometry(pairs = 15){
  const pos = [], uv = [], idx = [];
  let n = 0;
  for (let i = 0; i < pairs; i++){
    const y = -0.5 + (i + 0.5)/pairs;
    const taper = Math.sin(Math.PI*(i + 0.6)/pairs);
    const len = 0.42*taper*taper*0.9 + 0.05*taper;
    const droop = 0.05*taper;
    for (const sgn of [-1, 1]){
      pos.push(0, y, 0,
               sgn*len, y - droop - 0.018, 0,
               sgn*len*0.55, y + 0.030*taper, 0);
      uv.push(0.5, y + 0.5, 0.5 + sgn*0.5, y + 0.5, 0.5 + sgn*0.3, y + 0.5);
      idx.push(n, n + 1, n + 2); n += 3;
    }
  }
  // the rib itself
  const rw = 0.012;
  pos.push(-rw, -0.5, 0, rw, -0.5, 0, -rw, 0.5, 0, rw, 0.5, 0);
  uv.push(0.5, 0, 0.5, 0, 0.5, 1, 0.5, 1);
  idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* The walkway occupies a corridor, and nothing organic may grow inside it.
 *
 * Leaves and fronds are placed once and then recycle along the path, so a leaf
 * whose x happens to be zero will pass through the deck on every single lap —
 * and because it recycles, it does it forever. The fix belongs at placement,
 * not at draw time: anything inside the corridor is pushed to its edge, keeping
 * the side it was on so the distribution stays even.
 *
 * DECK and HALF here must match the walkway built in update(). */
const DECK = 1.05, CLEAR_X = 1.75;
/* The clearance is a shaft, not a tunnel. It was a tunnel — cleared to head
   height and closed above — and the shot that rises off the walkway therefore
   went straight up through the foliage, which looks exactly like what it is.
   A cleared path lets light down, so the gap widens with height: a funnel from
   the handrail to the canopy. The camera can then rise without passing through
   anything, and the light on the deck has somewhere to have come from. */
/* And the funnel is ASYMMETRIC, because the camera move it exists for is.
 *
 * 'Lehdet kameran oikealla puolella lentelevät kameran osuessa.'
 *
 * The canopy shot steps the camera off the centre line — that was the fix for
 * a bilaterally symmetric frame — and it always steps the same way: its lateral
 * offset is high*(6.2 + 3.4*sin), which is between 2.8 and 9.6 units to the
 * RIGHT and never negative. The funnel was cleared around x = 0 at 0.115 per
 * unit of height, which is 3.6 units wide up at canopy level. So the camera
 * spent the whole shot six units outside the cleared shaft, flying through the
 * leaf field, and every frond it passed through was pushed aside by the
 * displacement in the vertex shader — which is what 'flying leaves' is.
 *
 * Clearing it symmetrically would take twice as much foliage out of the canopy
 * for no reason: nothing is ever on the left up there. So the right side opens
 * at 0.62 per unit and the left keeps 0.115. At canopy height that is 13.4
 * units of clearance against a camera that reaches 9.6 — enough for the lens
 * and a leaf's own width — and the left-hand half of the frame, which is what
 * the shot is mostly looking at, is as dense as it ever was. */
function clearRadius(y, side){
  const h = Math.max(0, y - (DECK - 2.2));
  return CLEAR_X + h*(side > 0 ? 0.62 : 0.115);
}
function clearCorridor(x, y){
  if (y < DECK - 2.2) return x;
  const side = x < 0 ? -1 : 1;
  const R = clearRadius(y, side);
  if (Math.abs(x) >= R) return x;
  return side*(R + (R - Math.abs(x))*0.9);
}

const RND = (i, salt) => {
  let x = (i*2654435761 + salt*40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
};

/* The shared light. Sampled by everything, in world space. */
const AIR = /* glsl */`
/* The colour of distance. A jungle's haze is not one colour: at the horizon it
   is the dark green of a hundred metres of leaves, and overhead it is the
   canopy light coming through. Mixing by the view direction is what removes the
   horizon line — without it the ground fades to one value and the sky to
   another, and the join is a hard edge across the frame. */
vec3 airColour(vec3 dir, vec3 haze, vec3 sky){
  return mix(haze, sky, smoothstep(-0.06, 0.62, dir.y));
}
/* The one bright thing. Everything else in this world is a silhouette, and the
   silhouettes only work because there is something behind them to be dark
   against — a glow far down the path, the way a gap in a canopy reads from
   inside the trees. It is the reason the scene can be this dark and still be
   readable, and it is the shot's leading line. */
vec3 airGlow(vec3 dir, vec3 glow){
  float f = max(0.0, -dir.z);
  float lobe = pow(f, 34.0)*3.4 + pow(f, 7.0)*0.55 + pow(f, 2.0)*0.10;
  lobe *= smoothstep(-0.30, 0.25, dir.y);
  return glow*lobe;
}
/* The same glow, weighted by how far away the surface actually is.
   Applying the full lobe through every surface's fog term was what turned the
   trunks velvet green: a trunk twelve metres ahead is pointing almost straight
   down the axis, so it collected the whole vanishing-point glow through a
   thirty-percent fog mix. The glow lives at the end of the corridor. Near
   things are supposed to be silhouettes against it, which means they must not
   be lit by it. */
vec3 airGlowAt(vec3 dir, vec3 glow, float dist){
  return airGlow(dir, glow)*smoothstep(70.0, 420.0, dist);
}`;

/* Four torches, the four nearest, chosen on the CPU. Four is enough: past the
   third the falloff has already taken the contribution below the grain floor,
   and a loop over ninety of them per fragment is not affordable. */
const TORCH = /* glsl */`
vec3 torchLight(vec3 P, vec3 N, vec4 T[4], vec3 col){
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++){
    vec3 d = T[i].xyz - P;
    float r2 = dot(d, d) + 1.0;
    float lam = clamp(dot(N, normalize(d)), 0.0, 1.0);
    sum += col*T[i].w*(0.25 + 0.75*lam)/r2;
  }
  return sum;
}`;

const DAPPLE = /* glsl */`
float dapple(vec2 xz, float time){
  float a = fbm(xz*0.028 + vec2(time*0.055, time*0.021));
  float b = fbm(xz*0.115 - vec2(time*0.031, time*0.043));
  float d = a*0.68 + b*0.42;
  /* Sparse on purpose. A broad, gentle dapple lights the whole floor to a mid
     value and the floor goes pale — which is the opposite of a jungle, where
     almost everything is dark and the few lit patches are what the eye goes to.
     The threshold is high and the curve is steep so most of the field is zero. */
  return pow(clamp(smoothstep(0.52, 0.92, d), 0.0, 1.0), 2.4);
}`;

/* smoothstep, on the CPU. */
const SS = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a)/(b - a))); return t*t*(3 - 2*t); };

export class Jungle {
  constructor({ span = 900, trunks = 120, leaves = 9000, shafts = 150, motes = 3000,
                canopyY = 36, halfWidth = 105 } = {}){
    this.span = span; this.canopyY = canopyY;
    this.group = new THREE.Group();
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._yax = new THREE.Vector3(0,1,0);
    this._zax = new THREE.Vector3(0,0,1);

    const COMMON = `${NOISE}\n${DAPPLE}\n${AIR}\n${TORCH}\n${HEIGHT_FOG}\n${EXTINCT}`;
    const U = () => ({
      uTime:{value:0}, uCam:{value:new THREE.Vector3()}, uSun:{value:new THREE.Vector3(0.30,0.86,-0.42)},
      uSunCol:{value:new THREE.Color(1.00,0.94,0.70)}, uAmb:{value:new THREE.Color(0.008,0.020,0.017)},
      uTorch:{value:[new THREE.Vector4(),new THREE.Vector4(),new THREE.Vector4(),new THREE.Vector4()]},
      uTorchCol:{value:new THREE.Color(1.00,0.52,0.18)},
      uGlowZ:{value:0},
      uDrain:{value:0}, uDrainCol:{value:new THREE.Color(0.42,0.86,1.0)}, uFog:{value:FOG_BASE},
      uHaze:{value:new THREE.Color(0.016,0.031,0.024)},
      uSky:{value:new THREE.Color(0.10,0.15,0.11)},
      uGlow:{value:new THREE.Color(1.70,2.05,1.80)}
    });
    this.mats = [];
    const reg = m => { this.mats.push(m); return m; };

    /* ---- the air --------------------------------------------------------- */
    /* A backdrop in exactly the colour the fog resolves to, so nothing in the
       scene ever reaches an edge: the ground dissolves into the same value the
       sky already is, and there is no horizon to see. */
    const dg = new THREE.SphereGeometry(1800, 32, 24);
    this.dome = new THREE.Mesh(dg, reg(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: U(),
      vertexShader: `varying vec3 vD;
        void main(){ vD = normalize(position);
          gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */`precision highp float;
        ${COMMON}
        uniform vec3 uHaze, uSky, uDrainCol, uGlow; uniform float uDrain;
        varying vec3 vD;
        void main(){
          vec3 col = airColour(vD, uHaze, uSky) + airGlow(vD, uGlow);
          /* The dome is the sky: it is past where the air saturates by
             definition, so it takes the full extinction and nothing else in the
             frame may be darker than it. */
          gl_FragColor = vec4(extinct(mix(col, uDrainCol*0.45, uDrain), EXT_MAX), 1.0);
        }`
    })));
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    this.group.add(this.dome);

    /* ---- the canopy ------------------------------------------------------- */
    /* The design document promised a shot that rises through the canopy, and
       until now there was no canopy to rise through — only progressively fewer
       leaves. A ceiling makes the move an event: dark underneath, a gap opens,
       and then you are above it. It is one plane, and the gaps are the same
       dapple field the shafts and the ground already read, so the light that
       falls through a hole lands under that hole. */
    const cgeo = new THREE.PlaneGeometry(2600, 2600, 220, 220);
    cgeo.rotateX(-Math.PI/2);
    this.canopy = new THREE.Mesh(cgeo, reg(new THREE.ShaderMaterial({
      uniforms: U(), side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        ${NOISE}
        uniform float uTime;
        varying vec3 vW;
        void main(){
          vec4 w = modelMatrix*vec4(position,1.0);
          w.y += fbm(w.xz*0.014)*7.0 + fbm(w.xz*0.07)*1.6 - 4.0;
          vW = w.xyz;
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW;
        void main(){
          float d = dapple(vW.xz, uTime);
          float gap = smoothstep(0.34, 0.72, d);
          float above = step(vW.y, uCam.y);
          /* From underneath it is a lid with holes burning through it. From
             above it is the top of the forest, lit. */
          vec3 under = vec3(0.003,0.007,0.004) + uSky*gap*3.2 + uSunCol*pow(gap,3.0)*2.6;
          vec3 over  = vec3(0.020,0.052,0.024)*(0.5 + 0.9*fbm(vW.xz*0.09))
                     + uSunCol*(0.35 + 0.5*d)*0.30;
          vec3 col = mix(under, over, above);
          col = mix(col, uDrainCol*(0.10 + 0.5*gap), uDrain);
          float dist = length(vW - uCam);
          vec3 dir = normalize(vW - uCam + vec3(0.0,1e-5,0.0));
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    })));
    this.canopy.frustumCulled = false;
    this.group.add(this.canopy);

    /* ---- ground ---------------------------------------------------------- */
    const gg = new THREE.PlaneGeometry(2600, 2600, 300, 300);
    gg.rotateX(-Math.PI/2);
    this.ground = new THREE.Mesh(gg, reg(new THREE.ShaderMaterial({
      uniforms: U(),
      vertexShader: /* glsl */`
        ${COMMON}
        uniform float uTime; uniform vec3 uCam;
        varying vec3 vW; varying float vH;
        void main(){
          vec4 w = modelMatrix*vec4(position,1.0);
          float h = fbm(w.xz*0.012)*5.2 + fbm(w.xz*0.06)*1.1;
          /* Flattened and dropped along the corridor the walkway runs down.
             Undulating terrain that rises through the deck is worse than no
             terrain at all — the path has to be the thing you are standing on. */
          /* pow(x, 2.0) is NOT a squaring in GLSL.
             The spec leaves pow() undefined for a negative base, and the usual
             implementation is exp2(y*log2(x)) — so log2 of a negative number,
             which is NaN. Half of this plane has a negative x, so half the
             ground's vertices came back NaN: garbage triangles on the floor,
             and NaN into the colour buffer, which the bloom downsample then
             spreads into black blocks. All three symptoms, one call.
             A squaring is written as a multiply. It is also faster. */
          float cx = w.x/9.0;
          float corridor = 1.0 - exp(-cx*cx);
          w.y += (h - 3.4)*corridor - 3.2;
          vW = w.xyz; vH = h;
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW; varying float vH;
        void main(){
          float d = dapple(vW.xz, uTime);
          /* A jungle floor is dark. Almost all of what light gets down here
             arrives in patches, and the wet ground throws those back rather
             than diffusing them — but the patches are small and the rest is
             nearly black, which is what makes the patches read. */
          vec3 wet = vec3(0.008, 0.019, 0.011)*(0.5 + fbm(vW.xz*0.4));
          vec3 V = normalize(uCam - vW + vec3(0.0, 1e-5, 0.0));
          float spec = pow(clamp(V.y, 0.0, 1.0), 3.0)*pow(clamp(d, 0.0, 1.0), 1.6);
          /* Where the light does reach the floor it lands on standing water,
             and standing water does not glow — it glitters. High-frequency,
             thresholded hard so it is a scatter of points rather than a sheen,
             and drifting slowly so it lives. */
          vec2 spW = vW.xz*3.1;
          float sp = fbm(spW + vec2(uTime*0.13, -uTime*0.09));
          /* A glitter field is a repeating pattern, and a repeating pattern has
             to disappear when one pixel spans more than one of its lobes. Left
             unfaded it does not get finer with distance — it aliases into a
             scatter of full-strength white points that reads as confetti lying
             on the floor, which is what the ×11 was making of it. Fade by the
             pattern's own pixel footprint and it thins out the way glitter
             actually does. */
          float spFp = max(fwidth(spW.x), fwidth(spW.y));
          float spFade = 1.0 - smoothstep(0.18, 0.75, spFp);
          float sparkle = pow(smoothstep(0.54, 0.74, sp), 5.0)
                        * pow(clamp(d, 0.0, 1.0), 1.3)
                        * (0.35 + 0.65*clamp(V.y, 0.0, 1.0))
                        * spFade;
          vec3 col = wet + uAmb*0.35 + uSunCol*clamp(d,0.0,1.0)*0.30 + uSunCol*spec*0.34
                   + uSunCol*sparkle*2.6
                   + torchLight(vW, vec3(0.0,1.0,0.0), uTorch, uTorchCol)*3.0;
          col = mix(col, uDrainCol*(0.05 + 0.35*d), uDrain);
          /* Distance is the haze, and the haze is bright: it is the light that
             got through the canopy a hundred metres away. Everything dissolves
             into it, so the ground never shows an edge. */
          vec3 dir = normalize(vW - uCam + vec3(0.0, 1e-5, 0.0));
          float dist = length(vW - uCam);
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    })));
    this.ground.frustumCulled = false;
    this.group.add(this.ground);

    /* ---- trunks ---------------------------------------------------------- */
    this.nTrunk = trunks;
    this._trunkSeed = null;
    this._tk = [];
    for (let i = 0; i < trunks; i++){
      this._tk.push({
        /* Sign and magnitude must not come off the same draw: with one salt
           for both, a trunk is on the left exactly when its distance from the
           path is in the near half, so every near trunk is on the left and
           every far one is on the right. */
        x: (RND(i,1) < 0.5 ? -1 : 1)*(3.6 + (halfWidth - 3.6)*RND(i,5)),
        f: span*RND(i,2),
        r: 1.15 + 3.4*RND(i,3)*RND(i,4),
        h: 40 + 52*RND(i,5),
        lean: (RND(i,6)*2 - 1)*0.12,
        rot: RND(i,7)*6.283
      });
    }
    /* The first version drew a trunk as a straight open cylinder, uniformly
       dark, ending flat on the ground. Ninety of those read exactly as what
       they are: black vertical bars ruled across the frame. A trunk needs three
       things to stop being a line — it has to taper hard, it has to lean and
       bend, and it has to flare where it meets the ground. All three are in the
       vertex shader, driven by the instance's own seed. */
    const tg = new THREE.CylinderGeometry(0.30, 1.0, 1, 11, 26, true);
    tg.translate(0, 0.5, 0);
    const tseed = new Float32Array(trunks);
    for (let i = 0; i < trunks; i++) tseed[i] = RND(i, 8)*100;
    tg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(tseed, 1));
    this.trunks = new THREE.InstancedMesh(tg, reg(new THREE.ShaderMaterial({
      uniforms: U(), side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        ${NOISE}
        attribute float aSeed;
        uniform float uTime;
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec3 p = position;
          float u = p.y;                                  // 0 at the base, 1 at the top
          /* buttress flare */
          float flare = 1.0 + 2.6*exp(-u*26.0)*(0.55 + 0.9*vnoise(vec2(atan(p.z,p.x)*2.4, aSeed)));
          p.xz *= flare;
          /* lean and bend, both from the seed, so no two are the same line */
          float lean = (vnoise(vec2(aSeed, 3.1))*2.0 - 1.0)*0.16;
          float bend = (vnoise(vec2(aSeed*1.7, 8.3))*2.0 - 1.0)*0.10;
          p.x += lean*u + bend*u*u;
          p.z += bend*u - lean*u*u*0.6;
          /* the whole thing breathes a little */
          p.x += sin(uTime*0.31 + aSeed*4.1)*u*u*0.035;
          vec4 w = modelMatrix*instanceMatrix*vec4(p, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(instanceMatrix)*vec3(normal.x, 0.0, normal.z));
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW; varying vec3 vN;
        void main(){
          float d = dapple(vW.xz + vN.xz*3.0, uTime);
          float lam = clamp(dot(normalize(vN), normalize(uSun)), 0.0, 1.0);
          /* Wet dark wood. The green came from the ambient and the glow, not from
             the bark, but the bark was not fighting it either. */
          vec3 bark = vec3(0.040, 0.030, 0.024)*(0.5 + 0.9*fbm(vW.xz*2.2 + vW.y*0.18));
          /* Rim. A trunk against a bright canopy is a silhouette with a lit
             edge, and the edge is most of what the eye uses to read depth here. */
          vec3 V = normalize(uCam - vW + vec3(0.0, 1e-5, 0.0));
          /* clamp, not max: a dot product of two unit vectors can come back a
             hair over 1.0 on real hardware, 1.0 - that is negative, and pow() of
             a negative base is NaN. One NaN pixel is not one bad pixel — it goes
             into the bloom chain, the downsample smears it across a tile, and
             the frame gets a black block. That is the artefact. */
          float rim = pow(clamp(1.0 - dot(normalize(vN), V), 0.0, 1.0), 2.6);
          vec3 col = bark*0.55 + uAmb*0.14 + uSunCol*lam*d*0.16
                   + uSunCol*rim*(0.012 + 0.10*d)
                   + torchLight(vW, normalize(vN), uTorch, uTorchCol)*2.2;
          col = mix(col, uDrainCol*(0.06 + 0.35*rim), uDrain);
          vec3 dir = normalize(vW - uCam + vec3(0.0, 1e-5, 0.0));
          float dist = length(vW - uCam);
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    })), trunks);
    this.trunks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.trunks.frustumCulled = false;
    this.group.add(this.trunks);

    /* ---- the walkway ------------------------------------------------------ */
    /* A path is what the reference has that the first version did not, and it
       does two things at once: it gives the eye a line straight to the light,
       and it puts a hard, man-made edge in a frame that is otherwise all soft
       organic shapes — which is what makes the organic shapes read as organic. */
    this.nPlank = 150;
    const pg = new THREE.BoxGeometry(1, 1, 1);
    const plankMat = reg(new THREE.ShaderMaterial({
      uniforms: U(),
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec3 vN; varying vec3 vL;
        void main(){
          vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0);
          vW = w.xyz; vL = position;
          vN = normalize(mat3(instanceMatrix)*normal);
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW; varying vec3 vN; varying vec3 vL;
        void main(){
          float d = dapple(vW.xz, uTime);
          vec3 N = normalize(vN);
          float grain = 0.7 + 0.5*fbm(vec2(vW.x*7.0, vW.z*1.4));
          vec3 wood = vec3(0.020,0.015,0.010)*grain;
          float up = clamp(N.y, 0.0, 1.0);
          vec3 col = wood + uAmb*0.35 + uSunCol*d*up*0.14
                   + torchLight(vW, N, uTorch, uTorchCol)*1.5;
          float dist = length(vW - uCam);
          vec3 dir = normalize(vW - uCam + vec3(0.0,1e-5,0.0));
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    }));
    this.planks = new THREE.InstancedMesh(pg, plankMat, this.nPlank);
    this.planks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.planks.frustumCulled = false;
    /* rails and hangers, same material */
    this.nRail = 220;
    this.rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), plankMat, this.nRail);
    this.rails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rails.frustumCulled = false;
    this.group.add(this.planks, this.rails);

    /* ---- torches ----------------------------------------------------------- */
    this.nTorch = 26;
    this._to = [];
    for (let i = 0; i < this.nTorch; i++){
      this._to.push({
        side: (i % 2) ? 1 : -1,
        f: (i/this.nTorch)*span + 9*RND(i,101),
        y: 2.2 + 1.1*RND(i,102),
        k: RND(i,103)
      });
    }
    /* No instanceColor here either. USE_INSTANCING_COLOR is a renderer-added
       define on a driver-dependent code path, and it is the one thing that
       differed between the software rasteriser I render on and the GPU that
       showed the artefact. An instanced float we own outright behaves the same
       everywhere, and the output is hard-clamped so no value can overflow a
       half-float target and arrive at the tonemapper as an infinity. */
    const flGeo = new THREE.PlaneGeometry(1,1);
    const flAmt = new Float32Array(this.nTorch);
    const flAttr = new THREE.InstancedBufferAttribute(flAmt, 1);
    flAttr.setUsage(THREE.DynamicDrawUsage);
    flGeo.setAttribute('aAmt', flAttr);
    this._flAmt = flAmt;
    this.flames = new THREE.InstancedMesh(flGeo, reg(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(2.20, 1.05, 0.32) } },
      vertexShader: `attribute float aAmt;
        varying vec2 vUv; varying float vAmt; varying float vD;
        void main(){ vUv = uv; vAmt = aAmt;
          vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.0);
          vD = length(mv.xyz);
          gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `precision highp float;
        ${EXTINCT}
        uniform vec3 uCol;
        varying vec2 vUv; varying float vAmt; varying float vD;
        void main(){
          vec2 p = vUv*2.0 - 1.0;
          float r = length(p*vec2(1.5, 0.85));
          float core = 1.0 - smoothstep(0.0, 0.55, r);
          float halo = 1.0 - smoothstep(0.0, 1.0, length(p*0.72));
          vec3 c = extinct(uCol*clamp(vAmt, 0.0, 1.0)*(core*core*2.2 + halo*halo*0.55), vD);
          gl_FragColor = vec4(clamp(c, vec3(0.0), vec3(8.0)), 1.0);
        }`
    })), this.nTorch);
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flames.frustumCulled = false;
    this.flames.renderOrder = 8;

    /* THE STAKES THE FLAMES ARE ON.
     *
     * Without them a torch is a light hanging in mid-air, which is what these
     * were: an additive billboard at two and a half metres and nothing under
     * it. One box each, from the ground to just under the flame, on the
     * walkway's own plank material — near-black wood that the torch above it
     * lights, fogs with distance and extincts like everything else. A stake in
     * a flat black would not fade into the air with the rest of the world and
     * would read as pasted on; the point is not that it is black, it is that
     * it is WOOD IN THE DARK, which is nearly the same colour and behaves
     * completely differently at fifty metres. */
    /* Its own material, and the difference from the planks' is the point. A
       stake standing directly under a flame catches the full torch term, and
       on the walkway's wood — which is lit for a deck you are walking on —
       that comes back the colour of the rails: a bright yellow post with a
       light on top, which is a lamp standard, not a torch. Darker wood and a
       third of the response puts it back to what it is, a charred stick that
       is only just visible under its own flame. Everything else — fog, the
       air's colour, extinction — is the same, because those are properties of
       the world and not of the object. */
    const stakeMat = reg(new THREE.ShaderMaterial({
      uniforms: U(),
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0);
          vW = w.xyz;
          vN = normalize(mat3(instanceMatrix)*normal);
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec3 N = normalize(vN);
          float grain = 0.6 + 0.6*fbm(vec2(vW.y*9.0, vW.x*3.0));
          vec3 wood = vec3(0.011,0.0085,0.0065)*grain;
          vec3 col = wood + uAmb*0.16
                   + torchLight(vW, N, uTorch, uTorchCol)*0.30;
          float dist = length(vW - uCam);
          vec3 dir = normalize(vW - uCam + vec3(0.0,1e-5,0.0));
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    }));
    this.stakes = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), stakeMat, this.nTorch);
    this.stakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stakes.frustumCulled = false;
    this.group.add(this.stakes);
    this.group.add(this.flames);

    /* ---- branches -------------------------------------------------------- */
    /* Something to pass through. Trunks alone give a room with posts in it; what
       makes a jungle feel like a jungle from inside is that the space keeps
       being crossed at head height, so the eye is constantly given something to
       go behind. */
    this.nBranch = 700;
    this._br = [];
    for (let i = 0; i < this.nBranch; i++){
      const len = 9 + 30*RND(i,71);
      /* A branch is a limb reaching out of its origin, so pushing the origin
         clear of the corridor does not keep its far end out. The low ones are
         lifted above the handrail instead, which is what a cleared path looks
         like anyway. */
      const by = 3.5 + (canopyY - 6)*Math.pow(RND(i,74), 0.7);
      /* A branch reaches out of its origin, so its origin has to clear the
         shaft by its own length. */
      const bx0 = (RND(i,72)*2 - 1)*halfWidth*0.9;
      const need = clearRadius(by, bx0 < 0 ? -1 : 1) + (9 + 30*RND(i,71))*0.55;
      const bx = Math.abs(bx0) < need ? (bx0 < 0 ? -1 : 1)*need : bx0;
      this._br.push({
        x: bx,
        f: span*RND(i,73),
        y: by,
        len,
        r: 0.07 + 0.26*RND(i,75)*RND(i,78),
        yaw: RND(i,76)*6.283,
        droop: 0.10 + 0.55*RND(i,77)
      });
    }
    const bg = new THREE.CylinderGeometry(0.35, 1.0, 1, 7, 1, true);
    bg.translate(0, 0.5, 0);
    this.branches = new THREE.InstancedMesh(bg, this.trunkMat = reg(new THREE.ShaderMaterial({
      uniforms: U(), side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec3 vN;
        void main(){
          vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0);
          vW = w.xyz;
          /* The silver poles were here.
             A branch is a cylinder scaled (r, length, r) with length over a
             hundred times r, and its geometry is tapered, so its normals carry a
             Y component. Multiplying a normal by a matrix that stretches Y three
             hundred times more than X and Z does not rotate the normal, it
             collapses it onto the branch's own axis — every branch ended up with
             a single normal pointing along its length. A rim term then read the
             maximum value over the whole stick at once, uniformly, and a thin
             stick with a uniform full-strength rim is a chrome rod.
             Taking the radial component in LOCAL space first sidesteps it: x and
             z are scaled equally, so that direction survives the transform. */
          vN = normalize(mat3(instanceMatrix)*vec3(normal.x, 0.0, normal.z));
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW; varying vec3 vN;
        void main(){
          float d = dapple(vW.xz, uTime);
          vec3 N = normalize(vN);
          float lam = clamp(dot(N, normalize(uSun)), 0.0, 1.0);
          /* Dark and thin. A branch lit along its whole length with a rim on
             both edges is a ribbon, and a jungle full of ribbons is
             scaffolding. Almost all of one is in shadow. */
          /* Silhouettes. A thin stick with any specular on it reads as a white
             streak ruled across the frame, which is the same failure the trunks
             had and is worse on something moving. */
          vec3 col = vec3(0.007,0.006,0.005) + uAmb*0.12
                   + uSunCol*lam*pow(clamp(d,0.0,1.0),1.8)*0.03
                   + torchLight(vW, normalize(vN), uTorch, uTorchCol)*0.45;
          col = mix(col, uDrainCol*0.12, uDrain);
          /* And this shader was still adding the whole vanishing-point glow
             through its fog, which is the other half of why the branches were
             silver — see airGlowAt. */
          float dist = length(vW - uCam);
          vec3 dir = normalize(vW - uCam + vec3(0.0, 1e-5, 0.0));
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    })), this.nBranch);
    this.branches.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.branches.frustumCulled = false;
    this.group.add(this.branches);

    /* ---- leaves ---------------------------------------------------------- */
    /* Alpha-tested, not blended: nine thousand transparent cards cannot be
       sorted, and foliage does not need to be — it needs to occlude. */
    this.nLeaf = leaves;
    this._lf = [];
    /* Leaves come in clumps. Scattered uniformly they make a curtain of even
       density with no shape in it — the eye reads a texture, not a plant. Sixteen
       leaves to a cluster, clusters scattered instead. */
    const PER = 16, nClump = Math.ceil(leaves/PER);
    for (let i = 0; i < leaves; i++){
      const cl = Math.floor(i/PER);
      const high = RND(cl,11) < 0.66;
      const cx = (RND(cl,12)*2 - 1)*halfWidth;
      const cf = span*RND(cl,13);
      const cy = high ? canopyY*(0.42 + 0.66*RND(cl,14)) : 0.8 + 11.0*RND(cl,15);
      const spread = high ? 5.5 : 3.2;
      const base = high ? 2.4 : 1.4;
      const lx = cx + (RND(i,52)*2 - 1)*spread;
      const ly = cy + (RND(i,54)*2 - 1)*spread*0.7;
      const ls = base*(0.45 + 2.4*RND(i,56)*RND(i,57));
      const needL = clearRadius(ly, lx < 0 ? -1 : 1) + ls*0.9;
      const lxc = Math.abs(lx) < needL ? (lx < 0 ? -1 : 1)*needL : clearCorridor(lx, ly);
      this._lf.push({
        x: lxc,
        f: cf + (RND(i,53)*2 - 1)*spread,
        y: ly,
        s: ls,
        rot: RND(i,58)*6.283,
        tilt: (RND(i,59)*2 - 1)*1.1,
        k: RND(i,60)
      });
    }
    void nClump;
    this.leaves = new THREE.InstancedMesh(leafGeometry(), reg(new THREE.ShaderMaterial({
      uniforms: U(), side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vW; varying vec3 vN;
        void main(){
          vUv = uv;
          vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0);
          vW = w.xyz;
          vN = normalize(mat3(instanceMatrix)*vec3(0.0,0.0,1.0));
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec2 vUv; varying vec3 vW; varying vec3 vN;
        void main(){
          /* The outline is geometry now — see leafGeometry(). Nothing here
             cuts anything out, so nothing here can alias. */
          vec2 p = vUv*2.0 - 1.0;
          float rib = 1.0 - smoothstep(0.0, 0.075, abs(p.x));
          /* A leaf is thicker at its rib and thinner at its rim, so the rim is
             where it transmits most and reflects least — the opposite of what
             the shading was doing. Left bright it reads as a silver wire around
             every leaf, which is the same chrome-rod failure the branches had,
             multiplied by nine thousand. */
          float hw = 0.26*(1.0 - p.y*p.y) + 1e-4;
          float across = clamp(abs(vUv.x - 0.5)/hw, 0.0, 1.0);
          float edge = smoothstep(0.45, 1.0, across);
          float d = dapple(vW.xz, uTime);
          vec3 N = normalize(vN);
          float lam = clamp(abs(dot(N, normalize(uSun))), 0.0, 1.0);
          /* A leaf lit from behind is the brightest thing in a jungle. */
          float back = pow(clamp(-dot(N, normalize(uSun)), 0.0, 1.0), 1.4);
          /* Most leaves are dark. The ones that are not are the ones with the
             sun behind them, and that single fact is what a jungle looks like:
             a dark mass with a scatter of leaves glowing inside it. */
          /* Not all of it is green. A jungle read as one hue is a filter; the
             variation is small and it is what stops the frame looking tinted. */
          float hv = fract(vW.x*0.13 + vW.z*0.07);
          vec3 green = mix(vec3(0.014,0.046,0.018), vec3(0.038,0.118,0.034), hv);
          green = mix(green, vec3(0.070,0.070,0.020), smoothstep(0.86, 1.0, hv)*0.7);
          green = mix(green, vec3(0.020,0.055,0.075), smoothstep(0.0, 0.10, 1.0-hv)*0.5);
          /* In this light almost every leaf is a flat silhouette. The few that
             are not are the ones with something behind them. */
          vec3 col = green*(0.16 + 0.30*d)
                   + uSunCol*lam*d*0.10
                   + vec3(0.45,1.00,0.32)*pow(clamp(back,0.0,1.0),1.5)*(0.03 + 0.55*clamp(d,0.0,1.0))*0.9
                   + torchLight(vW, normalize(vN), uTorch, uTorchCol)*1.6;
          col *= (1.0 - rib*0.40)*(1.0 - 0.55*edge);
          col = mix(col, uDrainCol*(0.08 + 0.5*d), uDrain);
          vec3 dir = normalize(vW - uCam + vec3(0.0, 1e-5, 0.0));
          float dist = length(vW - uCam);
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    })), leaves);
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.leaves.frustumCulled = false;
    this.group.add(this.leaves);

    /* ---- fronds and ferns ------------------------------------------------- */
    /* Two populations of the same geometry: palms up in the canopy, ferns down
       beside the walkway. Flat, single-valued, no shading to speak of — in this
       light they are shapes against a glow and nothing else. */
    this.nFrond = 2600;
    this._fr = [];
    for (let i = 0; i < this.nFrond; i++){
      const low = RND(i,111) < 0.58;
      const fy = low ? 0.2 + 2.4*RND(i,115) : canopyY*(0.30 + 0.72*RND(i,115));
      const fx = low ? (RND(i,112) < 0.5 ? -1 : 1)*(4.5 + 16*RND(i,113))
                     : (RND(i,112)*2 - 1)*halfWidth*0.8;
      /* A frond is up to thirty units across, so clearing its centre out of the
         shaft leaves most of it still in there. It has to clear by its own
         radius — the same lesson the branches taught. */
      const fs = low ? 5.0 + 9.0*RND(i,116) : 9.0 + 20.0*RND(i,116);
      const needF = clearRadius(fy, fx < 0 ? -1 : 1) + fs*0.42;
      /* Pushed out by its deficit rather than clamped to the limit: clamping
         stacks every offender on the same two lines and builds a hedge down
         both sides of the path, which from the middle reads as a mirror. */
      const fxc = Math.abs(fx) < needF
        ? (fx < 0 ? -1 : 1)*(needF + (needF - Math.abs(fx))*0.8)
        : fx;
      this._fr.push({
        low,
        x: fxc,
        f: span*RND(i,114),
        y: fy,
        s: fs,
        rot: RND(i,117)*6.283,
        tilt: low ? -0.75 - 0.7*RND(i,118) : (RND(i,118)*2 - 1)*1.35,
        k: RND(i,119)
      });
    }
    this.fronds = new THREE.InstancedMesh(frondGeometry(), reg(new THREE.ShaderMaterial({
      uniforms: U(), side: THREE.DoubleSide,
      vertexShader: /* glsl */`
        varying vec3 vW; varying vec3 vN; varying vec2 vUv;
        void main(){
          vUv = uv;
          vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0);
          vW = w.xyz;
          vN = normalize(mat3(instanceMatrix)*vec3(0.0,0.0,1.0));
          gl_Position = projectionMatrix*viewMatrix*w;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${COMMON}
        uniform float uTime, uDrain, uFog;
        uniform vec3 uCam, uSun, uSunCol, uAmb, uDrainCol, uHaze, uSky, uGlow, uTorchCol;
        uniform vec4 uTorch[4];
        varying vec3 vW; varying vec3 vN; varying vec2 vUv;
        void main(){
          float d = dapple(vW.xz, uTime);
          vec3 N = normalize(vN);
          float back = pow(clamp(-dot(N, normalize(uSun)), 0.0, 1.0), 1.5);
          /* Same rim treatment as the leaves: uv.x is 0.5 on the rib and 0 or
             1 at a leaflet tip. */
          float edge = smoothstep(0.40, 1.0, abs(vUv.x - 0.5)*2.0);
          vec3 col = vec3(0.010,0.026,0.014)
                   + uAmb*0.6
                   + vec3(0.40,0.95,0.34)*back*d*0.22
                   + torchLight(vW, N, uTorch, uTorchCol)*2.0;
          col *= 1.0 - 0.50*edge;
          col = mix(col, uDrainCol*0.20, uDrain);
          float dist = length(vW - uCam);
          vec3 dir = normalize(vW - uCam + vec3(0.0,1e-5,0.0));
          float f = 1.0 - exp(-dist*uFog*0.22);
          col = mix(col, mix(airColour(dir, uHaze, uSky) + airGlowAt(dir, uGlow, dist), uDrainCol*0.45, uDrain), f);
          gl_FragColor = vec4(extinct(col, dist), 1.0);
        }`
    })), this.nFrond);
    this.fronds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fronds.frustumCulled = false;
    this.group.add(this.fronds);

    /* ---- shafts ---------------------------------------------------------- */
    /* God rays as geometry rather than as a post effect: the canopy is holes,
       and a hole in a canopy over wet air is a solid-looking column. */
    this.nShaft = shafts;
    this._sh = [];
    for (let i = 0; i < shafts; i++){
      /* Out in the trees, never over the path. A column forty metres tall and
         sixteen wide standing next to the camera is not a god ray, it is a pale
         slab across half the frame — and because it is additive with no depth
         write, everything behind it goes pale with it. That was the white glow
         on the leaves and the ground: not the leaves and not the ground. */
      this._sh.push({
        x: (RND(i,31) < 0.5 ? -1 : 1)*(15 + (halfWidth*0.75 - 15)*RND(i,35)),
        f: span*RND(i,32),
        w: 3.5 + 13.0*RND(i,33),
        k: RND(i,34)
      });
    }
    /* Brightness rides an instanced float, not instanceColor.
     *
     * Mute named this layer as the source of the black bars, and this is the one
     * material in the scene that depended on USE_INSTANCING_COLOR — a define the
     * renderer adds for you, on a code path that differs between drivers, and
     * the only thing here that behaves differently on this machine's software
     * rasteriser than on a real GPU. Whatever it was doing, it is not worth
     * finding out: a float attribute and a uniform colour do the same job with
     * nothing in the middle that can be defined or not defined.
     *
     * The output is also clamped. These are the brightest things in the frame
     * and they feed the bloom chain; a value large enough to overflow a
     * half-float on the way through three successive downsamples comes out the
     * other side as an infinity, and an infinity through the tonemapper is a
     * black pixel. */
    const shGeo = new THREE.PlaneGeometry(1, 1);
    const shAmt = new Float32Array(shafts);
    shGeo.setAttribute('aAmt', new THREE.InstancedBufferAttribute(shAmt, 1));
    this._shAmt = shAmt;
    this.shafts = new THREE.InstancedMesh(shGeo, reg(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(1.00, 0.97, 0.70) } },
      vertexShader: `
        attribute float aAmt;
        varying vec2 vUv; varying float vAmt; varying float vD;
        void main(){
          vUv = uv; vAmt = aAmt;
          vec4 mv = modelViewMatrix*instanceMatrix*vec4(position, 1.0);
          vD = length(mv.xyz);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `precision highp float;
        ${EXTINCT}
        uniform vec3 uCol;
        varying vec2 vUv; varying float vAmt; varying float vD;
        void main(){
          float w = 1.0 - abs(vUv.x*2.0 - 1.0); w = w*w*w;
          float v = clamp(1.0 - vUv.y, 0.0, 1.0);      // brightest at the top
          float g = v*v*(1.0 - pow(clamp(1.0 - v, 0.0, 1.0), 8.0));
          vec3 c = extinct(uCol*clamp(vAmt, 0.0, 4.0)*w*g, vD);
          gl_FragColor = vec4(clamp(c, vec3(0.0), vec3(8.0)), 1.0);
        }`
    })), shafts);
    this.shafts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shGeo.getAttribute('aAmt').setUsage(THREE.DynamicDrawUsage);
    this.shafts.frustumCulled = false;
    this.shafts.renderOrder = 4;
    this.group.add(this.shafts);

    /* ---- rain ------------------------------------------------------------ */
    /* Placed entirely in the vertex shader from a per-instance seed: nine
       thousand matrices a frame on the CPU is a real cost and rain does not need
       one — it falls in a straight line and its position is arithmetic. */
    this.nRain = 5200;
    const rseed = new Float32Array(this.nRain*3);
    for (let i = 0; i < this.nRain; i++){
      rseed[i*3]   = (RND(i,91)*2 - 1);
      rseed[i*3+1] = RND(i,92);
      rseed[i*3+2] = RND(i,93);
    }
    const rg = new THREE.PlaneGeometry(1,1);
    rg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(rseed, 3));
    this.rain = new THREE.InstancedMesh(rg, reg(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime:{value:0}, uCamF:{value:0}, uCam:{value:new THREE.Vector3()},
                  uCol:{value:new THREE.Color(0.34,0.44,0.39)}, uAmt:{value:1},
                  uW:{value:0.030}, uL:{value:1.7}, uBox:{value:34.0}, uPx:{value:400} },
      vertexShader: /* glsl */`
        attribute vec3 aSeed;
        uniform float uTime, uCamF, uW, uL, uBox, uPx;
        uniform vec3 uCam;
        varying vec2 vUv; varying float vA; varying float vD;
        void main(){
          vUv = uv;
          float H = 62.0;
          /* fixed in the world across the path, recycled around the camera */
          float x = uCam.x + aSeed.x*uBox;
          float f = uCamF + mod(aSeed.z*140.0 - uCamF, 140.0) - 18.0;
          float y = mod(aSeed.y*H - uTime*23.0, H);
          vec3 c = vec3(x, y, -f);
          /* a quad standing up, facing the camera about the vertical */
          vec3 toCam = normalize(vec3(uCam.x - c.x, 0.0, uCam.z - c.z) + vec3(1e-4,0.0,0.0));
          vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
          float d = length(c - uCam);
          /* Three centimetres of water is under a pixel wide past about twenty
             metres, and a sub-pixel quad does not get thinner — the rasteriser
             either drops it or draws it at full strength across a whole pixel.
             That is where the bright white scratches came from. Widen the drop
             to hold a pixel and take the same factor back out of its brightness,
             so a distant drop gets fainter instead of narrower. */
          float pw = uW*uPx/max(d, 0.5);
          float widen = max(1.0, 1.0/max(pw, 0.02));
          vec3 p = c + right*(position.x*uW*widen) + vec3(0.0, position.y*uL, 0.0);
          /* Rain has to stay a texture in the air, not a set of bright rules
             drawn over the picture. It fades in further out, fades out sooner,
             and never reaches full strength — a drop that reads individually is
             a scratch on the lens. */
          vA = smoothstep(3.5, 13.0, d)*(1.0 - smoothstep(20.0, 42.0, d))*0.55
             * min(1.0, pw);
          vD = d;
          gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
        }`,
      fragmentShader: `precision highp float;
        ${EXTINCT}
        uniform vec3 uCol; uniform float uAmt;
        varying vec2 vUv; varying float vA; varying float vD;
        void main(){
          float w = 1.0 - abs(vUv.x*2.0 - 1.0); w = w*w;
          float v = 1.0 - abs(vUv.y*2.0 - 1.0);
          gl_FragColor = vec4(extinct(uCol, vD), 1.0)*w*v*vA*uAmt;
        }`
    })), this.nRain);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 7;
    this.group.add(this.rain);

    /* ---- mist banks ------------------------------------------------------- */
    this.nBank = 1600;
    const bp = new Float32Array(this.nBank*3), bk = new Float32Array(this.nBank);
    for (let i = 0; i < this.nBank; i++){
      bp[i*3]   = (RND(i,131)*2 - 1)*halfWidth*0.8;
      bp[i*3+1] = 1.0 + 26.0*Math.pow(RND(i,132), 1.8);
      bp[i*3+2] = span*RND(i,133);
      bk[i] = RND(i,134);
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bgeo.setAttribute('aK', new THREE.BufferAttribute(bk, 1));
    this.banks = new THREE.Points(bgeo, reg(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCamF:{value:0}, uSpan:{value:span}, uPx:{value:400}, uTime:{value:0},
                  uCol:{value:new THREE.Color(0.22,0.31,0.27)}, uAmt:{value:1} },
      vertexShader: `
        attribute float aK;
        uniform float uCamF, uSpan, uPx, uTime;
        varying float vA; varying float vD;
        void main(){
          vec3 p = position;
          float f = mod(p.z - uCamF, uSpan);
          p.z = -(uCamF - 16.0 + f);
          p.x += sin(uTime*0.12 + aK*23.0)*5.0;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          float d = max(-mv.z, 1.0);
          vD = length(mv.xyz);
          /* A puff whose sprite is a third of the frame across is not mist, it
             is a grey wash laid over whatever is behind it — and because a
             point sprite carries one depth for every fragment, the wash has a
             hard circular silhouette against the near leaves. Keep them small
             enough to read as a bank rather than a filter, and hold them off
             the camera so the foreground is never the thing being washed. */
          vA = smoothstep(11.0, 55.0, d)*(1.0/(1.0 + d*0.009));
          gl_PointSize = clamp((5.0 + aK*17.0)*uPx/d, 1.0, 340.0);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `precision highp float;
        ${EXTINCT}
        uniform vec3 uCol; uniform float uAmt; varying float vA; varying float vD;
        void main(){
          float r = length(gl_PointCoord - 0.5)*2.0;
          float m = 1.0 - smoothstep(0.0, 1.0, r); m = m*m*m;
          gl_FragColor = vec4(extinct(uCol, vD), 1.0)*m*vA*uAmt*0.15;
        }`
    })));
    this.banks.frustumCulled = false;
    this.banks.renderOrder = 3;
    this.group.add(this.banks);

    /* ---- motes ----------------------------------------------------------- */
    const mp = new Float32Array(motes*3), mk = new Float32Array(motes);
    for (let i = 0; i < motes; i++){
      mp[i*3]   = (RND(i,41)*2 - 1)*halfWidth*0.6;
      mp[i*3+1] = 0.5 + canopyY*0.95*RND(i,42);
      mp[i*3+2] = span*RND(i,43);
      mk[i] = RND(i,44);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('aK', new THREE.BufferAttribute(mk, 1));
    this.motes = new THREE.Points(mg, reg(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uCamF:{value:0}, uSpan:{value:span}, uPx:{value:400}, uTime:{value:0},
                  uCol:{value:new THREE.Color(1,0.96,0.72)}, uAmt:{value:1} },
      vertexShader: `
        attribute float aK;
        uniform float uCamF, uSpan, uPx, uTime;
        varying float vA; varying float vD;
        void main(){
          vec3 p = position;
          float f = mod(p.z - uCamF, uSpan);
          p.z = -(uCamF - 12.0 + f);
          p.x += sin(uTime*0.5 + aK*41.0)*1.1;
          p.y += sin(uTime*0.33 + aK*17.0)*0.8;
          vec4 mv = modelViewMatrix*vec4(p,1.0);
          float d = max(-mv.z, 1.0);
          vD = length(mv.xyz);
          vA = smoothstep(3.0, 30.0, d)*(1.0/(1.0 + d*0.016));
          gl_PointSize = clamp((0.10 + aK*0.30)*uPx/d, 1.0, 60.0);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `precision highp float;
        ${EXTINCT}
        uniform vec3 uCol; uniform float uAmt; varying float vA; varying float vD;
        void main(){
          float r = length(gl_PointCoord - 0.5)*2.0;
          float m = 1.0 - smoothstep(0.0, 1.0, r); m = m*m;
          gl_FragColor = vec4(extinct(uCol, vD), 1.0)*m*vA*uAmt;
        }`
    })));
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 5;
    this.group.add(this.motes);
  }

  /** @param camF  how far the camera has travelled along +forward (= -z) */
  update(t, { camF, camPos, drain = 0, px = 400, shaftAmt = 1, sun, rain = 1, fog = 1 }){
    this.rainAmt = rain;
    const S = this.span;
    for (const m of this.mats){
      const u = m.uniforms;
      if (u.uTime) u.uTime.value = t;
      if (u.uCam) u.uCam.value.copy(camPos);
      if (u.uDrain) u.uDrain.value = drain;
      if (u.uSun && sun) u.uSun.value.copy(sun);
      /* The air is not the same everywhere in it. Fog here is a distance term
         with one density for the whole world, which is right at head height in
         a wet forest and wrong above the canopy: mist sits LOW, and a camera
         twenty-five metres up looking down through a single uniform density
         gets a flat green wall where the walkway ought to be. The caller says
         how thick the air is where it currently is; see s05-jungle.js. */
      if (u.uFog) u.uFog.value = FOG_BASE*fog;
    }
    this.ground.position.set(0, 0, -camF);
    this.canopy.position.set(0, this.canopyY, -camF);
    this.dome.position.copy(camPos);
    this.motes.material.uniforms.uCamF.value = camF;
    this.motes.material.uniforms.uPx.value = px;
    this.motes.material.uniforms.uTime.value = t;
    this.banks.material.uniforms.uCamF.value = camF;
    this.banks.material.uniforms.uPx.value = px;
    this.banks.material.uniforms.uTime.value = t;

    /* ---- the four nearest torches, for every shader that reads light ------ */
    const lit = [];
    for (const e of this._to){
      let ff = (e.f - camF) % S; if (ff < 0) ff += S;
      const fw = camF - 14 + ff;
      /* A flame is not a steady lamp: two octaves of flicker, both pure
         functions of t, so the render is still reproducible frame for frame. */
      const fl = 0.72 + 0.20*Math.sin(t*7.3 + e.k*31.0) + 0.14*Math.sin(t*17.9 + e.k*11.0);
      lit.push({ x: e.side*1.55, y: e.y, z: -fw, i: fl, d: fw - camF });
    }
    lit.sort((a, b) => Math.abs(a.d - 14) - Math.abs(b.d - 14));
    for (const m of this.mats){
      const u = m.uniforms;
      if (!u.uTorch) continue;
      for (let i = 0; i < 4; i++){
        const L = lit[i];
        u.uTorch.value[i].set(L ? L.x : 0, L ? L.y : -9999, L ? L.z : 0, L ? L.i : 0);
      }
    }
    {
      for (let i = 0; i < this.nTorch; i++){
        const e = this._to[i];
        let ff = (e.f - camF) % S; if (ff < 0) ff += S;
        const fw = camF - 14 + ff;
        const fl = 0.72 + 0.20*Math.sin(t*7.3 + e.k*31.0) + 0.14*Math.sin(t*17.9 + e.k*11.0);
        this._p.set(e.side*1.55, e.y + 0.30, -fw);
        this._q.setFromAxisAngle(this._yax, Math.atan2(camPos.x - e.side*1.55, camPos.z + fw));
        const sz = 0.75 + 0.14*fl;
        this._s.set(sz, sz*1.6, 1);
        this.flames.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));

        /* The stake under it: ground to the flame's foot, with a lean. Driven
           into the ground rather than resting on it — a post standing exactly
           on a surface reads as a prop placed there, the same lesson the
           islands' boulders needed. */
        const lean = (RND(i, 111) - 0.5)*0.13;
        const top = e.y + 0.10, bot = -0.22;
        this._p.set(e.side*1.55 + lean*(top - bot)*0.5, (top + bot)*0.5, -fw);
        this._q.setFromAxisAngle(this._zax, lean);
        this._s.set(0.075 + 0.02*RND(i, 112), top - bot, 0.075 + 0.02*RND(i, 113));
        this.stakes.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
        const vis = Math.min(1, Math.max(0, (fw - camF + 3)/8))
                  * (1 - Math.min(1, Math.max(0, (fw - camF - 130)/90)));
        this._flAmt[i] = Math.min(1, Math.max(0, fl*vis*(1 - drain*0.8)));
      }
      this.flames.instanceMatrix.needsUpdate = true;
      this.stakes.instanceMatrix.needsUpdate = true;
      this.flames.geometry.getAttribute('aAmt').needsUpdate = true;
    }

    /* ---- the walkway ------------------------------------------------------ */
    /* Planks are laid on a fixed world pitch, so they stream past at the speed
       we are actually travelling — the one thing in the frame that measures it. */
    const PITCH = 0.62, HALF = 0.95, DECK = 1.05;
    const k0 = Math.floor((camF - 10)/PITCH);
    for (let i = 0; i < this.nPlank; i++){
      const kk = k0 + i;
      const z = -(kk*PITCH);
      const sag = Math.sin(kk*PITCH*0.055)*0.22;
      this._p.set(0, DECK + sag, z);
      this._q.identity();
      this._s.set(HALF*2, 0.085, PITCH*0.70);
      this.planks.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.planks.instanceMatrix.needsUpdate = true;

    let ri = 0;
    const setRail = (x, y, z, sx, sy, sz) => {
      if (ri >= this.nRail) return;
      this._p.set(x, y, z); this._q.identity(); this._s.set(sx, sy, sz);
      this.rails.setMatrixAt(ri++, this._m.compose(this._p, this._q, this._s));
    };
    const SEG = 3.4, n0 = Math.floor((camF - 10)/SEG);
    for (let i = 0; i < 50; i++){
      const kk = n0 + i, z = -(kk*SEG);
      const sag = Math.sin(kk*SEG*0.055)*0.22;
      for (const sgn of [-1, 1]){
        setRail(sgn*HALF, DECK + 1.05 + sag, z, 0.055, 0.055, SEG);          // the rope
        setRail(sgn*HALF, DECK + 0.53 + sag, z + SEG*0.5, 0.038, 1.05, 0.038); // a hanger
      }
    }
    while (ri < this.nRail) setRail(0, -9999, 0, 0.001, 0.001, 0.001);
    this.rails.instanceMatrix.needsUpdate = true;

    /* ---- fronds ----------------------------------------------------------- */
    /* Wind is a wave travelling through the world, not a per-leaf wobble: a
       canopy moves in gusts, and everything inside a gust moves together. */
    for (let i = 0; i < this.nFrond; i++){
      const e = this._fr[i];
      let ff = (e.f - camF) % S; if (ff < 0) ff += S;
      const fw = camF - 14 + ff;
      const g = (0.055 + 0.10*Math.sin(t*0.55 + fw*0.028 + e.x*0.012)
                       + 0.05*Math.sin(t*1.30 + fw*0.070))*(e.low ? 0.5 : 1.0);
      this._p.set(e.x, e.y, -fw);
      this._eu = this._eu || new THREE.Euler();
      this._eu.set(e.tilt + g*Math.sin(e.k*19.0), e.rot + g*0.5, g*1.3, 'YXZ');
      this._q.setFromEuler(this._eu);
      /* Nothing this big may sit on the lens. A frond twenty units across that
         recycles two metres in front of the camera fills the frame with a green
         slab, and there is no grade or fog that saves it — it has to not be
         there. Scaled out inside a bubble around the walkway. */
      const dx = e.x - camPos.x, dz = -fw - camPos.z;
      const near = Math.sqrt(dx*dx + dz*dz);
      const cull = Math.min(1, Math.max(0, (near - e.s*0.22 - 1.6)/3.0));
      const sc = e.s*cull;
      this._s.set(sc, sc, sc);
      this.fronds.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.fronds.instanceMatrix.needsUpdate = true;

    const place = (obj, i, e, y, sx, sy, sz, rot) => {
      let f = (e.f - camF) % S; if (f < 0) f += S;
      const fw = camF - 14 + f;
      this._p.set(e.x, y, -fw);
      this._q.setFromAxisAngle(this._yax, rot);
      this._s.set(sx, sy, sz);
      obj.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
      return fw;
    };

    for (let i = 0; i < this.nBranch; i++){
      const e = this._br[i];
      let f = (e.f - camF) % S; if (f < 0) f += S;
      const fw = camF - 14 + f;
      /* Laid down from vertical, so a cylinder becomes a limb reaching across
         the path and drooping at its end. */
      this._p.set(e.x, e.y, -fw);
      this._q.setFromEuler(new THREE.Euler(Math.PI*0.5 - e.droop, e.yaw, 0, 'YXZ'));
      this._s.set(e.r, e.len, e.r);
      this.branches.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.branches.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.nTrunk; i++){
      const e = this._tk[i];
      place(this.trunks, i, e, 0, e.r, e.h, e.r, e.rot);
    }
    this.trunks.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.nLeaf; i++){
      const e = this._lf[i];
      let f = (e.f - camF) % S; if (f < 0) f += S;
      const fw = camF - 14 + f;
      /* Same gust field as the fronds, plus a small individual flutter — a leaf
         in wind does both, and only doing the second is what made the first
         version look like a photograph with a shiver on it. */
      const g = 0.055 + 0.10*Math.sin(t*0.55 + fw*0.028 + e.x*0.012)
                      + 0.05*Math.sin(t*1.30 + fw*0.070);
      const flut = Math.sin(t*2.7 + e.k*61.0)*0.12 + Math.sin(t*4.3 + e.k*23.0)*0.06;
      this._p.set(e.x + g*2.4 + Math.sin(t*0.9 + e.k*13.0)*0.22, e.y, -fw);
      this._eu2 = this._eu2 || new THREE.Euler();
      this._eu2.set(e.tilt + g*1.6 + flut, e.rot + g*0.8, g*2.1 + flut*0.7, 'YXZ');
      this._q.setFromEuler(this._eu2);
      const ldx = e.x - camPos.x, ldz = -fw - camPos.z;
      const lnear = Math.sqrt(ldx*ldx + ldz*ldz);
      const lcull = Math.min(1, Math.max(0, (lnear - e.s*0.9 - 1.0)/2.2));
      this._s.set(e.s*lcull, e.s*1.9*lcull, 1);
      this.leaves.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
    }
    this.leaves.instanceMatrix.needsUpdate = true;

    const ru = this.rain.material.uniforms;
    ru.uTime.value = t; ru.uCamF.value = camF; ru.uCam.value.copy(camPos);
    ru.uPx.value = px;
    ru.uAmt.value = this.rainAmt === undefined ? 1 : this.rainAmt;

    for (let i = 0; i < this.nShaft; i++){
      const e = this._sh[i];
      let f = (e.f - camF) % S; if (f < 0) f += S;
      const fw = camF - 14 + f;
      const H = this.canopyY*1.15;
      this._p.set(e.x, H*0.5, -fw);
      this._q.setFromAxisAngle(this._yax, e.k*3.14159);
      this._s.set(e.w, H, 1);
      this.shafts.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
      /* Weighted by real distance, not by how far ahead it is. A shaft twenty
         metres off to the side is beside the camera however far down the path
         it sits, and beside the camera is exactly where it must not be seen:
         light in the air only reads as a column when there is enough air in
         front of it. Same reasoning as airGlowAt() — the bright thing lives at
         the end of the corridor, and the near things are silhouettes against
         it. */
      const dx = e.x - camPos.x, dz = -fw - camPos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      this._shAmt[i] = shaftAmt*(0.16 + 0.40*e.k)
                     * Math.min(1, Math.max(0, (fw - camF - 4)/26))
                     * SS(dist, 34, 130)
                     * (1 - SS(dist, 300, 470));
    }
    this.shafts.instanceMatrix.needsUpdate = true;
    this.shafts.geometry.getAttribute('aAmt').needsUpdate = true;
  }

  /* Named handles for the preview's isolation key. Finding a bad population by
     switching them off one at a time has settled two of these already, and it
     has to be done on the machine that shows the fault. */
  debugLayers(){
    return { dome:this.dome, canopy:this.canopy, ground:this.ground, trunks:this.trunks,
             branches:this.branches, leaves:this.leaves, fronds:this.fronds,
             planks:this.planks, rails:this.rails, flames:this.flames,
             banks:this.banks, motes:this.motes, shafts:this.shafts,
             rain:this.rain };
  }

  dispose(){
    for (const o of [this.dome, this.canopy, this.ground, this.trunks, this.branches, this.leaves,
                     this.fronds, this.planks, this.rails, this.flames, this.banks,
                     this.rain, this.shafts, this.motes]){
      o.geometry.dispose(); o.material.dispose();
    }
  }
}
