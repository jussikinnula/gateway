import * as THREE from 'three';

/* S0 — test card, not a scene.
 *
 * It exists so that the pipeline can be proved end to end before a single frame
 * of the film is designed: preview plays, `npm run pack` produces a file that
 * opens on a double click, `npm run stills` writes a PNG, `npm run render`
 * writes an mp4 with the audio in sync. Delete it once S1 exists.
 *
 * It also demonstrates the one rule the whole renderer rests on: every frame is
 * a pure function of `t`. No clock, no accumulator, no Math.random in the frame
 * path — anything else and parallel rendering produces a different film. */
export class PortalTest {
  constructor(tl){
    this.tl = tl;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 16/9, 0.1, 4000);

    // a corridor of rings — the crudest possible "gateway"
    this.rings = [];
    const geo = new THREE.TorusGeometry(9, 0.09, 6, 128);
    for (let i = 0; i < 48; i++){
      const m = new THREE.MeshBasicMaterial({ color: 0x7b5cff, transparent: true, opacity: 0.9 });
      const r = new THREE.Mesh(geo, m);
      r.position.z = -i * 26;
      this.scene.add(r);
      this.rings.push(r);
    }

    // a static point field, positioned by index so it is reproducible
    const N = 4000, pos = new Float32Array(N*3);
    for (let i = 0; i < N; i++){
      const a = i * 2.399963;                    // golden angle, deterministic
      const rad = 12 + (i % 97) * 1.9;
      pos[i*3]   = Math.cos(a) * rad;
      pos[i*3+1] = Math.sin(a) * rad;
      pos[i*3+2] = -((i * 37) % 1250);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.5, color: 0x2ec5b6 }));
    this.scene.add(this.points);
  }

  update(t, post){
    const tl = this.tl;
    const speed = 60;                            // world units per second
    const z = -t * speed;
    this.camera.position.set(0, 0, z);
    this.camera.lookAt(0, 0, z - 100);

    // rings recycle ahead of the camera — index arithmetic, not accumulation
    const span = this.rings.length * 26;
    this.rings.forEach((r, i) => {
      const base = -i * 26;
      const zi = z - span + (((base - z) % span) + span) % span;   // always ahead
      r.position.z = zi;
      const d = z - zi;                                            // 0 .. span
      r.material.opacity = Math.max(0, Math.min(1, (1 - d/span) * Math.min(1, d/60)));
      r.rotation.z = t * 0.15 + i * 0.4;
    });

    // beat response: exposure and bloom only — never geometry, never global FOV
    const pulse = tl.beatPulse(t, 9);
    const c = post.qComp.u;
    c.uExposure.value = 1.0 + 0.10 * pulse;
    c.uBloom.value    = 0.55 + 0.18 * tl.barPulse(t, 3);
    c.uVignette.value = 0.7;
    c.uGrain.value    = 0.03;
  }
}
