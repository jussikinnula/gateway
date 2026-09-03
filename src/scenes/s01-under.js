import * as THREE from 'three';
import { buildMembrane, buildWaterColumn, buildMurk, buildShafts, buildBubbles, buildSeabed } from '../env/water.js';
import { Tunnel } from '../env/tunnel.js';
import { PASSAGE_TUNNEL, PASSAGE_C0, passagePath } from './s04-passage.js';

/* S1–S3 — Under / Open your eyes / Ascent.  Bars 1–30.
 *
 * One continuous rise, from as deep as the water goes to the moment the surface
 * breaks at bar 30. There is no cut in it: the three authored scenes are three
 * things the same shot does, and the shot list says so — "no cut inside the
 * shot", "the tilt completes", "still rising".
 *
 * Two constraints come from S4 and are not negotiable, because a discontinuity
 * at bar 30 would be the most visible edit in the film:
 *
 *   position   y(T4) = 0            the surface breaks at the drop and nowhere else
 *   speed      v(T4) = 55           S4's path starts at 55 units a second
 *
 * S4's own travel() cannot simply be run backwards to get here: it is a
 * parabola whose vertex is two and a half seconds before the break, so it turns
 * around and dives. This scene has its own closed form, matched to S4's at the
 * boundary.
 */

/* A JS twin of core/glsl.js's gnoise()/fbm(), used to know — once a frame,
 * not once a pixel — how clear the sky is, so the shafts and the window's
 * sun glow can answer to it instead of shining independently of what the
 * window shows above them. Without this, the ceiling can show an overcast
 * sky while the beams underneath blaze on regardless, which reads as a sun
 * with no visible source: real shafts like these come from a gap in moving
 * cloud, and they should wax and wane as the gap does.
 *
 * It samples the same cloud field aboveWater() draws, but at a fixed
 * overhead direction and not the exact ray to the sun — there is no cheap
 * way to ask the GPU that from here, and this only needs to know whether a
 * gap exists somewhere near overhead right now, not to trace the one ray
 * that would prove it. Same algorithm, a coarser question. */
function frac(x){ return x - Math.floor(x); }
function hash22js(x, y){
  let p3x = frac(x*0.1031), p3y = frac(y*0.1030), p3z = frac(x*0.0973);
  const s = p3x*(p3y + 33.33) + p3y*(p3z + 33.33) + p3z*(p3x + 33.33);
  p3x += s; p3y += s; p3z += s;
  return [frac((p3x + p3y)*p3z)*2 - 1, frac((p3x + p3z)*p3y)*2 - 1];
}
function gnoiseJS(x, y){
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx*fx*fx*(fx*(fx*6 - 15) + 10);
  const uy = fy*fy*fy*(fy*(fy*6 - 15) + 10);
  const g00 = hash22js(ix, iy),     a = g00[0]*fx     + g00[1]*fy;
  const g10 = hash22js(ix+1, iy),   b = g10[0]*(fx-1) + g10[1]*fy;
  const g01 = hash22js(ix, iy+1),   c = g01[0]*fx     + g01[1]*(fy-1);
  const g11 = hash22js(ix+1, iy+1), d = g11[0]*(fx-1) + g11[1]*(fy-1);
  const lerp = (p, q, u) => p + (q - p)*u;
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy)*0.72 + 0.5;
}
function fbmJS(x, y){
  let a = 0.5, s = 0.0, px = x, py = y;
  for (let i = 0; i < 5; i++){
    s += a*gnoiseJS(px, py);
    const nx = 0.80181*px - 0.59758*py, ny = 0.59758*px + 0.80181*py;
    px = nx*2.03 + 11.7; py = ny*2.03 + 11.7;
    a *= 0.5;
  }
  const t = Math.min(1, Math.max(0, (s - 0.038)/(0.930 - 0.038)));
  return t*t*(3 - 2*t);
}
/* 1 where the sky overhead is clear, 0 where it is thick cloud — the exact
   complement of the cl term inside aboveWater(), evaluated at dir=(0,1,0)
   so dir.xz drops out and only the drift (time*0.010, time*0.006) is left,
   which is the whole reason it changes at all: clouds moving overhead, not
   the sun moving under them. */
function skyClearness(time){
  const qx = time*0.010, qy = time*0.006;
  const n = fbmJS(qx*0.85, qy*0.85);
  const m = fbmJS(qx*2.4 + 17.0, qy*2.4 + 17.0);
  const s = n*0.70 + m*0.38;
  const t = Math.min(1, Math.max(0, (s - 0.38)/(0.84 - 0.38)));
  const cl = t*t*(3 - 2*t);
  return 1.0 - cl;
}

/* Where the rise starts. Four bars of nothing first — the picture is empty
   because there is nothing to see, and it has to be empty long enough for that
   to read as a choice. */
const BAR_MOVE = 5;
/* The exponent of the climb. Two is a linear acceleration and too even; four
   holds still for eighteen bars and then bolts. */
const N = 2.6;

/* And the rise does not start from a standstill.

   The note is 'alussa oleva veden alla kelluminen on kyllästyttävää'. Measured,
   with v = VEND*p^N alone: at the HALFWAY point of a forty-two-second climb the
   camera had covered eight per cent of the distance. It sat between y = -636
   and y = -625 for the first thirteen seconds — eleven units in thirteen
   seconds, against a frame with nothing in it to measure even that against.
   There is no reading of that which is not floating.

   A fraction of the end speed is now there from the first frame, so the shot
   opens already moving. It cannot be more than a fraction: the whole shape of
   this scene is one accelerating rise and the acceleration has to still be the
   thing you feel. Twelve per cent is 6.6 units a second at the bottom, which
   against the floor below — see the seabed, which is now IN the picture — is
   sixty-six units of parallax in the first ten seconds instead of eleven.

   v = VEND*(V0F + (1-V0F)*p^N), whose integral is still elementary, so position
   and speed remain closed forms of t that agree with each other exactly, and
   both endpoints still hold: v(1) = VEND and y(1) = 0 by construction. */
const V0F = 0.12;

/* The run-in.
 *
 * 'Saisiko ennen tunnelia kiihdytettyä vauhtia veden alla?' — 'nopeutus tulisi
 * S3 alusta loppuun jatkuvasti kiihtyvänä.'
 *
 * So it is a second term, switched on at the top of S3 and rising as a CUBE
 * from there: s(p) = ((p-p0)/(1-p0))^3. A cube and not a ramp because the note
 * is about acceleration and not about speed — dv/dp goes as the square of how
 * far into S3 we are, so the rate of change is itself still growing at the
 * break rather than levelling off into it. Its integral is elementary, which is
 * the whole reason it can be a term at all: position stays a closed form of t.
 *
 * p0 is READ from the timeline, not written down — the phase at S3's own start
 * — so if the scene table moves, the run-in moves with it.
 *
 * The end speed is therefore VEND + VSUR, and that number is shared with S4's
 * V0 by contract. Both were 55; both are now 95. Raising it here and not there
 * would put a step in the middle of the one cut in this film that must not have
 * one. It also only deepens the climb by VSUR*L*(1-p0)/4 — about a hundred and
 * seventy units — because the surge is only on for the last two fifths of it,
 * so the opening is not pushed back down into the dark to pay for the ending. */
const VSUR = 40;
const VEND = 55;          // VEND + VSUR must equal S4's V0

export class UnderScene {
  constructor(tl){
    this.tl = tl;
    const s1 = tl.scene('S1'), s4 = tl.scene('S4');
    this.T0 = s1 ? s1.t : tl.timeOfBar(1);
    this.T4 = s4 ? s4.t : tl.timeOfBar(30);
    this.tMove = tl.timeOfBar(BAR_MOVE);
    this.L = this.T4 - this.tMove;
    /* Where the run-in starts, as a phase: S3's own downbeat. */
    const s3 = tl.scene('S3');
    this.p0 = Math.min(0.95, Math.max(0, ((s3 ? s3.t : tl.timeOfBar(20)) - this.tMove)/this.L));

    /* The normalised integrals of the two speed terms. I(p) = V0F*p +
       (1-V0F)*p^(N+1)/(N+1) for the climb, J(p) = (1-p0)/4*((p-p0)/(1-p0))^4
       for the run-in; VEND*I(1) + VSUR*J(1) is therefore how deep it starts. */
    const IEND = V0F + (1 - V0F)/(N + 1);
    const JEND = (1 - this.p0)/4;
    this.depth = this.L*(VEND*IEND + VSUR*JEND);

    /* Position and speed, both closed forms of t alone.
       y(p) = -depth*(1 - p^(N+1)) reaches 0 exactly at p = 1, and its derivative
       there is VEND by construction. Nothing accumulates; frame 900 does not
       need frames 0..899 to have happened. */
    this.phase = (t) => Math.min(1, Math.max(0, (t - this.tMove)/this.L));
    const run = (p) => Math.max(0, (p - this.p0)/(1 - this.p0));
    this.run = (t) => run(this.phase(t));
    this.travel = (t) => {
      const p = this.phase(t);
      const I = V0F*p + (1 - V0F)*Math.pow(p, N + 1)/(N + 1);
      const J = (1 - this.p0)/4*Math.pow(run(p), 4);
      return -this.L*(VEND*(IEND - I) + VSUR*(JEND - J));
    };
    this.speed = (t) => {
      const p = this.phase(t);
      return VEND*(V0F + (1 - V0F)*Math.pow(p, N)) + VSUR*Math.pow(run(p), 3);
    };

    /* 'Higher!' is a surge, not a new speed. A raised cosine because its
       integral is elementary — a gaussian's is not, and the position has to
       stay a closed form. */
    const hi = (tl.d.lyrics || []).find(c => c.bar >= 25.5 && c.bar < 26.5);
    this.tHi = hi ? hi.t : tl.timeOfBar(25.9);
    this.hiW = 1.9; this.hiA = 26.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 3000);

    this.murk     = buildMurk();
        /* The source is high, not just above the surface: at ninety units the
       outermost shafts leave the water almost horizontally, which is not a
       shaft, it is a floor. Fourteen hundred puts the widest one about twenty
       degrees off vertical, which is what a sun through a swell actually
       does. */
        /* Spread wide. A fan of beams inside a five-hundred-unit cylinder around
       the camera has no far end, and no far end is what makes a frame read as a
       room. */
    this.shafts   = buildShafts(240, { spread: 1050, length: 1500 });
    /* Denser and larger than the default — see the note on buildWaterColumn().
       S1 is inside this field for twenty-five bars with nothing else in frame
       to measure its own movement against; S4 passes through it at speed with a
       tunnel to look at, and keeps the defaults. */
    this.column   = buildWaterColumn(44000, { mote: 0.20 });
    this.bubbles  = buildBubbles(15000, { span: 190, height: 1300, top: -1.0 });
    this.membrane = buildMembrane();

    /* THE TUNNEL, two bars early — and this is not a new idea, it is the one
       s04-passage.js wrote down and never got: 'the approach below the water
       belongs to S3, which SHARES THIS PATH — evaluate it at t < T0 and it runs
       backwards into the water, which is what S3 will do.'
 
       The note asked for the two scenes to morph rather than to cut or cross-
       fade, and a cross-fade is what you get from two different things sharing
       a frame. This is one thing shared by two scenes: the same build
       (PASSAGE_TUNNEL), threaded on the same path (passagePath), painted in the
       same colour (PASSAGE_C0) — so at bar 30 nothing about it changes. The
       rings that are already coming toward the lens keep coming, and the cut
       happens underneath a continuous object rather than to it.
 
       It is drawn ADDITIVELY into water that is nearly black, which is what
       makes it a morph and not a dissolve: nothing of the water is taken away
       to pay for it. The rings arrive as light appearing in the water — first
       inside Snell's window, where the membrane has always been able to draw
       them (uRings, which no scene until now has ever turned on before the
       break), then as the real geometry out beyond the surface. */
    this.tunnel   = new Tunnel(PASSAGE_TUNNEL);
    this.tunnel.group.visible = false;
    this.path     = passagePath(tl);
    /* Two bars. Long enough that the tunnel is unmistakably already there when
       the cut lands, short enough that it does not become the shot. */
    this.tMorph   = this.T4 - 2*tl.barSec;
    this._cT      = new THREE.Color(...PASSAGE_C0);
    this._cT2     = new THREE.Color();
    this._hslT    = { h: 0, s: 0, l: 0 };
    /* THE FLOOR, and the shot now starts on it.

       This was at y = -1180 with the camera bottoming out at -636, and its own
       comment said its job was 'that the picture has a far distance in it at
       all'. It did not do that job. Rendered on its own with everything else
       muted, at three instants across the climb, the layer contributes a flat
       0.069 wash with a maximum of 0.094 — which is the haze term, not the
       geometry. Three hundred boulders and a duned floor were built on every
       load of this scene and appeared in not one frame of the film.

       Which is also the other half of the note. The opening is not boring
       because it is slow; it is boring because a slow move with nothing in
       frame is not a move at all. The camera opens nearly level — tilt 1.36
       radians from vertical, so the bottom of a 60-degree frame is eighteen
       degrees BELOW horizontal — and there was nothing down there. Put the
       floor a hundred and sixty units under the lens and the same climb has
       dunes and boulders leaving the bottom of frame from the first second, a
       horizon to recede into, and a scale; and rising off the bottom of the sea
       is an event, which this shot did not have one of until bar 25.

       Placed relative to the start rather than at a fixed depth, so it cannot
       silently part company with the camera again the next time the speed
       profile moves — which is exactly how it came to be five hundred units out
       of frame. Denser, too: three hundred boulders over 5200 units is one
       every three hundred, which at this range is a bare floor. */
    this.seabed   = buildSeabed({ y: -this.depth - 160, size: 5200, boulders: 900 });
    /* No longer a refractive pass — the mini-bubbles are plain glowing points,
       drawn forward with everything else. */
    this.scene.add(this.murk, this.seabed, this.column, this.shafts, this.bubbles, this.tunnel.group, this.membrane);

    /* Where the light is. It moves — slowly, and on a path that is a pure
       function of t like everything else. It is the only thing above the water
       and the whole shot is lit by it, so moving it moves the hot spot in the
       window, swings the fan of shafts, and re-lights every particle in the
       column, all from one vector. */
    this._src = new THREE.Vector3();

    /* The two cues that fire a pulse through the column, read out of the
       timeline rather than written down. */
    const cues = (tl.d.lyrics || []).filter(c => c.t >= this.T0 && c.t < this.T4);
    this.pulses = cues.filter(c => /hey|move/i.test(c.text || '')).map(c => c.t);
    this.tEyes  = (cues.find(c => /open your eyes/i.test(c.text || '')) || {}).t
               || tl.timeOfBar(17.02);
    this.tOpen  = (cues.find(c => /gateway is open/i.test(c.text || '')) || {}).t
               || tl.timeOfBar(19.15);

    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._ref = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._c = new THREE.Color();
    this._vel = new THREE.Vector3();
  }

  /* The surge, and its exact integral, so speed and position never disagree. */
  _surge(t){
    const x = (t - this.tHi)/this.hiW;
    return Math.abs(x) < 1 ? this.hiA*0.5*(1 + Math.cos(Math.PI*x)) : 0;
  }
  _surgeInt(t){
    const x = Math.min(1, (t - this.tHi)/this.hiW);
    if (x <= -1) return 0;
    return this.hiA*this.hiW*0.5*(x + 1 + Math.sin(Math.PI*x)/Math.PI);
  }

  yAt(t){ return this.travel(t) + this._surgeInt(t) - this._surgeInt(this.T4); }
  vAt(t){ return this.speed(t) + this._surge(t); }

  update(t, post){
    const tl = this.tl;
    const bar = tl.bar(t);
    const y = this.yAt(t);
    const v = this.vAt(t);
    const depthBelow = -y;                       // how much water is overhead

    // ---- camera ------------------------------------------------------------
    /* The tilt is the shot's argument. It starts nearly level, where there is
       nothing to see, and ends at half a radian off vertical — which is exactly
       where S4 picks it up, so bar 30 is a continuation and not a cut. It also
       has to end there for a reason that is not continuity: Snell's window is
       97 degrees wide, wider than the frame, so a camera pointed straight up is
       entirely inside the window and there is no window to see. */
    /* Two stages, and the middle one is the shot.

       Pointed straight up, the surface fills the frame and there is no water in
       the picture — and the water is what says where we are. Every photograph
       of this holds the surface as a bright BAND across the top with the beams
       coming down through dark water below it, which needs a good deal more
       tilt than the break does. So it opens nearly level, comes up to about
       fifty-five degrees off vertical and stays there for the whole middle of
       the climb, and only lifts to S4's half a radian over the last few bars —
       which is also when it becomes true, because by then we are right under
       it. */
    const k = Math.min(1, Math.max(0, (bar - 5)/11));
    const e = k*k*(3 - 2*k);
    const k2 = Math.min(1, Math.max(0, (bar - 24)/6));
    const e2 = k2*k2*(3 - 2*k2);
    const tilt = 1.36 - (1.36 - 0.97)*e - (0.97 - 0.50)*e2;   // radians from vertical
    const az = bar*0.030;                                  // S4's rate, so yaw is continuous
    this._dir.set(Math.sin(tilt)*Math.sin(az), Math.cos(tilt), Math.sin(tilt)*Math.cos(az)).normalize();
    this._ref.set(0, 1, 0);
    if (Math.abs(this._dir.y) > 0.985) this._ref.set(0, 0, 1);
    this._right.crossVectors(this._dir, this._ref).normalize();
    this._up.crossVectors(this._right, this._dir).normalize();
    /* Roll unwinds to zero at the break, where S4's roll starts from zero. */
    this._q.setFromAxisAngle(this._dir, y*0.00055);
    this._up.applyQuaternion(this._q);

    /* The lens narrows as we climb. The opposite of S4, and for the same
       reason: down here the frame should feel like it has walls. */
    const fov = 60 - 6*e + 12*Math.min(1, Math.max(0, (bar - 20)/10));
    if (Math.abs(this.camera.fov - fov) > 1e-4){
      this.camera.fov = fov; this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(0, y, 0);
    this.camera.up.copy(this._up);
    this._tgt.copy(this.camera.position).add(this._dir);
    this.camera.lookAt(this._tgt);

    // ---- the light above ---------------------------------------------------
    /* A wide, slow arc. Two incommensurable rates so it never retraces the same
       path inside the shot, and high enough that the outermost shaft still
       leaves the surface within twenty degrees of vertical. */
    const H = 1400;
    this._src.set(Math.sin(t*0.043)*520 + Math.sin(t*0.017)*180,
                  H,
                  Math.cos(t*0.037)*440 + Math.cos(t*0.023)*160);

    // ---- how much water is in the way --------------------------------------
    /* One number drives the whole reveal. At the bottom it is thick enough that
       six hundred units of water is opaque; by the surface there is nothing
       between the camera and the membrane, so it goes to zero on its own as the
       camera rises — no fade is authored anywhere. */
    const murk = 0.0026;
    const px = 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360);

    // ---- the surface -------------------------------------------------------
    /* 'Open your eyes' opens the frame; 'the gateway is open' brightens what is
       behind the window. Both are measured cue times. */
    const eyes = Math.min(1, Math.max(0, (t - this.tEyes)/1.2));
    const open = Math.min(1, Math.max(0, (t - this.tOpen)/2.4));
    const near = Math.min(1, Math.max(0, (300 - depthBelow)/300));
    /* Whether there is a gap in the cloud right now — see skyClearness()
       above. Drives the shafts and the window's own sun glow together, so
       neither one shines with a source the other isn't showing. */
    const clear = skyClearness(t);

    const mu = this.membrane.material.uniforms;
    mu.uTime.value = t;
    mu.uCam.value.copy(this.camera.position);
    /* The window is a shape, not a brightness. At six hundred units down the
       whole frame sits within a few percent of itself and the eye finds no
       edge, so what has to grow through S2 is the contrast between the inside
       of the cone and the mirror outside it — not the exposure. */
    mu.uOpen.value = 0.16 + 0.75*open + 0.45*near*near;
    mu.uFade.value = 1;
    mu.uMurk.value = murk;
    /* Near-white on purpose. uSky multiplies whatever is on the other side, so
       a strongly tinted one flattens the sky it is meant to be letting through
       — the blue has to come from the sky itself, not from a gel over it. */
    this._c.setRGB(0.55, 0.80, 0.96).lerp(new THREE.Color(0.90, 0.97, 1.00), 0.35*eyes + 0.65*near);
    mu.uSky.value.copy(this._c);
    mu.uSun.value.copy(this._src);
    /* There is a sky up there, and from down here you can see into it — the
       whole of it, folded into the window. It arrives with the light: at the
       bottom of the climb there is not enough of anything getting through for a
       sky to mean anything, and by the surface it is most of the picture. */
    mu.uSkyMix.value = 0.55 + 0.45*Math.min(1, 0.5*eyes + 0.9*near);
    mu.uCloud.value = 0.80;
    /* What the mirror outside the window shows, which is the water below —
       never black. A surface reflecting nothing is a lid.

       Not picked separately from what the water dome already is: uUp is the
       murk sphere's own colour for looking roughly horizontally into the
       water — which is what a facet outside the window is doing, geometrically,
       so it is the right sample to reuse, not the straight-down uDown the
       seabed borrows (that is the abyss below the seabed, not the water
       beside the window). One water colour driving the dome, the mirror and
       the distance fade instead of three tuned to look alike. uAmb is the
       brightness dial — the same "how much of the surface light gets down"
       curve that brightens the water dome. */
    mu.uMurkCol.value.copy(this.murk.material.uniforms.uUp.value);
    mu.uAmb.value = 0.34 + 0.45*near;
    mu.uSunVis.value = clear;
    this.membrane.position.set(0, 0, 0);

    // ---- the water ---------------------------------------------------------
    const gu = this.murk.material.uniforms;
    this.murk.position.copy(this.camera.position);
    gu.uTime.value = t;
    /* Kept deliberately low. The water's own glow is the floor everything else
       has to stand above; raise it and the window has nothing to be brighter
       than, which is the failure mode of every underwater shot. */
    gu.uLift.value = 0.30 + 0.30*eyes + 0.55*near;

    /* The pulses: 'Hey!' and 'Move!' each send one brightening up the column.
       A pulse is a function of (t - cue) only, so it is reproducible and it
       cannot drift if the cue moves. */
    let pulse = 0;
    for (const tp of this.pulses){
      const u = t - tp;
      if (u >= 0 && u < 1.6) pulse = Math.max(pulse, Math.exp(-u*3.4)*(1 - u/1.6));
    }

    const cu = this.column.material.uniforms;
    cu.uTime.value = t;
    cu.uPx.value = px;
    cu.uMurk.value = murk*0.55;
    /* The particulate arrives on the measured kick entry at bar 10 — the water
       does not become dirty, the light becomes strong enough to show what was
       always in it. */
    /* And the field brightens through the run-in on the same cube. A streak is
       dimmer per pixel than the dot it came from — the shader spreads its light
       over the smear on purpose — so without this the water would appear to
       empty out at exactly the moment it should be rushing. */
    cu.uFade.value = (0.06 + 0.94*Math.min(1, Math.max(0, (bar - 10)/2.5)))
                   * (0.75 + 0.9*pulse) * (1 + 1.5*Math.pow(this.run(t), 3));
    cu.uTint.value.copy(this._c).lerp(new THREE.Color(0.45, 0.80, 0.95), 0.5);
    cu.uCam.value.copy(this.camera.position);
    cu.uSrc.value.copy(this._src);
    /* The shafts only exist in the particulate, so the beam modulation comes up
       with the shafts do. */
    cu.uBeam.value = Math.min(1, Math.max(0, (bar - 5)/6));
    /* The shutter, and the camera's own velocity through it. The motes are
       fixed in the world and the camera rises, so their images smear by exactly
       this much — round specks at the bottom of the climb where v is 6.6, long
       streaks at the break where it is 95, and every value between them without
       a single number choosing when. See buildWaterColumn(): the streak is one
       exposure, not an effect.

       And the shutter OPENS through the run-in, which is the one place this
       stops being physics and starts being a choice — so it is written down.
       Sixteen milliseconds is a true frame at sixty and gives the round specks
       the deep water should have. Through S3 it grows on the same cube the
       run-in accelerates on, to about sixty at the break: by then a mote near
       the lens draws a line a hundred pixels long and the field reads as the
       rush the note asked for. It is still tied to the speed at every instant —
       a longer exposure of a stationary camera is still a dot — so it can
       exaggerate how fast this feels but it can never invent it. */
    this._vel.set(0, v, 0);
    cu.uVel.value.copy(this._vel);
    cu.uShut.value = 0.016 + 0.110*Math.pow(this.run(t), 3);
    /* The snow is centred on the LENS, not hung under it — and this is the
       seabed's fault a second time in the same scene.

       buildWaterColumn() lays its motes from local y = -2 down to -901. Offset
       by y + 40, that put thirty-eight units of it above the camera and eight
       hundred and sixty below. This camera spends the whole shot looking UP,
       between fifty-five and seventy-eight degrees off vertical, so almost the
       entire field sat behind the frame. Measured on its own with everything
       else muted, at t = 25: nine thousand motes produced EIGHTEEN pixels
       brighter than half again the background. Nine thousand.

       And it is the middle of this shot that pays for it. Marine snow passing
       the lens is what tells you a slow move is a move at all — it is the only
       parallax available in open water, where there is nothing else at a known
       distance. Twenty-four seconds of ceiling and beams with no particulate in
       front of them is a painting, however slowly it brightens.

       Offset by y + 450 the camera sits in the middle of its own column, with
       four hundred and fifty units of it in the direction the lens is actually
       pointed. Still clamped to the surface, so no snow is ever drawn in air. */
    this.column.position.set(0, Math.min(0, y + 450), 0);

    for (const sm of this.seabed.userData.mats){
      const u = sm.uniforms;
      u.uTime.value = t;
      u.uCam.value.copy(this.camera.position);
      u.uSrc.value.copy(this._src);
      u.uMurk.value = murk;
      /* Drowned to EXACTLY the value the water's own backdrop shows looking
         down, so the floor has no edge and no moment where it starts — it is
         only ever the near part of it, fading into the same nothing the rest of
         the frame fades into. Any other value and the plane's own boundary
         draws a line across the picture. */
      u.uMurkCol.value.copy(this.murk.material.uniforms.uDown.value);
      u.uAmt.value = 4.5;
    }

    const su = this.shafts.material.uniforms;
    su.uTime.value = t;
    su.uCam.value.copy(this.camera.position);
    su.uMurk.value = murk*0.75;
    su.uCol.value.copy(this._c);
    /* Shafts fade in with the air band at bar 5 and are the loudest thing in
       the frame by the time we are close enough to see the surface. Scaled
       by the same clearness as the window's own sun glow, so a shaft never
       blazes under a ceiling that is showing solid cloud — it dims toward
       an ambient floor instead of vanishing outright, because real overcast
       water still gets SOME directionless light down, just not a beam. */
    su.uSrc.value.copy(this._src);
    su.uAmt.value = (0.8 + 5.2*Math.min(1, Math.max(0, (bar - 5)/6)))
                  * (0.55 + 0.75*near) * (1 + 1.1*pulse)
                  * (0.30 + 0.70*clear);

    /* Bubbles. They start where the kick does — the same downbeat that shows
       the particulate — and they thin out as we rise, because we are leaving
       whatever is making them. */
    const bu = this.bubbles.material.uniforms;
    bu.uTime.value = t;
    bu.uCam.value.copy(this.camera.position);
    bu.uSrc.value.copy(this._src);
    bu.uPx.value = px;
    bu.uMurk.value = murk*0.6;
    bu.uAmt.value = Math.min(1, Math.max(0, (bar - 8)/4))*(1 + 0.35*pulse);
    bu.uTint.value.copy(this._c).lerp(new THREE.Color(1, 1, 1), 0.4);
    /* Not moved. The field is fixed in the world with its top at the surface,
       so a bubble leaves the picture by bursting where the water ends and
       nowhere else — the old version followed the camera and popped out of
       existence a hundred and twenty units above it, in clear water. */

    // ---- the tunnel, arriving ----------------------------------------------
    /* One number, and everything the morph does hangs off it. Cubed, so the
       tunnel is a suggestion inside the window for most of the two bars and
       only becomes an object in the last few beats — a linear ramp here reads
       as a dissolve starting on a downbeat, which is the thing the note asked
       for the opposite of. */
    const mo = Math.min(1, Math.max(0, (t - this.tMorph)/(this.T4 - this.tMorph)));
    const morph = mo*mo*mo;
    /* The rings inside Snell's window. The membrane has always been able to
       draw these — it is how S4 shows the tunnel THROUGH the surface — and no
       scene has ever turned them on before the break. They are the first half
       of the morph: the window stops being a window onto sky and becomes the
       mouth of the thing on the other side, without anything being faded. */
    mu.uRings.value = morph;
    this.tunnel.group.visible = morph > 0.004;
    if (this.tunnel.group.visible){
      /* The accent, by S4's own formula and not by a lookalike. Hand-picking a
         second colour here would put a hue change on the cut, which is the one
         thing the morph exists to remove — measured on the first pass, the
         rings went from pale blue to pink and teal across bar 30. */
      this._cT2.copy(this._cT).getHSL(this._hslT);
      this._cT2.setHSL((this._hslT.h + 0.42) % 1,
                       Math.min(1, this._hslT.s*0.95 + 0.15),
                       Math.min(1, this._hslT.l*0.9 + 0.10));
      this.tunnel.update(t, {
        travel: this.path.travel, speed: this.path.speed(t),
        beat0: tl.origin, beat: tl.beat,
        colour: this._cT, colour2: this._cT2,
        px,
        /* Nothing below the surface: the tunnel is on the other side of it, and
           a ring drawn in the water would be a ring in the water. */
        floorY: 0,
        brightness: morph,
        /* No mist and no core until the break. Mist is a volume and this one
           is behind a surface we have not passed through; the core is S4's
           last line and belongs to it. */
        mist: 0.10*morph,
        core: 0.004,
        warp: 0
      });
    }

    // ---- grade -------------------------------------------------------------
    /* Handed to S4 at exactly the values S4 starts from, so bar 30 changes the
       picture and not the print. */
    const c = post.qComp.u, d = post.qDof.u;
        /* Two and a half stops over what S4 runs at, and it is not a cheat: the
       film's grade sits at the saturated extinction value (see extinctVoid in
       core/glsl.js), and this is the one scene lit by a single weak source six
       hundred units away rather than by a tunnel at arm's length. It comes back
       down to S4's 0.86 by the break. */
    /* And it opens closed. Four bars of an almost-black frame is the first
       thing the film says, and it only means anything if the frame is actually
       almost black — at the working stop the water's own glow is already a
       visible blue field, which is a mood, not nothing. */
    const wake = Math.min(1, Math.max(0, (bar - 1.2)/4.4));
    /* The pulses ride on the exposure and the bloom, not on the flat term —
       and the exposure is a MULTIPLIER, so a pulse here brightens the column
       and the shafts and leaves the black water black, which is what a
       brightening travelling up a water column actually looks like. */
    c.uExposure.value = (4.6 - 3.74*near)*(0.16 + 0.84*wake*wake)*(1.0 + 0.30*pulse);
    c.uBloom.value    = 0.34 + 0.16*near + 0.40*pulse;
    c.uCA.value       = 0.0016;
    c.uVignette.value = 0.96 - 0.10*near;            // -> 0.86
    c.uGrain.value    = 0.062 - 0.017*near;          // -> 0.045
    c.uLift.value.setRGB(0.002, 0.010, 0.022);
    c.uGain.value.setRGB(0.96, 0.99, 1.06);
    /* S4 opens on a burst (see s04-passage.js) that decays from its own first
       instant. Mirrored here, rising into the cut instead of falling away
       from it, the two curves meet at the same peak at the same instant --
       one continuous flash that happens to straddle a scene swap.

       It is set to genuinely whiteout, not just to match: the frames right
       before the cut are the camera grazing the surface at near-zero
       clearance, which the wave mesh cannot resolve at that distance and
       renders as a flat, undifferentiated field (see the yAt/T4 contract
       above -- the approach speed and height there are fixed and not this
       fix's to change). A quiet flash would sit next to that flat frame and
       show it off; a real one erases it, and the water breaking into light
       is the more honest reading of a cut at exactly this bar anyway. */
    /* Only the pre-burst, and nothing for the pulses.
 
       uFlash is `col += uFlash` in the composite: a constant added to every
       pixel in linear light, before the exposure and before the 1/2.2 gamma,
       so the gamma pulls the bottom of its range wide open — 0.16 is a 0.53
       grey over the WHOLE frame. See s10-third-passage.js for the measurement
       that found this across five scenes. On a shot whose whole first minute
       is 'an almost-black frame', a pulse that lasts 1.6 seconds cannot be
       that term. The burst can, and only the burst is: it is set to genuinely
       whiteout for the reason above, and erasing the frame is its job. */
    const preBurst = Math.exp(-Math.max(0, this.T4 - t)*16.0);
    c.uFlash.value    = 1.2*preBurst;

    d.uStart.value = 90; d.uEnd.value = 520; d.uMaxRadius.value = 2.4;
  }

  /** Named handles for the preview's isolation keys. */
  debugLayers(){
    return { murk:this.murk, seabed:this.seabed, shafts:this.shafts, column:this.column,
             bubbles:this.bubbles, membrane:this.membrane };
  }

  dispose(){
    for (const o of [this.murk, this.shafts, this.column, this.bubbles, this.membrane]){
      o.geometry.dispose(); o.material.dispose();
    }
    this.seabed.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
}
