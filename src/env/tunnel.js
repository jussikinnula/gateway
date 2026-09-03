import * as THREE from 'three';
import { NOISE, EXTINCT } from '../core/glsl.js';

/* The light tunnel.
 *
 * Five populations, and the split between them is the design:
 *
 *   ARCS     land on the beat. Arc k sits at the world position the camera will
 *            occupy at beat k, so one passes on every beat at every speed —
 *            without modulating anything with the beat, which reads as judder.
 *            They are drawn as lightning rather than as tubes: jagged in the
 *            vertex shader, broken into bright segments in the fragment shader,
 *            white at the core and coloured at the fringe.
 *
 *   HALOS    are what each arc throws into the air around it. One fat, soft
 *            torus per arc, very faint. This is the light in the fog.
 *
 *   MIST     hangs between them and catches that light.
 *
 *   STREAKS  land nowhere: fixed in the world, so the rate they pass at is the
 *            speed divided by their spacing, and it rises with the speed. The
 *            arcs cannot do this — one every half beat is 4.8 a second whether
 *            the camera is doing 30 units a second or 600, so acceleration is
 *            invisible in them by construction.
 *
 *   WALL     is what all of it travels past. Its texture is broken ACROSS the
 *            axis: a stripe running the length of a tube is unchanged when you
 *            slide along it, so it gives exactly zero optical flow and reads as
 *            paint. It carries its own arcs, so the lightning is not only in
 *            the rings.
 */

const RND = (i, salt) => {
  let x = (i*2654435761 + salt*40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
};

/* LAY A TUNNEL ALONG A LENS.
 *
 * Tunnel builds its rings around the world Y axis and takes the camera's
 * position along that axis as travel(t) — a vertical shaft, because every
 * scene that owns one flies straight up. That is fine for the scenes
 * themselves and wrong for every morph: a scene that draws the NEXT scene's
 * tunnel two bars early is usually looking horizontally, and the shaft ends up
 * standing in the ground out of frame. It happened once already, in the
 * jungle, and came back as a picture with a fisheye bend in it and nothing
 * else.
 *
 * This is that fix, written once. Rotate so the tunnel's +Y lands on the
 * camera's own forward vector, then translate so the camera sits exactly on
 * the axis at its own travel coordinate: a point at tunnel height h lands at
 * camPos + fwd*(h - T), so h > T is ahead and h < T is behind. Nothing inside
 * Tunnel changes — it still thinks it is vertical, which is the whole point of
 * doing this with a transform rather than with a second code path.
 *
 * `fwd` must be a unit vector. `T` is travel(t) for the same instant.
 */
const _TUN_UP = new THREE.Vector3(0, 1, 0);
export function layTunnelAlong(group, camPos, fwd, T){
  group.quaternion.setFromUnitVectors(_TUN_UP, fwd);
  group.position.copy(camPos).addScaledVector(fwd, -T);
}

export class Tunnel {
  constructor({ count = 220, radius = 22, perBeat = 4, streaks = 5200, mist = 4200 } = {}){
    this.perBeat = perBeat; this.radius = radius; this.count = count;
    this.SPAN = 2600;

    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = RND(i, 11)*100;

    /* ---- arcs ------------------------------------------------------------ */
    const ag = new THREE.TorusGeometry(radius, 0.55, 5, 220);
    ag.rotateX(-Math.PI/2);
    ag.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.arcs = new THREE.InstancedMesh(ag, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uJag: { value: 1.6 } },
      vertexShader: /* glsl */`
        ${NOISE}
        attribute float aSeed;
        uniform float uTime, uJag;
        varying vec2 vUv; varying vec3 vCol; varying float vSeed; varying float vD;
        void main(){
          vUv = uv; vSeed = aSeed;
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #else
            vCol = vec3(1.0);
          #endif
          vec3 p = position;
          vec3 rad = normalize(vec3(p.x, 0.0, p.z) + vec3(1e-4, 0.0, 0.0));
          float a = uv.x*6.28318;
          /* Three octaves. One alone gives a smooth lobed outline — an amoeba,
             not a discharge. The character is in the fine detail riding the
             coarse path. */
          float n1 = vnoise(vec2(a*3.1, aSeed*7.3 + uTime*0.8))*2.0 - 1.0;
          float n2 = vnoise(vec2(a*9.7 + 11.0, aSeed*3.1 + uTime*1.6))*2.0 - 1.0;
          float n3 = vnoise(vec2(a*29.0 + 5.0, aSeed*5.7 + uTime*3.1))*2.0 - 1.0;
          float jag = n1*0.55 + n2*0.40 + n3*0.22;
          /* Occasional big spurs. A discharge is not a wobble — most of it is
             near the path and now and then it throws a long way off it. */
          jag += sign(jag)*pow(abs(jag), 4.0)*2.6;
          p += rad*jag*uJag;
          p.y += (n2*0.6 + n3*0.3)*uJag*0.55;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          vD = length(mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        ${NOISE}
        ${EXTINCT}
        uniform float uTime;
        varying vec2 vUv; varying vec3 vCol; varying float vSeed; varying float vD;
        void main(){
          float across = 1.0 - abs(vUv.y*2.0 - 1.0);
          float body = pow(max(across, 0.0), 2.2);
          float core = pow(max(across, 0.0), 9.0);
          float a = vUv.x*6.28318;
          /* Broken into segments with hot spots, so it is a discharge and not a
             drawn circle. */
          /* Real gaps. A continuous bright loop is a drawn circle however much
             it wobbles; what makes it a discharge is that most of it is dark. */
          float arc = vnoise(vec2(a*6.4, vSeed*9.7 + uTime*2.4))*0.65
                    + vnoise(vec2(a*19.0, vSeed*2.3 + uTime*4.1))*0.35;
          arc = smoothstep(0.34, 0.74, arc);
          float hot = smoothstep(0.55, 0.95, vnoise(vec2(a*11.0, vSeed*4.4 + uTime*3.3)));
          float flick = 0.60 + 0.40*vnoise(vec2(vSeed*41.0, uTime*4.6));
          vec3 col = vCol*body*(0.35 + 1.5*arc)
                   + vec3(1.0)*core*(0.5 + 2.4*arc + 3.0*hot*arc);
          gl_FragColor = vec4(extinctVoid(col*flick), 1.0);
        }`
    }), count);
    this.arcs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.arcs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count*3), 3);
    this.arcs.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.arcs.frustumCulled = false; this.arcs.renderOrder = 4;

    /* ---- halos ----------------------------------------------------------- */
    const hg = new THREE.TorusGeometry(radius, radius*0.30, 4, 64);
    hg.rotateX(-Math.PI/2);
    this.halos = new THREE.InstancedMesh(hg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, uniforms: {},
      vertexShader: `varying vec2 vUv; varying vec3 vCol; varying float vD;
        void main(){ vUv = uv;
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #else
            vCol = vec3(1.0);
          #endif
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.0);
          vD = length(mv.xyz);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float;
        ${EXTINCT}
        varying vec2 vUv; varying vec3 vCol; varying float vD;
        void main(){
          float across = 1.0 - abs(vUv.y*2.0 - 1.0);
          gl_FragColor = vec4(extinctVoid(vCol*pow(max(across,0.0), 2.6)), 1.0);
        }`
    }), count);
    this.halos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.halos.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count*3), 3);
    this.halos.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.halos.frustumCulled = false; this.halos.renderOrder = 1;

    /* ---- mist ------------------------------------------------------------ */
    this.nMist = mist;
    const mp = new Float32Array(mist*3), mr = new Float32Array(mist), mk = new Float32Array(mist);
    for (let i = 0; i < mist; i++){
      const th = RND(i, 21)*Math.PI*2;
      const rr = radius*(0.05 + 0.98*Math.sqrt(RND(i, 22)));
      mp[i*3] = Math.sin(th)*rr; mp[i*3+1] = this.SPAN*RND(i, 23); mp[i*3+2] = Math.cos(th)*rr;
      mr[i] = 4.0 + 16.0*RND(i, 24);
      mk[i] = RND(i, 25);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('aR', new THREE.BufferAttribute(mr, 1));
    mg.setAttribute('aK', new THREE.BufferAttribute(mk, 1));
    this.mist = new THREE.Points(mg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uCamY: { value: 0 }, uSpan: { value: this.SPAN }, uPx: { value: 400 },
        uA: { value: new THREE.Color(1,1,1) }, uB: { value: new THREE.Color(1,1,1) },
        uAmt: { value: 1 }, uTime: { value: 0 }
      },
      vertexShader: `
        ${EXTINCT}
        attribute float aR; attribute float aK;
        uniform float uCamY, uSpan, uPx, uTime;
        uniform vec3 uA, uB;
        varying vec3 vCol; varying float vA;
        void main(){
          vec3 p = position;
          /* fixed in the world, recycled a span ahead once it is behind us */
          float m = mod(p.y - uCamY, uSpan);
          p.y = uCamY - 30.0 + m;
          p.x += sin(uTime*0.5 + aK*31.0)*1.4;
          p.z += cos(uTime*0.43 + aK*17.0)*1.4;
          float ahead = p.y - uCamY;
          vec4 mv = modelViewMatrix*vec4(p, 1.0);
          float d = max(-mv.z, 1.0);
          vA = smoothstep(6.0, 55.0, ahead) * (1.0/(1.0 + ahead*0.0045));
          vCol = extinctVoid(mix(uA, uB, aK));
          gl_PointSize = clamp(aR*uPx/d, 1.0, 900.0);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `precision highp float;
        uniform float uAmt;
        varying vec3 vCol; varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5)*2.0;
          float m = 1.0 - smoothstep(0.0, 1.0, r);
          m = m*m*m;
          gl_FragColor = vec4(vCol, 1.0)*m*vA*uAmt;
        }`
    }));
    this.mist.frustumCulled = false; this.mist.renderOrder = 2;

    /* ---- streaks --------------------------------------------------------- */
    this.nStreak = streaks;
    this._sa = new Float32Array(streaks); this._sr = new Float32Array(streaks);
    this._sy = new Float32Array(streaks); this._sw = new Float32Array(streaks);
    this._sk = new Float32Array(streaks);
    for (let i = 0; i < streaks; i++){
      this._sa[i] = RND(i, 1)*Math.PI*2;
      this._sr[i] = radius*(0.72 + 0.30*RND(i, 2));
      this._sy[i] = this.SPAN*RND(i, 3);
      this._sw[i] = 0.18 + 0.90*RND(i, 4);
      this._sk[i] = RND(i, 5);
    }
    this.streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, uniforms: {},
      vertexShader: `${EXTINCT}
        varying vec2 vUv; varying vec3 vCol;
        void main(){ vUv = uv;
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #else
            vCol = vec3(1.0);
          #endif
          vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.0);
          vCol = extinctVoid(vCol);
          gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `precision highp float;
        varying vec2 vUv; varying vec3 vCol;
        void main(){
          float w = 1.0 - abs(vUv.x*2.0 - 1.0); w = w*w*w;
          float v = vUv.y;
          float head = smoothstep(0.0, 0.10, v)*(1.0 - smoothstep(0.35, 1.0, v));
          gl_FragColor = vec4(vCol, 1.0)*w*head;
        }`
    }), streaks);
    this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(streaks*3), 3);
    this.streaks.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.streaks.frustumCulled = false; this.streaks.renderOrder = 3;

    /* ---- wall ------------------------------------------------------------ */
    const wg = new THREE.CylinderGeometry(radius*1.06, radius*1.06, 1, 144, 1, true);
    this.wall = new THREE.Mesh(wg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: { uA:{value:new THREE.Color(1,1,1)}, uB:{value:new THREE.Color(1,1,1)},
                  uAmt:{value:0}, uCam:{value:new THREE.Vector3()},
                  uLen:{value:60}, uT:{value:0} },
      vertexShader: `varying vec3 vW;
        void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
                     gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: /* glsl */`precision highp float;
        ${EXTINCT}
        uniform vec3 uA, uB, uCam; uniform float uAmt, uLen, uT; varying vec3 vW;
        float h(float x){ x=fract(x*0.1031); x*=x+33.33; x*=x+x; return fract(x); }
        void main(){
          float d = vW.y - uCam.y;
          float ang = atan(vW.x, vW.z);
          float slot = floor(ang*96.0/3.14159);
          float s = h(slot);
          float L = uLen*(0.5 + 1.6*s);
          float p = fract((vW.y + s*911.0)/(L*2.2));
          float dash = smoothstep(0.0, 0.22, p)*(1.0 - smoothstep(0.30, 0.95, p));
          float near = smoothstep(-30.0, 120.0, d);
          float far = 1.0/(1.0 + d*0.0034);      // an inverse, so there is no end
          /* The wall gets its own discharges, so the lightning is not only in
             the rings. Gated per slot and per tenth of a second, and every term
             is a function of position and time only. */
          float g = h(slot*3.7 + floor(uT*7.0)*13.0);
          float fil = step(0.965, g)*exp(-abs(fract(vW.y*0.016 + s) - 0.5)*16.0);
          vec3 col = mix(uA, uB, s);
          gl_FragColor = vec4(extinctVoid(col + vec3(1.0)*fil*2.0),
                              uAmt*near*far*(0.25 + 1.5*dash) + fil*near*far*0.9);
        }`
    }));
    this.wall.frustumCulled = false; this.wall.renderOrder = 0;

    /* ---- core ------------------------------------------------------------ */
    const cg = new THREE.CylinderGeometry(radius*0.03, radius*0.62, 1, 24, 1, true);
    this.core = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
    }));
    this.core.frustumCulled = false; this.core.renderOrder = 1;

    this.group = new THREE.Group();
    this.group.add(this.wall, this.core, this.halos, this.mist, this.streaks, this.arcs);

    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
    this._c = new THREE.Color(); this._c2 = new THREE.Color();
    this._yax = new THREE.Vector3(0, 1, 0);
    this._xax = new THREE.Vector3(1, 0, 0);
  }

  update(t, { travel, speed, beat0, beat, colour, colour2, px = 400,
              floorY = -1e9, brightness = 1, warp = 0, core = 0.06, mist = 1,
              from = -1e9 }){
    const camY = travel(t);
    const c = this._c, cB = colour2 || colour;

    /* ---- arcs + halos ---------------------------------------------------- */
    const step = beat/this.perBeat;
    const kNow = Math.floor((t - beat0)/step);
    this.arcs.material.uniforms.uTime.value = t;
    this.arcs.material.uniforms.uJag.value = 1.4 + 1.6*warp;
    for (let i = 0; i < this.count; i++){
      const k = kNow - 5 + i;
      const y = travel(beat0 + k*step);
      const ahead = y - camY;
      const down = (k % this.perBeat === 0);
      const bar  = ((k % (this.perBeat*4)) + this.perBeat*4) % (this.perBeat*4) === 0;
      const half = (k % 2) === 0;
      let a = (y < floorY) ? 0 : 1;
      a *= Math.min(1, Math.max(0, (ahead + 26)/26));
      a *= 1.0/(1.0 + ahead*0.0024);
      /* `from` is the distance ahead at which the corridor currently BEGINS,
         and it is how a tunnel arrives out of a vanishing point instead of
         switching on.
         
         'Tunneli hyppää polulle, se voisi alkaa väreilyn horisontista ja
         levitä taakse asti.' A morph that ramps every ring's brightness
         together is a dissolve wearing a tunnel's clothes: the whole object
         appears at once, at every distance, which is the one thing an object
         coming toward you never does. Sweeping `from` inward instead lets the
         far rings — the ones at the vanishing point, subtending almost nothing
         — come up first, and the corridor then builds back toward the camera
         until it is around it. Two hundred and twenty units of softness on the
         edge, so what arrives is a shimmer and not a wall. */
      if (from > -1e8) a *= Math.min(1, Math.max(0, (ahead - from)/220));
      const wob = warp*14;
      this._p.set(wob*Math.sin(k*0.7 + t*0.3), y, wob*Math.cos(k*0.53 + t*0.21));
      this._q.setFromAxisAngle(this._xax, warp*0.25*Math.sin(k*0.41));
      const sc = bar ? 1.14 : (down ? 1.0 : half ? 0.92 : 0.84);
      this._s.set(sc, 1, sc);
      this.arcs.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
      this.halos.setMatrixAt(i, this._m);
      /* Every other arc leans to the second colour, so there is never only one
         hue in the frame. */
      c.copy(k % 2 ? colour : cB).multiplyScalar(a*brightness*(bar ? 15.0 : down ? 8.5 : 4.6));
      this.arcs.setColorAt(i, c);
      c.copy(k % 2 ? cB : colour).multiplyScalar(a*brightness*(bar ? 0.55 : down ? 0.34 : 0.18));
      this.halos.setColorAt(i, c);
    }
    this.arcs.instanceMatrix.needsUpdate = true; this.arcs.instanceColor.needsUpdate = true;
    this.halos.instanceMatrix.needsUpdate = true; this.halos.instanceColor.needsUpdate = true;

    /* ---- mist ------------------------------------------------------------ */
    const mu = this.mist.material.uniforms;
    mu.uCamY.value = camY; mu.uPx.value = px; mu.uTime.value = t;
    mu.uA.value.copy(colour).multiplyScalar(0.42*brightness*mist);
    mu.uB.value.copy(cB).multiplyScalar(0.42*brightness*mist);
    mu.uAmt.value = 1;

    /* ---- streaks --------------------------------------------------------- */
    const L = Math.min(95, Math.max(2.5, speed*0.055));
    const SPAN = this.SPAN;
    for (let i = 0; i < this.nStreak; i++){
      const th = this._sa[i], r = this._sr[i];
      let m = (this._sy[i] - camY) % SPAN; if (m < 0) m += SPAN;
      const y = camY - 30 + m;
      const ahead = y - camY;
      const len = L*(0.40 + 1.5*this._sw[i]);
      this._p.set(Math.sin(th)*r, y, Math.cos(th)*r);
      this._q.setFromAxisAngle(this._yax, th);
      this._s.set(0.05 + this._sw[i]*0.13, len, 1);
      this.streaks.setMatrixAt(i, this._m.compose(this._p, this._q, this._s));
      let a = Math.min(1, Math.max(0, (ahead - 14)/55));
      a *= 1.0/(1.0 + ahead*0.0062);
      /* The streaks sweep in with the arcs — see `from` above. They are the
         long filaments that dominate the frame during a morph, so gating the
         rings and not these would have left the arrival looking exactly as
         abrupt as before, which is what the first attempt at this did. */
      if (from > -1e8) a *= Math.min(1, Math.max(0, (ahead - from)/220));
      this._c2.copy(this._sk[i] > 0.5 ? colour : cB).multiplyScalar(a*brightness*0.34*this._sw[i]);
      this.streaks.setColorAt(i, this._c2);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    this.streaks.instanceColor.needsUpdate = true;

    /* ---- wall and core --------------------------------------------------- */
    const wlen = 4200;
    this.wall.scale.set(1, wlen, 1);
    this.wall.position.set(0, camY + wlen*0.5 - 40, 0);
    const wu = this.wall.material.uniforms;
    wu.uA.value.copy(colour); wu.uB.value.copy(cB);
    wu.uAmt.value = 0.30*brightness; wu.uCam.value.set(0, camY, 0);
    wu.uLen.value = L; wu.uT.value = t;

    const len = 5200;
    this.core.scale.set(1, len, 1);
    this.core.position.set(0, camY + len*0.5 + 20, 0);
    this.core.material.color.copy(colour);
    this.core.material.opacity = core*brightness;
  }

  dispose(){
    for (const m of [this.arcs, this.halos, this.mist, this.streaks, this.wall, this.core]){
      m.geometry.dispose(); m.material.dispose();
    }
  }
}
