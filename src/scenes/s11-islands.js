import * as THREE from 'three';
import { Tunnel, layTunnelAlong } from '../env/tunnel.js';
import { THIRD_TUNNEL, THIRD_CZ, thirdPath } from './s10-third-passage.js';
import { Islands } from '../env/islands.js';

/* S11 — Floating islands.  Bars 94–112.
 *
 * Nineteen bars, the longest run in one place after the jungle, and three
 * shots that are one continuous descent-then-rise. The shot list gives each a
 * camera and they are all the same camera doing different parts of one move:
 *
 *   94-99   'Islands'.       Wide, drifting between two of them.
 *   100-104 'Falling water'. Descending alongside a fall.
 *   105-112 'Roots'.         Rising through the roots, looking up.
 *
 * So the height curve is the scene. It starts high and level, drops through
 * the middle shot faster than the water does, bottoms out under the islands,
 * and climbs back through the root canopy with the pitch tipping up. Written
 * as one closed-form function of t rather than three, because the joins have
 * to be smooth in position AND in velocity — a camera that changes speed on a
 * bar line reads as an edit, and the shot list calls this 'the longest
 * continuous shot in the film'.
 *
 * Three cues, all measured, none of them a cut:
 *   'Everybody!' 95.56 — one island's atmosphere lights from within.
 *   'Go!' 103.80 — off the grid by design; 'let the water carry it'.
 *   'Woo!' 107.99 — on a downbeat, in the roots.
 */

export class IslandsScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S11') || { t: tl.timeOfBar(94), tEnd: tl.timeOfBar(113) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tFall = tl.timeOfBar(100);
    this.tRoot = tl.timeOfBar(105);

    this.scene = new THREE.Scene();
    /* Far enough to hold the star dome and the aurora shell; near plane tight
       because the roots pass very close on the way up. */
    this.camera = new THREE.PerspectiveCamera(58, 16/9, 0.5, 12000);
    this.islands = new Islands();
    this.scene.add(this.islands.group);

    /* THE CORRIDOR IS STILL HERE for the first two bars, and the islands come
     * into focus out of it.
     *
     * 'Tunnelin päästä voisi tulla blurrantuneena tämä saarekkeiden avaruus
     * johon tarkennetaan fokus — kamera heiluu vähän ennen kuin saarekekohtaus
     * alkaa.'
     *
     * The three morphs before this one all run forwards: a scene draws the
     * NEXT scene's tunnel early. This one is the same idea backwards, and it
     * has to be, because what the note asks for is the destination arriving
     * out of the corridor rather than the corridor arriving out of the world.
     * So S11 keeps drawing S10's OWN tunnel (THIRD_TUNNEL, on thirdPath
     * evaluated PAST its own T1 where it runs on out of the scene, in the
     * colour S10 is wearing at the cut) and lets it recede and go out, while
     * the islands rack in behind it.
     *
     * The rack is the whole point and it is done with the defocus this film
     * already has rather than with a fade: at the cut the field is a wall of
     * unresolved light with a corridor still around it, and over two bars the
     * near plane comes in and the radius drops until the islands are the
     * picture. A fade would say 'here is a different shot'; a rack says 'this
     * was always what you were looking at'. */
    this.tunnel = new Tunnel(THIRD_TUNNEL);
    this.tunnel.group.visible = false;
    this.scene.add(this.tunnel.group);
    this.tpath  = thirdPath(tl);
    this.tRack  = this.T0 + 2*tl.barSec;
    this._cT    = new THREE.Color(...THIRD_CZ);
    this._cT2   = new THREE.Color();
    this._hslT  = { h: 0, s: 0, l: 0 };
    this._fwd   = new THREE.Vector3();

    /* The three islands this move visits, in the order it reaches them.
       Chosen once, by size and by depth into the field, rather than by a
       nearest-to-camera lookup — a lookup could pick differently if the path
       ever moves, and this shot is the same shot every render. */
    const byZ = this.islands.isl.slice().sort((a, b) => b.z - a.z);
    const big = byZ.filter(o => o.rad > 200);
    this.subjects = (big.length >= 3 ? big : byZ).slice(0, 3);

    /* The highest ground in the field. The camera is kept above it, which is
       the only reliable way to keep the undersides out of frame: being above
       the SUBJECT does nothing about an island that happens to float higher
       than the subject does, and that is what put a keel across the top of the
       frame twice in the last pass. */
    this.fieldTop = this.islands.isl.reduce((m, o) => Math.max(m, o.y + o.rad*0.16), -1e9);

    const cues = (tl.d.lyrics || []).filter(c => c.t >= this.T0 && c.t < this.T1);
    const find = (re, fallbackBar) => {
      const c = cues.find(x => re.test(x.text || ''));
      return c ? c.t : tl.timeOfBar(fallbackBar);
    };
    this.tEvery = find(/everybody/i, 95.56);
    this.tGo    = find(/^go/i, 103.80);
    this.tWoo   = find(/woo/i, 107.99);

    /* Which island lights on 'Everybody!'. Fixed rather than nearest-to-camera
       so it is the same island every render — a choice made once, not a
       lookup that could pick differently if the path ever moves. */
    this.litIsland = this.islands.isl.indexOf(this.subjects[1]);

    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();

    /* THE WATERFALL RUN — a vantage that is a MOVE and not an instant.
     *
     * 'Myos saarekkeista eri kuvakulmia, voisi esim. olla vesiputousta kohti
     * niin etta vesiputouksen alta noustaan ja kiihdytetaan nopeasti jokea
     * pitkin jarvelle.'
     *
     * Every other vantage in worlds.js is a TIME: a moment on a camera move
     * this scene already makes. This one cannot be, because the move it asks
     * for is not in the scene — the shot list never puts the camera under a
     * fall and never runs it up a river. So it is authored here, as a curve,
     * and worlds.js addresses it the same way it addresses the instants.
     *
     * It is anchored on the water's OWN numbers and not on numbers that
     * resemble them. env/islands.js decides, once, where the lake sits
     * (`lc`, `level`), where the stream leaves the plateau (`lip`, `lipY`,
     * `lipT`), which way the channel runs and how it meanders (`dir`, `bend`
     * — the same closed form the carve and the ribbon both read), and how far
     * out the falling water hangs clear of the rock (`outR`, which is the
     * widest bulge under that azimuth plus two ribbon widths). A camera move
     * that measured any of those a second time would disagree with the water
     * it is photographing, which is the recurring shape of every bug in that
     * file.
     *
     * Five anchors, all of them in those terms:
     *   A0  outside and below the fall, looking up at it
     *   A1  risen past the crest, still clear of the rim
     *   A2  over the lip
     *   A3  down the channel, over the stream
     *   A4  over the lake
     * A0 to A1 is the rise; A1 to A2 crosses the rim, and it does that ABOVE
     * lip height on purpose, because the rock is widest just under it.
     */
    this.fallC = null;
    for (const C of this.islands.courses){
      if (!this.fallC || C.o.rad > this.fallC.o.rad) this.fallC = C;
    }
    this._fall = this.fallC ? this._fallCurve(this.fallC) : null;
    this._fp = new THREE.Vector3();
  }

  /** The curve, built once. */
  _fallCurve(C){
    const o = C.o, R = o.rad, L = C.len;
    const lipY = (C.lipY !== undefined ? C.lipY : C.lip[1]);
    const dx = C.dir[0], dz = C.dir[1], px = -dz, pz = dx;
    /* The meander, written the same way the carve and the ribbon write it. */
    const bendAt = t => C.bend*R*Math.sin(Math.min(1, t/(1.05*R))*Math.PI);
    const chan = (t) => {
      const b = bendAt(t);
      return [C.lc[0] + dx*t + px*b, C.lc[2] + dz*t + pz*b];
    };
    const out = (r) => [o.x + C.outDir[0]*r, o.z + C.outDir[1]*r];
    const a0 = out(C.outR + L*0.34), a1 = out(C.outR + L*0.20), a2 = out(C.lipR*0.99);
    /* A4 stops on the near half of the lake rather than at its centre. At the
       centre, an eleventh of a radius above the surface, the water is all below
       the frame and the shot ends on the far bank — which is a shot of grass.
       It stops at the MOUTH instead, where the river leaves: the lake is then
       the whole of what is ahead, and arriving at the lake is what the shot is
       for. */
    const a3 = chan(C.lipT*0.55),    a4 = chan(C.lakeR*R*1.02);
    const pts = [
      new THREE.Vector3(a0[0], lipY - L*0.62, a0[1]),
      new THREE.Vector3(a1[0], lipY + R*0.04, a1[1]),
      new THREE.Vector3(a2[0], lipY + R*0.11, a2[1]),
      new THREE.Vector3(a3[0], C.level + (lipY - C.level)*0.55 + R*0.10, a3[1]),
      new THREE.Vector3(a4[0], C.level + R*0.13, a4[1])
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    /* getPointAt() is arc-length parameterised, which is the whole reason to
       use a curve object here: the rise is three times the length of the run,
       so a parameter uniform in SEGMENTS would have spent most of the shot
       climbing and crossed the lake in a frame. */
    /* The tail is FLATTENED before it is used to aim past the end of the curve.
       The last segment descends onto the lake, so continuing it points the lens
       at the water a few metres ahead; the shot is supposed to arrive over the
       lake and see it, which means looking across it. */
    const tail = curve.getPointAt(1).clone().sub(curve.getPointAt(0.94));
    tail.y = Math.abs(tail.y)*0.15;
    tail.normalize();
    /* Where the shot ends up looking: the lake's FAR BANK, which is a real
       place on this island and not a direction. Aiming along the path instead
       put the lens level, and level from an eighth of a radius above a lake
       half a radius across means the water lies fifteen to twenty-seven
       degrees below the axis — outside the bottom of a fifty-eight degree
       frame. The shot arrives at the lake and has to be able to see it. */
    const fp = chan(-C.lakeR*R*0.95);
    const far = new THREE.Vector3(fp[0], C.level, fp[1]);
    return { C, curve, tail, far, crest: new THREE.Vector3(C.lip[0], lipY, C.lip[2]), R };
  }

  /** Where the camera is and what it is looking at, u = 0..1 across the shot.
   *
   *  Speed: 0.16*u + 0.84*u^2 of the arc length, ten times faster over the lake
   *  than under the fall, and non-zero at u = 0 because a shot that starts from
   *  a dead stop reads as a still that then begins. The rise is deliberately
   *  the slow half and the river the fast one — that is the note — but the
   *  first draft spent 72 % of the shot climbing, so the climb is also shorter
   *  in space now: it starts six tenths of a fall-length below the crest
   *  rather than nine.
   *
   *  Aim: the CREST while the camera is climbing, and a point a little ahead
   *  on its own path once it is over the lip. It cannot be the lead point
   *  during the rise — the rise is very nearly vertical, so a point ahead on
   *  the path is a point overhead, and a lookAt() straight up the world's own
   *  up vector has no answer. The blend is finished well before the camera
   *  reaches the lip, because the crest aim degenerates there for the mirror
   *  reason: the thing being looked at is where the lens is.
   */
  fallShot(u, pos, tgt){
    const F = this._fall;
    const uu = Math.min(1, Math.max(0, u));
    const g = Math.min(1, 0.16*uu + 0.84*uu*uu);
    pos.copy(F.curve.getPointAt(g));

    const ga = g + 0.16;
    if (ga <= 1) tgt.copy(F.curve.getPointAt(ga));
    else tgt.copy(F.curve.getPointAt(1)).addScaledVector(F.tail, (ga - 1)*F.R*2.2);

    /* The window is 0.40 to 0.56 of the arc, and both ends of it are measured
       rather than chosen. The rise ends at about 0.53, so below 0.40 the lead
       point is still ON the rise — which is to say directly overhead, and a
       camera aimed overhead photographs the nebula while the waterfall it was
       following leaves the bottom of the frame. That was the fault: two of six
       probe frames were empty sky. And the window has to CLOSE before 0.6,
       because past that the camera is over the lip and the crest it would be
       aiming at is where the lens is. Between the two the aim swings from
       looking up at the crest to looking down the channel, which is the crest
       of the fall being reached and the river being revealed — the one moment
       this shot exists for. */
    const look = Math.min(1, Math.max(0, (g - 0.40)/0.16));
    const lk = look*look*(3 - 2*look);
    tgt.lerpVectors(F.crest, tgt, lk);
    /* And over the last fifth the aim settles onto the far bank. */
    const land = Math.min(1, Math.max(0, (g - 0.80)/0.20));
    tgt.lerp(F.far, land*land*(3 - 2*land));
  }

  /** The whole camera move, as one function of time.
   *
   * A continuous orbit that walks from one island to the next, and it answers
   * three notes at once.
   *
   *   'Paneroi leijuvat kappaleet niin että taustalla näkyy muutkin
   *   kappaleet, nyt katsotaan vain yhtä.' A camera locked to one subject
   *   shows one subject. Orbiting a subject that MOVES through the field means
   *   whatever is behind it is always something else, and it changes.
   *
   *   'Jos muuten on niin vaikeaa niin voitaisiin vaan kiertää kappaleiden
   *   ympäri niin että tulee lähikuvaa.' It is not difficult, and it is also
   *   better: the orbit radius breathes, so the shot arrives close on each
   *   island in turn and pulls out between them.
   *
   *   'Ei näytetä alaosia, koska niissä olevat yksityiskohdat eivät tällä
   *   hetkellä ole kovin realistisia.' So the camera never goes below the
   *   plateau. It sits above it and looks slightly DOWN, which hides the keels
   *   behind the islands' own rims — the strongest way to not show something
   *   is to be on the wrong side of it, not to point away from it.
   *
   * The previous version's descent under the keel is gone with them. What is
   * kept from it is the reason it existed: the path is anchored to a subject
   * and written in that subject's radius, so it cannot wander off into empty
   * space the way the version before THAT did.
   */
  path(t, out){
    const S = this.subject(t);
    /* One continuous swing. The rate is irrational against the walk between
       subjects, so the camera never arrives at the same bearing on two of
       them. */
    const u = t - this.T0;
    const th = 0.7 + u*0.115;
    /* Distance breathes between a close pass and a wide one, on its own
       slower cycle — this is where the close-ups come from. */
    const near = 0.5 - 0.5*Math.cos(u*0.242);
    const rho = S.rad*(3.30 - 1.85*near);
    /* Always above the plateau. Enough above to see across the top of the
       island and hide its underside behind its own rim. */
    const h = S.rad*(0.72 + 0.34*near + 0.12*Math.sin(u*0.19));
    const y = Math.max(S.y + h, this.fieldTop + S.rad*0.34);
    return out.set(S.x + Math.sin(th)*rho, y, S.z + Math.cos(th)*rho);
  }

  /** The subject at time t: a walk through this.subjects, eased, so the orbit
      centre drifts from one island to the next rather than cutting. */
  subject(t){
    const p = Math.min(0.999, Math.max(0, (t - this.T0)/(this.T1 - this.T0)))*(this.subjects.length - 1);
    const i = Math.floor(p);
    const f = p - i;
    const e = f*f*(3 - 2*f);
    const a = this.subjects[i], b = this.subjects[Math.min(i + 1, this.subjects.length - 1)];
    return { x: a.x + (b.x - a.x)*e, y: a.y + (b.y - a.y)*e,
             z: a.z + (b.z - a.z)*e, rad: a.rad + (b.rad - a.rad)*e };
  }

  /** Where it is looking: the subject's plateau, a little below the camera, so
      the frame is the island and whatever the field puts behind it. */
  aim(t, out){
    const S = this.subject(t);
    return out.set(S.x, S.y + S.rad*0.10, S.z);
  }

  update(t, post, shot){
    const u = Math.max(0, t - this.T0);
    const b = Math.min(1, Math.max(0, (t - this.tFall)/(this.tRoot - this.tFall)));
    const c = Math.min(1, Math.max(0, (t - this.tRoot)/(this.T1 - this.tRoot)));
    const eb = b*b*(3 - 2*b), ec = c*c*(3 - 2*c);

    // ---- camera --------------------------------------------------------------
    const rack = Math.min(1, Math.max(0, (t - this.T0)/(this.tRack - this.T0)));
    if (shot && shot.cam === 'fall' && this._fall){
      /* A caller that wants the waterfall run gets it INSTEAD of the shot
         list's own move, and gets everything else — the water, the light, the
         grade, the island that is lit — exactly as it is at the instant it
         asked for. The corridor and the rack below are past their window at
         any time this vantage is sampled from, so they need no case here. */
      this.fallShot(shot.u, this._pos, this._tgt);
    } else {
      this.path(t, this._pos);
      this.aim(t, this._tgt);
      /* And the camera is unsteady for the first two bars — 'kamera heiluu vähän
         ennen kuin saarekekohtaus alkaa'. Two incommensurable rates so it never
         repeats inside the shot, dying as the rack completes, and applied to the
         AIM rather than to the position: a hand that has not settled turns, it
         does not slide. */
      const settle = 1 - rack*rack*(3 - 2*rack);
      if (settle > 0.001){
        const s1 = settle*0.030;
        this._tgt.x += Math.sin(u*2.13 + 0.6)*s1*Math.abs(this._tgt.x - this._pos.x || 1)
                     + Math.sin(u*1.31)*s1*40;
        this._tgt.y += (Math.sin(u*1.77 + 1.9)*0.6 + Math.sin(u*2.61)*0.4)*settle*26;
      }
    }
    this.camera.position.copy(this._pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._tgt);

    // ---- the corridor, going out ---------------------------------------------
    /* Squared rather than cubed: the forward morphs want the arriving object to
       stay a suggestion until the last beats, and this one wants the opposite —
       the corridor is fully there at the cut and has to leave. */
    /* On its OWN window, one bar, not the rack's two. The corridor is made of
       rings that arrive periodically, so a slow tail does not fade it away - it
       fades each ring while the next one arrives, and a ring that reappears
       three quarters of the way through the rack reads as a fault. One bar puts
       the last ring behind the camera before the next would have been drawn. */
    const leave = 1 - Math.min(1, Math.max(0, (t - this.T0)/this.tl.barSec));
    const tun = leave*leave*leave;
    this.tunnel.group.visible = tun > 0.004;
    if (this.tunnel.group.visible){
      const T = this.tpath.travel(t);
      this._fwd.subVectors(this._tgt, this._pos).normalize();
      layTunnelAlong(this.tunnel.group, this._pos, this._fwd, T);
      this._cT2.copy(this._cT).getHSL(this._hslT);
      this._cT2.setHSL((this._hslT.h + 0.42) % 1,
                       Math.min(1, this._hslT.s*0.95 + 0.15),
                       Math.min(1, this._hslT.l*0.9 + 0.10));
      this.tunnel.update(t, {
        travel: this.tpath.travel, speed: this.tpath.speed(t),
        beat0: this.tl.origin, beat: this.tl.beat,
        colour: this._cT, colour2: this._cT2,
        px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
        floorY: -1e9,
        brightness: tun,
        mist: 0.30*tun,
        core: 0.010,
        warp: 0.30*tun
      });
    }

    // ---- the world -----------------------------------------------------------
    /* 'Everybody!' — one island's atmosphere lights from within. A short rise
       and a long fall: the shell should flare and then be left glowing for a
       beat, not blink. */
    const dEvery = t - this.tEvery;
    const lit = dEvery < 0
      ? Math.exp(-dEvery*dEvery*26.0)
      : Math.exp(-dEvery*1.15);
    this.islands.update(t, { camera: this.camera, lit, which: this.litIsland });

    // ---- grade ---------------------------------------------------------------
    const cu = post.qComp.u, d = post.qDof.u;
    /* 'Go!' at 103.80 is deliberately off the grid and the shot list says to
       let the water carry it — so it gets no cut and no flash, only a small
       lift in the bloom while the fall is on screen. */
    /* Causal — see Timeline.hit(). A softer attack than a flash gets: these
       are swells under a held note, not impacts, and a two-frame onset on a
       bloom lift is a click. */
    const go = this.tl.hit(t, this.tGo, 2.2, 0.07)*(1 - ec);
    const woo = this.tl.hit(t, this.tWoo, 3.0, 0.07)*ec;

    /* 'Everybody!' is a flare, not a lift, and the flat term goes to zero. uFlash is `col += uFlash` in the
       composite — a constant added to every pixel in linear light, before the
       exposure and before the 1/2.2 gamma, so the gamma pulls the bottom of
       its range wide open and it has no gentle setting on a dark frame:
       0.10 comes out as a 0.41 grey over the WHOLE picture, 0.16 as 0.53,
       0.30 as 0.70. See s10-third-passage.js for the measurement that found
       this and the arithmetic that predicts it.

       Here it was 0.10*lit, and `lit` falls as exp(-dt*1.15) — so the flat
       grey was 0.39 at the shout and still 0.15 a second and a half later.
       Measured: this scene's black floor is 0.067 and the shout took it to
       0.387. Two seconds of the film's most worked-on world behind a white
       fog, and the shout has a real source in the frame the whole time —
       islands.update() is lighting one island's atmosphere from inside with
       this very number. So the light is spent there, on the exposure and on
       the bloom, both of which can only brighten a pixel that already has
       something in it. */
    cu.uExposure.value = 1.02 - 0.10*ec + 0.26*lit;
    cu.uBloom.value    = 0.30 + 0.50*lit + 0.14*go + 0.12*woo;
    cu.uCA.value       = 0.0012;
    /* Light: this world is mostly empty space and a heavy vignette would make
       it a tunnel. */
    cu.uVignette.value = 0.44 + 0.14*ec;
    cu.uGrain.value    = 0.030;
    cu.uLift.value.setRGB(0.004, 0.008, 0.014);
    cu.uGain.value.setRGB(0.96, 1.00, 1.06);
    cu.uFlash.value    = 0.0;

    /* Deep through the wide shot, shallow in the roots where things pass
       within metres of the lens. */
    /* The rack. At the cut the near plane is right on the lens and the radius
       is wide, so the whole field is unresolved light; over two bars both come
       back to the values this scene has always used. Interpolated on the same
       eased `rack` the camera settles on, so the picture arriving and the hand
       steadying are one event and not two. */
    const rk = rack*rack*(3 - 2*rack);
    /* The near plane is held out at the CORRIDOR'S radius rather than on the
       lens. Put it at 2 and everything past two units softens, the tunnel
       rings included - and a rack that dissolves the object it is supposed to
       be racking away FROM is a dissolve. Sixty units keeps the rings that are
       still around the camera hard while the field beyond them is light. */
    d.uStart.value = (320 - 260*ec)*rk + 60*(1 - rk);
    d.uEnd.value   = (5200 - 4200*ec)*rk + 300*(1 - rk);
    d.uMaxRadius.value = (1.2 + 1.8*ec)*rk + 26.0*(1 - rk);
    /* And the sky racks with the world. The field behind these islands is a
       nebula and several thousand stars, all of it drawn on the dome, which the
       defocus pass exempts by default; leaving it sharp would have left the
       frame legible through the whole rack and made the softness read as a
       glow on the islands rather than as an unresolved picture. Measured at
       26 px against a 1080-line frame: 7.5 was a haze. */
    d.uSkyDefocus.value = 1 - rk;
  }

  debugLayers(){ return this.islands.debugLayers(); }

  dispose(){ this.islands.dispose(); }
}
