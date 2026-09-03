import * as THREE from 'three';
import { buildMembrane, buildWaterColumn } from '../env/water.js';
import { Tunnel } from '../env/tunnel.js';

/* S4 — First passage.  Bars 30–44.
 *
 * We come up through the surface from underneath and there is no sky on the
 * other side: there is a tunnel of light, and the hook is sung inside it.
 *
 * Nothing here is timed by hand. The scene's own bounds, the beat grid and the
 * five hook cues all come out of timeline.json, so if a cue moves by ten
 * milliseconds the picture moves with it.
 */

/* One colour per hook line, in the order the lines are sung. The times are not
   here — only the order is. */
const HOOK_COLOURS = [
  [0.62, 0.42, 1.00],   // Gateway          violet
  [1.00, 0.36, 0.82],   // Open wide        magenta
  [1.00, 0.64, 0.26],   // Take me through  amber
  [0.28, 0.52, 1.00],   // Gateway          deep blue
  [1.00, 0.99, 0.96],   // Into the light   white
];
const APPROACH = [0.42, 0.86, 1.00];   // the colour behind the window

/* The tunnel's build, and the path it is threaded on, both EXPORTED — because
 * S3 draws this same tunnel for the last two bars before the break, and two
 * tunnels that are meant to be one tunnel have to be built from one spec and
 * walked along one path. Anything else and the cut at bar 30 swaps a tunnel
 * for a different tunnel that looks a bit like it, which is the tell.
 *
 * See the note on travel() below: it is defined for t < T0 as well, where it
 * runs backwards into the water, and that is exactly what S3 evaluates. */
export const PASSAGE_TUNNEL = { count: 220, radius: 22, perBeat: 4, streaks: 5200, mist: 4200 };
export const PASSAGE_V0 = 95;         // the contract with s01-under.js's VEND + VSUR
export function passagePath(tl){
  const span = tl.scene('S4') || { t: tl.timeOfBar(30), tEnd: tl.timeOfBar(44) };
  const T0 = span.t, D = span.tEnd - span.t;
  const acc = (620 - PASSAGE_V0)/D;
  return {
    T0,
    travel: (t) => { const u = t - T0; return PASSAGE_V0*u + 0.5*acc*u*u; },
    speed:  (t) => PASSAGE_V0 + acc*(t - T0)
  };
}
/* The colour the tunnel is wearing at the break — the first hook line's. S3
   has to paint its rings with it or the cut changes the light. */
export const PASSAGE_C0 = HOOK_COLOURS[0];

export class PassageScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S4') || { t: tl.timeOfBar(30), tEnd: tl.timeOfBar(44) };
    this.T0 = span.t; this.T1 = span.tEnd;

    /* The path. Distance is the analytic integral of a linear speed ramp, so
       y(t) is a closed form — no accumulator, no dependence on frame order. */
    /* V0 is a CONTRACT with s01-under.js, not a free number: the water's climb
       ends at exactly this speed so bar 30 is a continuation and not a cut.
       Both were 55; both are now 95, because the climb was given a run-in
       through S3 (see s01-under.js's VSUR) and a step here would put the one
       visible edit in the film at the one place it must not be. */
    const V0 = PASSAGE_V0, V1 = 620, D = this.T1 - this.T0;
    this.acc = (V1 - V0)/D; this.v0 = V0;
    /* y = 0 at the scene's first instant: the surface breaks on the drop at bar
       30 and nowhere else. The approach below the water belongs to S3, which
       shares this path — evaluate it at t < T0 and it runs backwards into the
       water, which is what S3 will do. */
    this.travel = (t) => {
      const u = t - this.T0;
      return this.v0*u + 0.5*this.acc*u*u;
    };
    this.speed = (t) => this.v0 + this.acc*(t - this.T0);
    this.tBreak = this.T0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, 16/9, 0.1, 3000);

    this.membrane = buildMembrane();
    this.column   = buildWaterColumn();
    this.tunnel   = new Tunnel(PASSAGE_TUNNEL);
    this.scene.add(this.column, this.tunnel.group, this.membrane);

    /* The measured energy the tunnel's own strength rides on, normalised across
       this scene's own bars — the same device S9's strobe uses, and for the
       same stated reason: the timing is the grid, the strength is the track.
 
       S4 needed it because of a measurement. Its five hook cues land at 62.45,
       64.92, 67.99, 69.10 and 71.38 — and the scene starts at 49.09. So the
       first THIRTEEN AND A HALF SECONDS of a twenty-three second scene contain
       no cue at all: one colour, one composition, one speed ramp, for fifty-
       seven per cent of the shot. That is what 'liian pitkä' is.
 
       The track is not doing nothing there. Bars 34 and 35 (55.75 to 59.09) are
       the loudest in the whole scene — rms 0.846 and 0.844 against 0.71 to 0.76
       either side, kick 0.87 against 0.65 to 0.75 — and the picture was ignoring
       the one event it had. */
    let lo = Infinity, hi = -Infinity;
    for (const b of (tl.d.bars || [])){
      if (b.bar >= 30 && b.bar < 44){ lo = Math.min(lo, b.kick); hi = Math.max(hi, b.kick); }
    }
    this._lo = Number.isFinite(lo) ? lo : 0;
    this._hi = Number.isFinite(hi) && hi > lo ? hi : this._lo + 1;

    /* The hook, read out of the timeline rather than written down here. */
    const cues = (tl.d.lyrics || []).filter(c => c.t >= this.T0 && c.t < this.T1);
    this.keys = [{ t: this.T0, c: new THREE.Color(...APPROACH) }];
    cues.forEach((c, i) => {
      const rgb = HOOK_COLOURS[Math.min(i, HOOK_COLOURS.length - 1)];
      this.keys.push({ t: c.t, c: new THREE.Color(...rgb) });
    });
    this.tLight = cues.length ? cues[cues.length - 1].t : this.T1;   // 'Into the light'

    this._col = new THREE.Color();
    this._colB = new THREE.Color();
    this._tgt = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._ref = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  /** Roll angle. The rate rises with speed, so it is the distance travelled
      times a constant — which is a closed form and never depends on the frame
      before it.

      The first version had this at a hundred times its present value: twenty
      revolutions across the scene, which is not travel down a tunnel, it is a
      barrel roll. A tunnel is looked down. One and a quarter turns in
      twenty-three seconds is enough to keep the frame from being rigid. */
  _rollAt(t){ return this.travel(t)*0.0010; }

  /** The tunnel's colour at t: the last hook line that has been sung, eased in. */
  colourAt(t){
    const k = this.keys;
    let i = 0;
    while (i + 1 < k.length && t >= k[i+1].t) i++;
    const c = this._col.copy(k[i].c);
    if (i > 0){
      const f = Math.min(1, (t - k[i].t)/0.22);
      c.copy(k[i-1].c).lerp(k[i].c, f*f*(3 - 2*f));
    }
    return c;
  }

  /** The accent. Never the same hue as the lead: a tunnel lit by one colour is
      a gel, and two colours is light. */
  colour2At(t){
    this._hsl = this._hsl || { h:0, s:0, l:0 };
    this._colB.copy(this._col).getHSL(this._hsl);
    this._colB.setHSL((this._hsl.h + 0.42) % 1, Math.min(1, this._hsl.s*0.95 + 0.15),
                      Math.min(1, this._hsl.l*0.9 + 0.10));
    return this._colB;
  }

  update(t, post){
    const tl = this.tl;
    const y = this.travel(t);
    const v = Math.max(0, this.speed(t));
    const above = y > 0;
    const ek = Math.min(1, Math.max(0, (tl.energy(t, 'kick') - this._lo)/(this._hi - this._lo)));
    const colour = this.colourAt(t);
    const colour2 = this.colour2At(t);

    // ---- camera ------------------------------------------------------------
    /* Tilt matters more than it looks. Snell's window is 97 degrees wide, which
       is wider than the frame — look straight up and the whole picture is inside
       the window and there is no window to see. Tilted, the critical angle cuts
       across the frame and the gateway has an edge. The tilt also gives the
       surface something to sweep through the frame at the break; edge-on, a
       plane you pass through is invisible.

       It eases to vertical over the two bars after the break, which is the shot
       finding its own axis rather than a camera move. */
    const bar = tl.bar(t);
    const u = t - this.tBreak;
    const k = Math.min(1, Math.max(0, (u + 1.0)/4.4));
    const ease = k*k*(3 - 2*k);

    /* AND IT NEVER QUITE FINDS THE AXIS — which is the difference between this
       scene being twenty-three seconds long and feeling it.
     *
     * The tilt used to decay to exactly zero and stay there for the remaining
     * twenty seconds. A camera sitting ON the axis of a radially symmetric
     * tunnel, looking ALONG that axis, cannot produce a picture that changes:
     * every ring is a concentric circle about the frame's centre, and the only
     * things left free are colour and scale. Rendered at two frames a second
     * across the whole scene it is one composition forty-eight times — a bright
     * blob dead centre with a ring round it — and no amount of speed shows up in
     * it, because speed on an axis of symmetry moves nothing sideways.
     *
     * So the camera keeps a few degrees of aim off the axis and a few units off
     * the centre line, both wandering on incommensurable rates that never come
     * back round inside the scene. That is all it takes: the vanishing point
     * leaves the middle of frame and moves, the rings go eccentric, and the wall
     * nearest the lens sweeps. Nothing here is a camera MOVE — it is a corridor
     * that is not perfectly straight and a pilot who is not perfectly centred,
     * which is what makes a corridor read as a place rather than as a texture.
     *
     * Both are gated by the same ramp the tilt decays on, so at the break they
     * are exactly zero and the join with S3 is untouched. */
    const wob = 0.075*Math.sin(u*0.291 + 0.7) + 0.045*Math.sin(u*0.173 + 2.1);
    const tilt = 0.50*(1 - ease) + ease*Math.abs(wob) + 0.020*ease;
    const az = bar*0.030 + ease*1.9*Math.sin(u*0.211 + 1.3);
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();
    /* Roll rate follows the speed. A constant roll at 600 units a second reads
       as a slower picture than the same roll at 55, because everything else has
       sped up around it. */
    this._q.setFromAxisAngle(this._dir, this._rollAt(t));
    this._up.applyQuaternion(this._q);

    /* A slow widening of the lens. Not a punch — this ramps once, across
       twenty-three seconds, and it is the cheapest sense of acceleration there
       is: a wider lens moves the edges of frame faster for the same speed. */
    const fov = 66 + 18*Math.min(1, Math.max(0, (t - this.T0)/(this.T1 - this.T0)));
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }
    /* Off the centre line as well as off the axis. Seven units in a
       twenty-two unit tunnel is a third of the way to the wall — enough that
       the rings are visibly eccentric and the near wall passes on one side,
       nowhere near enough to fly into anything. */
    const ox = ease*(4.6*Math.sin(u*0.237 + 0.4) + 2.6*Math.sin(u*0.149 + 2.9));
    const oz = ease*(4.6*Math.cos(u*0.199 + 1.8) + 2.6*Math.cos(u*0.131 + 0.6));
    this.camera.position.set(ox, y, oz);
    this.camera.up.copy(this._up);
    this._tgt.copy(this.camera.position).add(this._dir);
    this.camera.lookAt(this._tgt);

    // ---- the window --------------------------------------------------------
    // It brightens over the last bar and a half of the climb, then we are through.
    const open = Math.min(1, Math.max(0, (t - (this.tBreak - 3.0))/3.0));
    const mu = this.membrane.material.uniforms;
    mu.uTime.value = t;
    mu.uCam.value.copy(this.camera.position);
    mu.uSky.value.copy(colour);
    mu.uOpen.value = open;
    /* The tunnel's rings show through the window. This is the only scene where
       there is a tunnel on the other side, so it is the only scene that turns
       them on — see the note in water.js. */
    mu.uRings.value = 1.0;
    // above the surface it falls away behind us
    mu.uFade.value = above ? Math.max(0, 1 - y/170) : 1;
    this.membrane.position.set(0, 0, 0);
    this.membrane.visible = mu.uFade.value > 0.002;

    const cu = this.column.material.uniforms;
    cu.uTime.value = t;
    cu.uTint.value.copy(colour).lerp(new THREE.Color(0.45, 0.80, 0.95), 0.55);
    cu.uFade.value = above ? Math.max(0, 1 - y/210) : 1;
    this.column.position.set(0, Math.min(0, y), 0);
    this.column.visible = cu.uFade.value > 0.002;

    // ---- the tunnel --------------------------------------------------------
    this.tunnel.update(t, {
      travel: this.travel, speed: v,
      beat0: tl.origin, beat: tl.beat,
      colour, colour2,
      px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
      mist: above ? 1 : 0.25,
      floorY: 0,
      /* Strength from the track. The ramp-in is unchanged; what is new is that
         after it the tunnel is not simply on — it breathes with the kick, so
         the loudest two bars of the scene are the brightest two bars of it. */
      brightness: Math.min(1, Math.max(0, (y + 25)/45))*(0.78 + 0.40*ek),
      /* The light at the far end opens only for the last line. Left on, it
         becomes a white ball in the middle of every shot and the rings have
         nothing to be seen against. */
      core: 0.018 + 0.62*Math.min(1, Math.max(0, (t - (this.tLight - 1.6))/1.6)),
      /* And the rings jag when the track is hardest. Small — this is a corridor
         under pressure, not the one in S15 that is coming apart. */
      warp: 0.14*ek*ek
    });
    this.tunnel.group.visible = y > -40;

    // ---- grade -------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    const through = Math.min(1, Math.max(0, (t - this.tBreak)/0.35));

    // deep water is a narrow, dark, blue picture; the tunnel is none of those
    c.uExposure.value = 0.86 + 0.90*through;
    c.uBloom.value    = 0.50 + 0.72*through;
    c.uCA.value       = 0.0016 + 0.0052*through;
    c.uVignette.value = 0.86 - 0.34*through;
    c.uGrain.value    = 0.045 - 0.022*through;
    c.uLift.value.setRGB(0.002 + 0.004*through, 0.010, 0.022);
    c.uGain.value.setRGB(0.96 + 0.10*through, 0.99, 1.06 - 0.04*through);

    // the surface bursting, and then the last line
    /* The break used to be a quiet 0.22 -- barely a flicker, and the frame
       right before it (S1's camera grazing the surface at near-zero
       clearance) is soft and undifferentiated rather than sharp, so nothing
       covered the seam. Raised to a real flash, it does the covering: the cut
       lands inside the whiteout instead of beside it. See the matching
       preBurst term in s01-under.js -- both curves hit the same peak at the
       same instant, so the flash is one continuous event that happens to
       straddle a scene swap, not two flashes that almost line up. */
    const burst = t < this.tBreak ? 0 : Math.exp(-(t - this.tBreak)*16.0);
    const light = Math.min(1, Math.max(0, (t - this.tLight)/1.1));
    c.uFlash.value = 1.2*burst + 0.85*light*light*light;

    // far softening only; the tunnel's far end should not be sharp
    d.uStart.value = above ? 260 : 90;
    d.uEnd.value   = above ? 1100 : 520;
    d.uMaxRadius.value = 2.4;
  }

  dispose(){ this.tunnel.dispose(); }
}
