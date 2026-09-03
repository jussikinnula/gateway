import * as THREE from 'three';
import { Jungle } from '../env/jungle.js';
import { Tunnel, layTunnelAlong } from '../env/tunnel.js';
import { SECOND_TUNNEL, SECOND_C0, secondPath } from './s06-second-passage.js';

/* S5 — Jungle.  Bars 44–62.
 *
 * The first arrival, and the longest run in one place. Four shots, and the
 * scene's job is to be beautiful for two of them and then to stop being
 * convincing: the Build starts at bar 54 and the light begins coming from the
 * wrong direction, and by bar 58 the colour is draining toward the tunnel's.
 *
 * All four boundaries come out of timeline.json.
 */
export class JungleScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S5') || { t: tl.timeOfBar(44), tEnd: tl.timeOfBar(62) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.shots = (tl.d.shots || []).filter(s => s.sceneId === 'S5');

    /* Travel. A jungle is not a tunnel: the speed is a walk, and it eases
       rather than accelerating, so the picture has time to be looked at. */
    const V = 11.5;
    this.travel = (t) => V*(t - this.T0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 16/9, 0.1, 2200);
    this.jungle = new Jungle();
    this.scene.add(this.jungle.group);

    /* THE TUNNEL, two bars early, and it is S6's OWN tunnel.
     *
     * 'Metsän lopussa ilma alkaa säröilemään ja väreilemään ja vääristymään,
     * joka morfautuu seuraavaan tunneliin.'
     *
     * S6's own header already says this is what happens — 'the first gateway
     * had a threshold... this one does not. There is no water here: the jungle
     * simply stops holding together and the tunnel is what is left' — and then
     * the film cut, and nothing stopped holding together at all. This is that
     * sentence, made visible.
     *
     * Same build, same path, same colour as S6 (SECOND_TUNNEL / secondPath /
     * SECOND_C0), so at bar 62 nothing about the object changes and the cut
     * lands underneath something continuous. The path is evaluated at t < its
     * own T0, where it runs backwards out of the scene — which is what the
     * water does for the first passage and the same reason it works.
     *
     * It is drawn ADDITIVELY into a jungle that is already draining to
     * near-black, which is what makes it a morph rather than a dissolve:
     * nothing of the forest is taken away to pay for it. The rings arrive as
     * light appearing between the trunks. */
    this.tunnel = new Tunnel(SECOND_TUNNEL);
    this.tunnel.group.visible = false;
    this.scene.add(this.tunnel.group);
    this.path    = secondPath(tl);
    this.tMorph  = this.T1 - 2*tl.barSec;
    this._cT     = new THREE.Color(...SECOND_C0);
    this._cT2    = new THREE.Color();
    this._hslT   = { h: 0, s: 0, l: 0 };

    this._sun = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
  }

  /** 0..1 through a shot, given its bar bounds */
  _k(t, bar, end){
    const a = this.tl.timeOfBar(bar), b = this.tl.timeOfBar(end);
    return Math.min(1, Math.max(0, (t - a)/(b - a)));
  }

  update(t, post){
    const tl = this.tl;
    const bar = tl.bar(t);
    const f = this.travel(t);

    /* ---- camera ---------------------------------------------------------- */
    /* Low and looking slightly up for the arrival, rising through the canopy in
       the second shot, and after the Build it stops tracking anything. */
    /* The eye line is the horizon, not the canopy. Looking up puts the frame
       into leaves and the shot has nowhere to go; looking level puts the
       vanishing point in it, and the branches crossing the path do the work of
       saying how fast we are moving and how deep the jungle is. */
    /* The rise stops inside the canopy, not above it: the top of a canopy is
       lumpy foliage and this one is a displaced plane, so from above it reads as
       a flooded plain with poles through it. Rising INTO it and looking up at
       the gaps gives the middle of the scene the bright thing it was missing
       and never shows the side that does not hold up.

       The rise looks DOWN, not up: it goes up the cleared shaft over the
       walkway, and the thing worth seeing from up there is the walkway and the
       torches on it getting smaller — not the underside of the leaves the
       camera would otherwise be flying through.

       On the walkway, not above it. The deck is the shot: it is the only
       straight line in the frame and it points at the light, and from a metre
       and a half above it the planks stream under the camera and measure the
       speed. Rising off it in the second shot is then a move that means
       something, because it leaves something behind. */
    let y, pitch;
    if (bar < 50){                       // arrival
      const k = this._k(t, 44, 50);
      y = 2.55 + 0.22*k; pitch = -0.010 + 0.02*k;
    } else if (bar < 54){                // canopy
      const k = this._k(t, 50, 54);
      const e = k*k*(3 - 2*k);
      /* Fifteen metres, not thirty. The rise is meant to leave the deck behind
         and look back down at it — 'the walkway and the torches on it getting
         smaller' — and at thirty the walkway is four pixels wide, the torches
         are two, and the canopy between camera and subject closes over most of
         it. Measured, the middle of this scene sat at a standard deviation of
         6 out of 255 where its opening is at 23: a third of the scene with
         nothing in the frame to look at. At fifteen the deck is still a line
         with lights on it, which is the shot. */
      y = 2.77 + 13.0*e; pitch = 0.01 - 0.52*e;
    } else if (bar < 58){                // wrong light
      const k = this._k(t, 54, 58);
      y = 15.8 - 4.4*k; pitch = -0.51 + 0.42*k;
    } else {                             // losing it
      const k = this._k(t, 58, 62);
      y = 11.4 - 7.6*k; pitch = -0.09 + 0.06*k;
    }
    /* Barely any lateral drift ON THE DECK: down there the walkway has to stay
       on the centre line or the leading line stops leading anywhere.
     *
     * OFF the deck it is the opposite, and that is the middle of this scene.
     * Measured at two frames a second across the whole shot, the standard
     * deviation of the picture is 22 out of 255 at the arrival and 9.3 to 10.4
     * for the twelve seconds the camera spends up in the canopy — the flattest
     * and darkest stretch of the scene by a factor of two. Part of that is
     * tone, handled in the grade below; part of it is that from fifteen metres
     * up, looking straight down a walkway that runs dead down the centre line,
     * the frame is bilaterally symmetric: ferns mirrored either side of a
     * vertical stripe. A symmetric frame has half as much information in it as
     * it looks like it has, which is exactly what a standard deviation
     * measures.
     *
     * So the camera steps off the centre line as it rises, and keeps aiming at
     * the deck. The walkway then runs DIAGONALLY out of the bottom corner to
     * the vanishing point instead of straight down the middle, which is the
     * same view of the same thing with a composition in it. The offset swings
     * slowly, so the diagonal is not fixed either. All of it is gated by how
     * high the camera is, so the two deck shots are untouched. */
    const high = Math.min(1, Math.max(0, (y - 4)/11));
    const drift = Math.sin(bar*0.11)*0.16;
    const lat = high*(6.2 + 3.4*Math.sin(bar*0.205 + 0.6));
    this._pos.set(drift + lat, y, -f);
    this.camera.position.copy(this._pos);
    /* Aimed at the deck, not straight ahead — the target keeps its old
       near-centre x, so stepping sideways turns the camera onto the walkway
       rather than away from it. */
    this._tgt.set(drift*0.3 + Math.sin(bar*0.09)*0.5,
                  y + Math.sin(pitch)*24,
                  -f - Math.cos(pitch)*24);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._tgt);

    /* ---- light ----------------------------------------------------------- */
    /* Until bar 54 the sun is where a sun is. After it, it walks — not fast
       enough to be caught doing it, far enough that by bar 58 the shadows are
       impossible and the eye knows before the viewer does. */
    const wrong = Math.min(1, Math.max(0, (bar - 54)/6));
    const az = -0.42 + wrong*2.6;
    const el = 0.86 - wrong*0.62;
    this._sun.set(Math.sin(az)*Math.sqrt(Math.max(0, 1 - el*el)), el,
                  Math.cos(az)*Math.sqrt(Math.max(0, 1 - el*el))*-1).normalize();

    const drain = Math.min(1, Math.max(0, (bar - 58)/4.4));

    this.jungle.update(t, {
      camF: f, camPos: this._pos, drain,
      px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
      shaftAmt: 1.0 - 0.55*wrong,
      rain: 1.0 - 0.55*drain,
      /* Thinner air the higher the camera gets. The canopy shot climbs to
         twenty-five metres and looks back down at the walkway, and at one
         density for the whole world that view is a flat green wall with two
         orange specks in it — measured, the middle of this scene had a
         standard deviation of 6 out of 255 against 23 at its start. Mist in a
         wet forest lies in the bottom few metres; above it you can see. */
      fog: 1 - 0.62*Math.min(1, Math.max(0, (y - 5)/16)),
      sun: this._sun
    });

    // ---- the air coming apart, and the tunnel arriving ---------------------
    /* One number. Cubed, so for most of the two bars this is a suggestion and
       only in the last few beats does it become the picture — a linear ramp
       here reads as a dissolve that started on a downbeat, which is the thing
       the note asks for the opposite of. */
    const mo = Math.min(1, Math.max(0, (t - this.tMorph)/(this.T1 - this.tMorph)));
    const morph = mo*mo*mo;

    /* Gated on mo and not on its cube: the cube does not clear 0.004 until mo
       is past 0.16, and by then the sweep has already come a third of the way
       in — which is exactly the far end of the corridor, the part that is
       supposed to arrive first. */
    this.tunnel.group.visible = mo > 0.02;
    if (this.tunnel.group.visible){
      /* THE TUNNEL IS LAID ALONG THE LENS, and this is a real bug fixed.
 
         Tunnel builds its rings around the world Y axis and hands the camera's
         position along it as travel(t) — a vertical shaft, because every scene
         that has ever used it flies straight up. The first passage's morph got
         that for free: the water camera is looking up, so the shaft was already
         in front of it. This one is not. The jungle camera sits at head height
         and looks horizontally down a boardwalk, so the first attempt drew a
         perfectly good tunnel standing in the ground beneath the ferns, out of
         frame, and the picture came back with a fisheye bend and nothing in it.
 
         layTunnelAlong() in env/tunnel.js is the fix, written once there
         because the volcanic scene needs exactly the same thing and two
         spellings of one idea is how this project has repeatedly ended up with
         two answers that disagree. */
      const T = this.path.travel(t);
      this._fwd.subVectors(this._tgt, this._pos).normalize();
      layTunnelAlong(this.tunnel.group, this._pos, this._fwd, T);
      /* The accent by S6's own formula, not a lookalike: hand-picking a second
         colour here would put a hue change on the cut, which is the one thing
         the morph exists to remove. */
      this._cT2.copy(this._cT).getHSL(this._hslT);
      this._cT2.setHSL((this._hslT.h + 0.42) % 1,
                       Math.min(1, this._hslT.s*0.95 + 0.15),
                       Math.min(1, this._hslT.l*0.9 + 0.10));
      this.tunnel.update(t, {
        travel: this.path.travel, speed: this.path.speed(t),
        beat0: tl.origin, beat: tl.beat,
        colour: this._cT, colour2: this._cT2,
        px: 0.5*post.dofTarget.height/Math.tan(this.camera.fov*Math.PI/360),
        floorY: -1e9,
        /* Brightness on a gentler curve than the cube, because the sweep
           below is now what makes the corridor arrive and the cube was doing
           that job badly — the rings furthest away have to be VISIBLE early or
           there is nothing at the vanishing point to shimmer. */
        brightness: Math.pow(mo, 1.4),
        /* And it arrives from the vanishing point backwards. The range is set
           by what the corridor can actually be SEEN at, not by how far its
           rings are built: both the arcs and the streaks fall off as
           1/(1 + ahead*0.006), so past about five hundred units there is
           nothing left to hide. A first attempt swept from 6200 — beyond the
           far end of the visible corridor — which meant the sweep did nothing
           for most of its travel and then uncovered everything at once, which
           is the abruptness it was meant to fix. 520 down to -30, so the
           corridor is uncovered from the vanishing point to behind the lens
           across the whole two bars. */
        from: 520*Math.pow(1 - mo, 1.5) - 30,
        /* No mist and no core. Mist is a volume and this one is not in the
           jungle's air; the core is S6's own exit and belongs to it. */
        mist: 0.08*morph,
        core: 0.004,
        /* And the rings jag, which is the 'säröilee' half of the note. This is
           the tunnel parameter S15 uses for a corridor that is coming apart —
           the same word, spent here on one that has not finished arriving. */
        warp: 0.55*morph
      });
    }

    /* ---- grade ----------------------------------------------------------- */
    const c = post.qComp.u, d = post.qDof.u;
    /* The arrival is blown out for half a bar and then the eye adjusts. A fixed
       curve, not an auto-exposure: it has to be the same in every render. */
    const adapt = Math.min(1, Math.max(0, (t - this.T0)/1.5));
    /* And the canopy shot gets its contrast back.
       Up there the light comes from above through the leaves and everything the
       camera can see is the shaded side of it, so the picture is not merely
       darker, it is compressed — nine units of standard deviation against
       twenty-two on the deck. A little more exposure and a LOWER lift is the
       cheap half of the answer: the lift is what was holding the blacks off
       zero, and on a frame with no highlight in it a raised black is the whole
       range. */
    c.uExposure.value = (1.55 - 0.62*(adapt*adapt)) * (1 - 0.10*drain) * (1 + 0.26*high);
    c.uBloom.value    = 0.88 + 0.55*(1 - adapt) + 0.30*drain;
    c.uCA.value       = 0.0022 + 0.0030*drain;
    c.uVignette.value = 0.74 + 0.16*drain;
    c.uGrain.value    = 0.030;
    c.uLift.value.setRGB(0.004*(1 - 0.7*high), 0.016*(1 - 0.7*high), 0.010*(1 - 0.7*high));
    c.uGain.value.setRGB(0.98 - 0.06*drain, 1.05 - 0.03*drain, 0.94 + 0.14*drain);
    c.uFlash.value = 0.55*(1 - Math.min(1, (t - this.T0)/0.55));
    /* And the frame itself bends as the tunnel arrives. uFish is the lens the
       film already uses for a threshold — S13's blink is built on it — so
       spending it here ties the two transitions to one idea rather than
       inventing a second. Small: a third of what S13 opens to, because that
       one is the whole scene and this one is two bars of a jungle giving up.
       The chromatic split rises with it, which is the compositor's own way of
       saying the picture is failing to register rather than that there is
       glass in front of it. */
    c.uFish.value  = 0.42*morph;
    c.uCA.value    = (c.uCA.value || 0) + 0.0060*morph;
    c.uSplit.value = 0.0022*morph;

    /* Focus. The jungle is a wall of small shapes and all of them were equally
       sharp, which is why the middle distance read as noise: the eye had no
       reason to look anywhere. Holding the near sharp and letting everything
       past forty metres go soft picks the subject for it, and it is also the
       cheapest detail reduction there is — the far ferns stop having to be
       convincing. */
    d.uStart.value = 26; d.uEnd.value = 190; d.uMaxRadius.value = 3.4;
    d.uFocus.value = 0;
  }

  debugLayers(){ return this.jungle.debugLayers(); }

  dispose(){ this.jungle.dispose(); }
}
