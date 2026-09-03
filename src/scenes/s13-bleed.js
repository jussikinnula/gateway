import * as THREE from 'three';
import { makeWorlds } from './worlds.js';

/* S13 — Bleed.  Bars 120–127.
 *
 * 'The drums return and so does the world — but two of them at once, occupying
 * the same space and neither winning.' Then, at bar 124, all of them.
 *
 * THE LATTICE — three chambers, fog between them, and no world touching
 * another. Two earlier versions of this scene are worth recording, because
 * both of them failed for the same underlying reason and the third works by
 * refusing to make that mistake at all.
 *
 *   ONE SCENE, ALL THE GROUPS, INTERLEAVED BY DEPTH. On paper this is a
 *   depth-aware dissolve for free: at every pixel you see whichever world is
 *   nearer. In the frame it is two landscapes cutting through each other along
 *   the seams where their geometry happens to meet — a volcano sliced by a
 *   fern, a jungle floor sheared off by a lava plain. The seam is not a tuning
 *   error; it is what interleaving IS.
 *
 *   ONE CAMERA, THE WORLDS MOVED AND SCALED TO MEET IT. Better in principle —
 *   the worlds are laid out in separate chambers and cannot intersect — but it
 *   asks every world to survive being rotated and scaled by twenty, and they
 *   do not. A world is not just geometry: it is geometry plus a camera plus a
 *   fog density in world units plus bounding spheres that the renderer culls
 *   against. Scale the group and the fog is thirty lengths deep and the world
 *   is a white wash; disable the culling that goes wrong and a sky dome that
 *   was meant to be behind you fills the frame. The jungle came back as a
 *   boardwalk with no jungle around it.
 *
 * So: NOTHING IS TRANSFORMED. Each chamber is that world rendered by its own
 * scene through its own camera, moving along its own path, graded by its own
 * compositor settings — which is to say the jungle looks exactly like S5 and
 * the volcanic plain exactly like S7, because it IS them. Only one world is
 * ever drawn, so no world can intersect another; that is not arranged, it is
 * structural.
 *
 * What joins them is fog. Each chamber opens out of it and closes back into
 * it, and the change of world happens at the moment the fog is opaque, so the
 * cut is not a cut — it is a wall of cloud you fly through and come out of
 * somewhere else. The cards are placed in the CAMERA'S own frame at distances
 * given per world, which is the one number a world has to declare to take part
 * (see CHAMBERS.near): view-space distances need no scale reconciliation, and
 * reconciling scale is exactly what broke the last version.
 *
 * At bar 124 the chambers come faster — a second lap through all three in the
 * time the first took to do one — which is where 'and then four' ended up: not
 * four at once in one frame, but the walls between the places thinning until
 * you are through them all.
 */

/*   near — how far in front of the camera this world's fog sits, in that
 *          world's own units. A jungle's fog is a few metres away and a
 *          volcanic plain's is a few hundred; it is the only thing each world
 *          has to say about itself here.
 *   run  — how many seconds of the world's own clock to run per chamber. Its
 *          own camera path drives the move, so this is the shot length, not a
 *          speed. */
const CHAMBERS = [
  { id: 'volcanic', near: 260,  run: 2.6 },
  { id: 'jungle',   near: 2.6,  run: 3.0 },
  { id: 'islands',  near: 900,  run: 3.4 }
];

const FOG_CARDS = 44;

export class BleedScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S13') || { t: tl.timeOfBar(120), tEnd: tl.timeOfBar(128) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tFour = tl.timeOfBar(124);

    this.worlds = makeWorlds(tl, CHAMBERS.map(c => c.id));
    for (let i = 0; i < this.worlds.length; i++) this.worlds[i].near = CHAMBERS[i].near;

    /* The running order. Three chambers to bar 124 and three more, quicker,
       after it — the same three places, gone through twice, the second time
       with less between them. */
    const f = Math.min(0.9, Math.max(0.1, (this.tFour - this.T0)/(this.T1 - this.T0)));
    this.segs = [];
    for (let i = 0; i < 3; i++) this.segs.push({ w: i, u0: f*i/3, u1: f*(i + 1)/3, late: 0 });
    for (let i = 0; i < 3; i++) this.segs.push({ w: i, u0: f + (1 - f)*i/3, u1: f + (1 - f)*(i + 1)/3, late: 1 });

    /* main.js hands whichever camera is current to the compositor, so the
       scene starts life pointing at the first chamber's. */
    this.scene = this.worlds[0].scene.scene;
    this.camera = this.worlds[0].scene.camera;

    this.fog = this._buildFog();
    this._fogIn = null;                       // which world's scene holds it

    /* Measured kick, normalised across this scene's own eight bars — the shot
       list asks for the weight to follow it by name. */
    let lo = Infinity, hi = -Infinity;
    for (const b of (tl.d.bars || [])){
      if (b.bar >= 120 && b.bar < 128){ lo = Math.min(lo, b.kick); hi = Math.max(hi, b.kick); }
    }
    this._lo = Number.isFinite(lo) ? lo : 0;
    this._hi = Number.isFinite(hi) && hi > lo ? hi : this._lo + 1;
  }

  /* The fog, as a stack of cards in front of the camera.
   *
   * A stack rather than a fog term in a shader, and for a reason: a shader fog
   * fades a world out evenly wherever it is, and what is wanted here is the
   * opposite — clear air inside a chamber and a wall of cloud between
   * chambers, so a world ENDS rather than dims. Cards also come apart as the
   * camera passes through them, which is what makes a wall read as a distance
   * travelled rather than as a dissolve.
   *
   * Built once, in a canonical frame one unit deep, and scaled to whichever
   * world it is currently in. */
  _buildFog(){
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uDens: { value: 0 },
        uIris: { value: 3.0 },
        uAsp:  { value: 16/9 },
        uCol:  { value: new THREE.Color(0.55, 0.57, 0.62) }
      },
      vertexShader: /* glsl */`
        attribute float aSeed;
        attribute float aDepth;                 // 0 nearest .. 1 furthest
        varying vec2 vUv; varying float vSeed; varying float vDepth;
        varying vec4 vClip;
        void main(){
          vUv = uv; vSeed = aSeed; vDepth = aDepth;
          vClip = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position, 1.0);
          gl_Position = vClip;
        }`,
      fragmentShader: /* glsl */`precision highp float;
        uniform float uTime, uDens, uIris, uAsp; uniform vec3 uCol;
        varying vec2 vUv; varying float vSeed; varying float vDepth;
        varying vec4 vClip;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5453); }
        float n(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);
          return mix(mix(h(i), h(i + vec2(1,0)), f.x),
                     mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y);
        }
        float fb(vec2 p){ return n(p)*0.55 + n(p*2.1 + 5.0)*0.28 + n(p*4.3 + 11.0)*0.17; }
        void main(){
          /* No edge anywhere: a card with a boundary is a card. */
          float r = length(vUv - 0.5)*2.0;
          float a = 1.0 - smoothstep(0.30, 1.0, r);
          /* The far cards arrive first and the near ones last, so the wall
             closes in on the camera rather than fading up in place. */
          a *= smoothstep(vDepth*0.55 + 0.18, vDepth*0.55 + 0.62, uDens);
          a *= 0.30 + 0.90*fb(vUv*2.6 + vec2(vSeed*23.0, uTime*0.05 + vSeed*7.0));
          a *= 0.16;
          /* THE IRIS. The cards are in the camera's own frame, so their
             position on SCREEN is available here — and the transition is
             gated by it rather than by anything in the world. The fog is
             pushed out past a circle whose radius closes, so the cloud comes
             in from the corners and shuts like a lid; the edge is soft and
             ragged because the cards' own noise is still multiplying it, which
             is what keeps it a fog closing rather than a wipe. */
          vec2 ndc = vClip.xy/max(1e-4, vClip.w);
          float d = length(vec2(ndc.x*uAsp, ndc.y));
          a *= smoothstep(uIris - 0.30, uIris + 0.55, d);
          if (a < 0.003) discard;
          gl_FragColor = vec4(uCol, a);
        }`
    });
    const m = new THREE.InstancedMesh(geo, mat, FOG_CARDS);
    const seeds = new Float32Array(FOG_CARDS), depth = new Float32Array(FOG_CARDS);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
    const v = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < FOG_CARDS; i++){
      const u = (i + 0.5)/FOG_CARDS;
      /* Spread through the depth in front of the camera, in the canonical
         frame: z from -0.45 to -3.2, scaled per world at draw time. */
      const z = -(0.45 + 2.75*u*u);
      const jx = (((i*2654435761)>>>0)%1000)/1000 - 0.5;
      const jy = (((i*40503)>>>0)%1000)/1000 - 0.5;
      /* Wider than the frustum at that depth, and offset, so no card's own
         extent can show. */
      const sz = -z*2.6;
      v.set(jx*sz*0.35, jy*sz*0.22, z);
      s.set(sz, sz*0.68, 1);
      m.setMatrixAt(i, mm.compose(v, q, s));
      seeds[i] = ((i*7919)%1000)/1000;
      depth[i] = u;
    }
    m.instanceMatrix.needsUpdate = true;
    m.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    m.geometry.setAttribute('aDepth', new THREE.InstancedBufferAttribute(depth, 1));
    m.frustumCulled = false;
    m.renderOrder = 9999;
    return m;
  }

  update(t, post){
    const tl = this.tl;
    const p = Math.min(1, Math.max(0, (t - this.T0)/(this.T1 - this.T0)));
    const four = Math.min(1, Math.max(0, (t - this.tFour)/(this.T1 - this.tFour)));
    const raw = tl.energy(t, 'kick');
    const e = Math.min(1, Math.max(0, (raw - this._lo)/(this._hi - this._lo)));

    /* Which chamber, and how far through it. */
    let seg = this.segs[this.segs.length - 1];
    for (const s of this.segs) if (p < s.u1){ seg = s; break; }
    const x = Math.min(1, Math.max(0, (p - seg.u0)/Math.max(1e-6, seg.u1 - seg.u0)));
    const w = this.worlds[seg.w];

    /* The world runs on its OWN clock and its OWN camera path — a real shot
       inside that place, not a still of it. */
    const run = CHAMBERS[seg.w].run;
    /* The second lap picks up where the first left off rather than replaying
       it. Three chambers seen twice is a structure; the same three shots twice
       is a loop, and the eye reads a loop as a mistake. */
    w.scene.update(w.at + seg.late*run + x*run, post);
    const cam = w.scene.camera;
    /* The aspect fix is not optional: main.js only sets a camera's aspect when
       the SCENE changes, and from its point of view this scene never does — so
       a swapped-in camera would keep whatever its own constructor gave it and
       every chamber would be squeezed at any output shape but 16/9. */
    const aspect = this.camera.aspect || 16/9;
    if (cam.aspect !== aspect){ cam.aspect = aspect; cam.updateProjectionMatrix(); }
    const out = { scene: w.scene.scene, camera: cam, refractScene: w.scene.refractScene };
    this.scene = out.scene;
    this.camera = out.camera;
    this.refractScene = out.refractScene;

    /* The fog lives in whichever world is on screen, at that camera's pose and
       at that world's scale. */
    if (this._fogIn !== out.scene){
      if (this._fogIn) this._fogIn.remove(this.fog);
      out.scene.add(this.fog);
      this._fogIn = out.scene;
    }
    this.fog.position.copy(cam.position);
    this.fog.quaternion.copy(cam.quaternion);
    this.fog.scale.setScalar(w.near);
    this.fog.updateMatrixWorld(true);

    /* Opaque at the chamber walls and gone in the middle of the room. The
       world is swapped at x = 1, which is where the wall is thickest, so the
       change of place happens inside the cloud and there is no cut to see.
       The late chambers keep more of it: by then the walls are what the scene
       is about. */
    /* Narrow walls and a wide room. The first cut at this had the fog closing
       over the last third of every chamber and opening over the first third,
       which left a third of the shot to see the place in — most frames were
       cloud. A wall you fly through takes a moment; a room you look at takes
       longer than that. */
    const wall = Math.max(1 - smoothstep01(x, 0.0, 0.13), smoothstep01(x, 0.87, 1.0));
    const fu = this.fog.material.uniforms;
    fu.uTime.value = t;
    fu.uDens.value = Math.min(1, wall*(1.0 + 0.18*seg.late) + 0.04 + 0.07*e);

    /* THE BLINK.
     *
     * The fog no longer arrives everywhere at once: it closes from the edge of
     * the frame inward, as an iris, and opens the same way on the other side.
     * The world is swapped while the lid is shut, so the change of place
     * happens behind a closed eye — which is also why the two halves are not
     * symmetrical. A blink shuts faster than it opens, and it stays shut for a
     * beat; those three numbers are the whole shape of it, and they are the
     * same three the figures in S9 blink on. */
    const shut = smoothstep01(x, 0.88, 0.965);      // closing, quick
    const open = smoothstep01(x, 0.02, 0.155);      // opening, slower
    const lid  = Math.min(open, 1 - shut);          // 0 shut, 1 wide
    const eye  = Math.pow(lid, 0.55);
    /* The corner of a 16:9 frame is at 2.04 in these units, so a radius past
       that is an iris wider than the picture — no fog at all. */
    fu.uIris.value = 2.25*eye;
    fu.uAsp.value = this.camera.aspect || 16/9;

    /* --- grade ---------------------------------------------------------------
     * The world has already written the compositor with its own settings, and
     * that is the point of this version — the jungle's bloom is what makes a
     * dark green room readable and the volcanic plain's exposure is what keeps
     * lava from blowing out. So this ADDS to what the world asked for rather
     * than replacing it. */
    const c = post.qComp.u, d = post.qDof.u;
    const ex = c.uExposure.value;
    c.uExposure.value = ex*(1.00 + 0.10*e);
    c.uBloom.value    = c.uBloom.value + 0.14*e + 0.12*four;
    /* The split is the tell. uCA is a lens and uSplit is a signal, and this
       scene is a signal problem: several pictures arriving on one carrier. */
    c.uCA.value       = Math.max(c.uCA.value, 0.0020 + 0.0030*four);
    c.uSplit.value    = 0.0011*four*(0.4 + 0.6*e);
    c.uGrain.value    = c.uGrain.value + 0.016*four;
    /* And the lens. These chambers are looked at through a very short one all
       the way through the scene — it is what makes six unrelated places read
       as six views out of the same eye rather than as six shots — and it bends
       harder as the lid comes down, which is what an eye actually does to a
       picture as it closes. */
    c.uFish.value     = 0.34 + 0.10*e + 0.34*(1 - eye);
    d.uMaxRadius.value = (d.uMaxRadius.value || 1.4) + 1.0*four;

    /* And the fog is written in the world's own exposure, so it is the same
       cloud in all three chambers rather than three different greys. */
    fu.uCol.value.setRGB(0.40/ex, 0.42/ex, 0.48/ex);
  }

  dispose(){
    for (const w of this.worlds) if (w.scene.dispose) w.scene.dispose();
  }
}

function smoothstep01(x, a, b){
  const k = Math.min(1, Math.max(0, (x - a)/(b - a)));
  return k*k*(3 - 2*k);
}
