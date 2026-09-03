import * as THREE from 'three';
import { Desert } from '../env/desert.js';

/* The flight, as three numbers, up here because _camAt() below is handed to
   Desert.js and the values it flies by should be readable next to it rather
   than buried inside update(). */
const CAM_V = 190;     // units/second forward; see the note in update()
const CAM_H = 260;     // altitude, authored rather than terrain-following
const CAM_BOB = 24;    // the slow rise and fall on top of it

/* THE WEAVE, and it is a closed form again.
 *
 * 'Haluan tasaisen keinumisen jossa kamerakulma voi hieman kääntyä vasemmalle
 * ja oikealle. Ja horisontti keinua niinkuin se alussa tekee pari kertaa.'
 *
 * The middle of this scene used to steer along a dune ridge, reading the
 * height field ahead of the camera and turning toward the crest. It is gone,
 * and it is worth writing down why rather than quietly deleting it, because
 * the idea was sound and the implementation was not.
 *
 * A steering law that picks a direction from the TANGENT to a gradient has to
 * choose between two tangents, and it chose the one pointing forwards. Near
 * the moment when a crest runs across the heading rather than along it, that
 * test flips, the desired heading swings by half a turn, the rate saturates
 * against its own limit in the opposite direction, and the bank goes from one
 * end of its clamp to the other. Measured on the table it produced: through
 * the weave the bank changed by 0.04 to 0.15 degrees per frame, and inside the
 * ridge section it changed by TWENTY-ONE AND A HALF DEGREES per frame, several
 * times. That is not a camera following a ridge; it is a camera being thrown.
 *
 * Stabilising it would mean rate-limiting and filtering a feedback loop, and
 * what was asked for after seeing it is the opposite of a feedback loop: an
 * even weave, the one the opening does, for the whole scene. So the ridge is
 * out and the path is a closed form again — which is not a consolation prize.
 * A closed form cannot judder, cannot depend on the frame rate it was
 * integrated at, and answers where the camera is at any t without a table,
 * which is what desert.js needs to stand its flickers on the sand.
 *
 * The figure is the opening five bars' own, repeated:
 *
 *   f(s)  = sin(2*pi*s)*sin^2(pi*s)     one lobe left, then one lobe right
 *   yaw   = -A*f                        where the camera looks and flies
 *   roll  ∝ df/ds                       bank into the turn, out of it again
 *   lat   ∝ -integral of f              where that puts it
 *
 * It can repeat because f, df AND the integral of f are all exactly zero at
 * both ends of a period: every period joins the next level, on heading and on
 * the centre line, and no drift accumulates over eighteen bars. Amplitude and
 * direction vary a little per period so it is not a machine, and only a little
 * — 'tasainen' is the word, and a weave whose swing changed by half from one
 * pass to the next would not be even. */
const TURN_YAW = 0.13;        // heading amplitude, radians: 7.4 degrees
const TURN_ROLL = 0.115;      // bank at the peak rate: 6.6 degrees
const WEAVE_BARS = 5;         // one period
/* max |df/ds| = pi*max|cos(2*pi*s) - cos(4*pi*s)|. The stationary points are
   where sin(a)*(4*cos(a) - 1) = 0; the cos(a) = 0.25 branch gives 1.125 and
   the sin(a) = 0 branch gives 2, and it is the second one that is the maximum.
   Taking only the first made the bank 1.78x what it was written to be. */
const TURN_DFMAX = 2*Math.PI;

function pathHash(i){
  let x = (i*2654435761 + 40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}

/* S17 — Desert.  Bars 158–175, and the film does not go past bar 176: this is
 * the last authored scene.
 *
 * IT STARTS AT 158 AND NOT 156, and the reason is in the mix rather than in
 * the picture. Bar 157 is a break: rms 0.481 against 0.78 either side, kick
 * 0.294 against 0.77, and mid jumping to 0.898 — the drums drop out for one
 * bar and something melodic fills it. Bar 158, at 4:22.42, is the re-entry.
 * Started at 156 the desert arrived two bars early, in the middle of the
 * previous phrase, and then played through the breakdown as if it had not
 * happened. S16 now holds the white through the break, and the ground lands
 * on the downbeat where the kick comes back.
 *
 * S16 hands off on a hard cut, on purpose — 'the film has done enough
 * fading' — from a flat white field to a sky the brief calls colourless, so
 * the cut is white to near-white and the desert resolves out of the same
 * blankness the tunnel just dissolved into rather than replacing it.
 *
 * What happens, in order:
 *   156-161  the ground, the sky, a steady flight forward — and, once, early,
 *            a single flicker, so the scene states its subject before it has
 *            finished establishing its silence.
 *   162-167  the two authored flickers of the shot list: things on the
 *            horizon that look like a gateway and are not.
 *   167-172  more of them, further out and smaller with it, scattered rather
 *            than placed.
 *   170-     the sky goes over to storm: a deck of cloud, the sun covered
 *            rather than set, lightning inside it.
 *   172-174  fast flickers, accelerating, gaps closing from about a second
 *            to a tenth of one.
 *   173.3    black starts.
 *   174.1    the mix's last hit. One more flicker fires on it, the biggest
 *            and the closest of them, and the black takes it mid-flash.
 *   174.4    full black, held for the three and a half seconds of reverb
 *            that are left.
 *
 * That last line is a change of direction, and it is recorded as one rather
 * than quietly absorbed. This scene was authored to do the opposite: 'the
 * haze thickens and the picture goes soft rather than dark. It does not cut
 * to black and it does not fade: the last frame of the film is still moving
 * forward.' The brief changed during production, so scenes.json now says what
 * the film actually does — including that it used to say something else —
 * and SCENES.md has been regenerated from it. The document and the code agree
 * again; if one of them moves next time, it should be that one first.
 */
export class DesertScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S17') || { t: tl.timeOfBar(156), tEnd: tl.timeOfBar(176) };
    this.T0 = span.t; this.T1 = span.tEnd;

    this.scene = new THREE.Scene();
    /* Far clip past 6200: the flicker schedule (Desert.js) holds its
       membrane 3600-5800 units out on purpose, and a camera far plane
       inside that range clips the geometry before the fragment shader ever
       runs — checked directly, the old 4200 cut off more than half the
       schedule's own distance range regardless of the shader's own fade. */
    this.camera = new THREE.PerspectiveCamera(56, 16/9, 0.5, 6200);

    /* Bars 173-175: the measured start of the mix's own thinning. */
    this.tHaze = tl.timeOfBar(173);

    /* The storm gathers from bar 170, three and a bit bars before the fade
       starts, so the weather is already underway rather than arriving with
       the ending — weather that switches on at the exact moment the film
       ends reads as an effect rather than as weather. */
    this.tStorm = tl.timeOfBar(170);

    /* The fade, timed to the LAST HIT rather than to the end of the file.
       The mix's final stroke and its reverb land at bar 174.1; the tail then
       rings out for another three and a half seconds to 293.41. Fading
       across that tail, which is what tying the fade to the file's own
       duration did, put the darkness after the music instead of with it —
       the picture was still going out long after the thing it was going out
       on had been struck.

       So: black begins at 173.3, is most of the way down by the hit at
       174.1, and is complete at 174.4. The last three and a half seconds of
       the film are black over a decaying reverb, which is a held ending
       rather than a slow one. */
    this.tFade0 = tl.timeOfBar(173.3);
    this.tFade1 = tl.timeOfBar(174.4);

    /* The camera's own look-azimuth, as a function of time alone — pulled out
       here so it can be handed to Desert.js too, which draws each flicker
       event's azimuth near whatever this returns rather than off the full
       circle (see the note by the schedule in desert.js).

       Constant zero now — the brief's own follow-up was explicit: the camera
       flies straight forward, it does not turn to the side ('kamera
       liikkuu sulavasti eteenpäin... ei käännytä sivulle'). The first cut
       swept this through a wide arc during bars 162-167 specifically so a
       'searching' camera had something to find; that search is gone along
       with the turn, so the two flicker events now have to sit in frame on
       their own — which is also why their lateral offset in desert.js still
       varies event to event rather than being centred, so a fixed forward
       view still has something to notice off-centre instead of dead ahead. */
    this._turn = (tt) => this.weave(Math.max(0, tt - this.T0));
    this._azAt = (tt) => this._turn(tt).yaw;

    /* The camera's own position, as a function of time alone, for the same
       reason _azAt is one: Desert.js needs it too. Each flicker is now placed
       at a FIXED point in the world — standing on a particular dune — rather
       than at a fixed offset from wherever the camera happens to be, and
       working out which point that is means knowing where the camera will be
       at the event's own moment. Held as one function used by both this
       scene's own per-frame camera and that placement, so the desert cannot
       end up standing its flickers on ground the camera never flies over. */
    this._camAt = (tt, out) => {
      const uu = Math.max(0, tt - this.T0);
      return out.set(this.weave(uu).lat,
                     CAM_H + CAM_BOB*Math.sin(uu*0.11),
                     -CAM_V*uu);
    };

    this.desert = new Desert(tl, this._azAt, this._camAt);
    this.scene.add(this.desert.group);

    /* One sun, fixed for the whole scene — 'quiet and enormous' has no room
       for a light that is visibly doing something. Lowered from y=0.14 to
       y=0.045 (x/z unchanged, so its azimuth — and desert.js's SUN_AZ, which
       the flicker schedule steers away from — still match): the brief's own
       follow-up asked for it setting toward the horizon, casting long
       shadows off the dunes ('aurinko on laskemassa taivaanrantaan, jolloin
       dyyneistä jää pitkät varjot'), which a sun this close to grazing is
       what actually produces — desert.js's duneShadow() raymarch was
       extended to match, since a shallow sun needs a much longer march to
       find whatever is tall enough to cast a shadow this far. */
    this._sun = new THREE.Vector3(0.6, 0.045, -0.79).normalize();

    this._pos = new THREE.Vector3();
    this._tgt = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._q   = new THREE.Quaternion();
  }

  /** The whole manoeuvre at elapsed time u: where it is looking, how far it is
   *  banked, and how far off the centre line that has carried it.
   *
   *  One function, three views of it — three separate curves would eventually
   *  disagree, which is the recurring fault in this project. */
  weave(u){
    const P = WEAVE_BARS*this.tl.barSec;
    const k = Math.floor(u/P);
    const ss = u/P - k;
    /* A little variation per period, and only a little: 'tasainen'. */
    const amp = TURN_YAW*(0.86 + 0.28*pathHash(k));
    const sgn = pathHash(k + 11) < 0.5 ? 1 : -1;
    const a = 2*Math.PI*ss, b = 4*Math.PI*ss;
    const f  = Math.sin(a)*0.5 - Math.sin(b)*0.25;      // sin(2pi s)*sin^2(pi s)
    const df = Math.PI*(Math.cos(a) - Math.cos(b));
    /* The integral, in closed form and arranged so F(0) = F(1) = 0 exactly —
       which is what lets the period repeat with no drift. */
    const F  = -Math.cos(a)/(4*Math.PI) + Math.cos(b)/(16*Math.PI) + 3/(16*Math.PI);
    return { yaw:  -sgn*amp*f,
             roll:  sgn*amp/TURN_YAW*TURN_ROLL*df/TURN_DFMAX,
             lat:  -sgn*amp*CAM_V*P*F };
  }

  update(t, post){
    const tl = this.tl;
    const u = Math.max(0, t - this.T0);

    // ---- camera --------------------------------------------------------------
    /* A straight line forward, not a wander — 'kamera liikkuu sulavasti
       eteenpäin... ei käännytä sivulle'. The lateral drift the first pass had
       (a slow side-to-side sine) is gone along with the pan: this scene's own
       one register is now literally just forward, at a speed actually meant
       to be felt — see V below. */
    /* Height is authored, not terrain-following — the dune field's own ridges
       ran up to about 40 units at the first pass; the follow-up asking for
       'massiivisia isoja dyynejä' roughly tripled that in desert.js
       (duneH's own note), so this altitude is raised to match, with the same
       margin logic as before: a fixed eye-level altitude sat inside the old
       ridges for part of the flight, checked directly by the camera looking
       out through the inside of a ridge, which renders as nothing at all in
       front of it and a sliver of far terrain above. Kept close enough above
       the new peaks that the dunes still read as massive underneath it
       rather than shrinking with distance — 'kamera lentäisi niiden
       yläpuolella' is a low aerial line, not a satellite view — while still
       clearing the tallest of them with margin, and needing no ground-height
       sampling on the CPU to do it. */
    /* V is 190, and the number comes from the DUNE FIELD rather than from a
       feeling. 'Loppukohtaus tuntuu olevan kuin tervassa juoksemista.'
 
       Apparent speed is speed divided by the size of what you are passing, and
       this ground is enormous: desert.js's primary ridge runs at 0.00075, a
       wavelength of 1333 units, and the amplitude field that decides how big
       the dunes are at all runs at 0.00014 — 7143 units. At 70 a primary
       ridge passed once every nineteen seconds, so fewer than two crossed the
       whole scene, and the amplitude field never changed at all: one patch of
       one size of dune, for half a minute, under a camera that was nominally
       flying. That is the tar.
 
       At 190 a ridge passes every seven seconds — four across the scene — the
       secondary ridge every second and a half, and the amplitude field moves
       most of a wavelength, so the dunes visibly change size once on the way.
       The flickers do not need repositioning for it, which is worth stating
       because it was the obvious worry: each one is placed at a fixed point in
       the world worked out from where the camera will be at ITS OWN moment, so
       the distance to it is unchanged; all that grows is how much the camera
       closes during its life, from 133 units to 361 against a standoff of
       2900 — from five per cent to twelve.
 
       The original note on the jump from 4.6 to 70 is kept below, because the
       reasoning is the same reasoning and it was right, only not far enough:

       V raised hard, from 4.6 to 70 — checked directly against the old value:
       over this scene's ~33 seconds that was under 160 units of travel, next
       to nothing against a dune field whose own ridge wavelength is now
       thousands of units, so the ground looked all but frozen underneath a
       camera that was nominally 'flying'. 70 covers a bit over 2000 units by
       the scene's end — a good fraction of the secondary ridge's own
       wavelength — so the mid-scale dune arrangement visibly changes under
       the camera and new shapes actually arrive at the horizon and pass
       beneath it, which is what 'dyynejä tulee vastaan lisää' asked for.
       Tried lower, briefly, while chasing the frame-to-frame rippling that
       desert.js's update() finally fixed by snapping the mesh. Speed was a
       reasonable suspect — it is half of that ripple's period, the grid
       spacing being the other half — but only its period, never its
       amplitude, so slowing down could only ever have made the fault
       slower rather than smaller. Put back to 70 once that was understood. */
    this._camAt(t, this._pos);
    this.camera.position.copy(this._pos);

    /* The heading. Held as a call rather than inlined so Desert.js's flicker
       azimuths — drawn from the same function — and this camera can never
       quietly drift out of sync if one of them changes later. Non-zero only
       for the opening five bars; see TURN_BARS. */
    const turn = this._turn(t);
    const az = turn.yaw;
    /* Steepened slightly (-0.20 -> -0.28) alongside the taller altitude
       above: a flyover reads as one looking down at what it is flying over,
       and the shallower pitch, held against the new height, put more of the
       frame on sky than on dune. Still well short of straight down — the low
       sun and the horizon it is setting into need to stay in view for the
       long-shadow read the brief asked for. */
    const pitch = -0.28 + 0.02*Math.sin(u*0.07);
    const cp = Math.cos(pitch);
    this._tgt.set(this._pos.x + Math.sin(az)*cp*40,
                  this._pos.y + Math.sin(pitch)*40,
                  this._pos.z - Math.cos(az)*cp*40);
    /* And the bank. Applied to the UP vector about the view axis, which is
       the only way to roll a camera that is also being aimed: rolling the
       target instead would move where it is looking. */
    this.camera.up.set(0, 1, 0);
    if (turn.roll !== 0){
      this._fwd.subVectors(this._tgt, this._pos).normalize();
      this._q.setFromAxisAngle(this._fwd, turn.roll);
      this.camera.up.applyQuaternion(this._q);
    }
    this.camera.lookAt(this._tgt);

    // ---- the world -----------------------------------------------------------
    /* Heat shimmer never turns off — this is a desert — but it is what the
       last section thickens into, so it gets its own ramp rather than a flat
       1. */
    const haze = Math.min(1, Math.max(0, (t - this.tHaze)/(this.T1 - this.tHaze)));
    const heat = 0.7 + 0.3*Math.min(1, u/8);
    /* Smoothstepped rather than linear: a linear ramp starts at full rate,
       so the first cloud would arrive at a definite moment. This one leaves
       and arrives gently, which is the difference between weather closing in
       and a dissolve to a different sky. Clamped, and it stays at 1 past T1,
       where the renderer is still holding this scene for the film's last
       second. */
    /* Normalised to the moment of full black, so the sky reaches its darkest
       exactly as the picture goes — still darkening underneath the fade
       rather than having finished early and left the fade to do all the
       work on its own. */
    const sRaw = Math.min(1, Math.max(0, (t - this.tStorm)/(this.tFade1 - this.tStorm)));
    const storm = sRaw*sRaw*(3 - 2*sRaw);
    const { pulse, bolt } = this.desert.update(
      t, { camera: this.camera, sunDir: this._sun, heat, haze, storm });

    // ---- grade -------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;
    /* The 'colourless, does the least work of any grade in the film' read
       cost the desert its actual colour, checked directly against reference
       photographs: 1.12+ exposure and a 0.62+ vignette over the saturated
       sky/sand this scene now builds was crushing both toward white before
       the tonemap ever got a say. Pulled back near neutral — 'the least
       work' still means less grading than the other worlds, just not zero
       picture. Warmed slightly rather than left neutral, since the sun this
       scene lights by is itself warm.

       Still read as overexposed after the fog cut fixed the atmospheric
       side of that — 'voisi laskea kirkkautta' — so exposure and gain both
       came down again on top of it: 1.00 -> 0.86 and a gain of roughly 0.92
       across all three channels rather than the near-1.0 triplet this had.
       Global multipliers on purpose, not another hunt through individual sky
       or sand terms — the desert was uniformly too bright, not bright in one
       particular place, so the fix is uniform too. */
    /* The storm takes another quarter of a stop out on top of all that, and
       the ending needs it: the shard clusters are additively blended, so a
       sky this dark makes them read far brighter than the same events did at
       midday without a single change to the clusters themselves. */
    c.uExposure.value = 0.86 + 0.08*haze - 0.30*storm;
    /* No storm term here, and that was a real mistake worth naming: bloom
       was raised with the storm to make the shard clusters glow against the
       dark, and bloom spreads whatever is brightest across everything else,
       so it lifted the entire darkened frame back up — the ground measured
       only 14% darker under a sky that had lost a third of its light. A
       storm has less bright light in it, not more. The clusters read fine
       on their own now the sky behind them is dark. */
    c.uBloom.value    = 0.16 + 0.40*pulse;
    c.uCA.value       = 0.0009 + 0.0024*pulse;
    c.uVignette.value = 0.34 + 0.10*haze + 0.16*storm;
    /* Zero — and this line has an honest correction attached to it, because
       it was once believed to be the fix for 'dyynit liikkuvat ylös/alas
       muutaman framen välein' and it was not.

       What is true: COMPOSITE's film grain updates once every 5 frames
       rather than every frame (post.js explains why — encoder cost, not a
       shortcut), and a 5-frame-held noise field does visibly pop where it
       straddles a hard edge, which this scene's horizon became once the fog
       was cut. Turning it off removes a real, measurable periodic spike from
       a whole-frame difference.

       What was false: that this was the movement being reported. It was not.
       The dune field itself was rippling, because the mesh followed the
       camera continuously across a height field it cannot resolve — see
       desert.js's update(), which now snaps it. Grain's 12Hz and that
       ripple's ~14Hz are near enough to be one thing by eye, and the spike
       that vanished when grain went off made a persuasive-looking case for a
       conclusion that was simply wrong; the desert kept moving with grain at
       zero, which is what eventually gave it away.

       Left at zero anyway, deliberately and not by inertia: the pop is real
       even if it was never the complaint, this scene's brief is explicitly
       'maisemat ovat staattiset', and it is the one scene in the film whose
       whole subject is stillness. If the film-wide grain look matters more
       than that later, the film-wide 0.022 can go back — the thing it was
       once covering for is fixed now, so this is a look decision again
       rather than a bug workaround. */
    c.uGrain.value    = 0.0;
    c.uLift.value.setRGB(0.004, 0.003, 0.003);
    /* Warm while the sun is up, cold once it is covered. The warmth in this
       grade was there to match a low sun; under a deck of cloud there is no
       low sun to match, and holding the same warm gain over a storm is what
       makes a dark scene look merely underexposed rather than overcast. */
    c.uGain.value.setRGB(0.94 - 0.15*storm, 0.92 - 0.11*storm, 0.87 + 0.02*storm);
    /* uFlash adds flat over every pixel in the frame, not just near the
       event — checked directly, 0.24 at the old peak combined with the new
       shard cluster's own (now corrected) brightness to visibly wash the
       whole picture at the exact moment it should be reading as one small
       glinting anomaly on the horizon, not a flashbulb. Cut to 0.08: still a
       felt little jolt in step with the pulse, not a whiteout.

       Down again to 0.05 now the events run about three times longer (see
       desert.js's schedule). A flat lift over every pixel reads as a jolt at
       a third of a second and as a visible global brightening at a second
       and a half — both the wrong read for something happening on the
       horizon, and exactly the kind of thing this scene has been told twice
       already is too bright. The cluster itself got brighter to pay for it,
       which is the right place to spend it: the light then comes from
       somewhere rather than from everywhere. */
    c.uFlash.value    = 0.05*pulse + 0.008*bolt*storm;

    /* The fade. uBlack is the compositor's last operation of all — after the
       tonemap, after the grade, after the grain — which is the only place a
       fade to black can go without the grade quietly lifting the black back
       off zero underneath it.

       Eased rather than linear, and the exponent is doing real work. The
       last flicker fires on the hit at 174.1, which is 80% of the way
       through this fade: on a straight ramp that flash would arrive with
       four fifths of the picture already gone and simply not be seen. At
       2.2 the curve holds the picture open early and spends most of its
       darkening in the final third, so the hit lands with about half the
       image still there and the flash is taken by the black at its peak
       rather than before it. Still exactly 0 at tFade0 and exactly 1 at
       tFade1 — the shape changed, the timing the brief gave did not. */
    const fu = Math.min(1, Math.max(0,
      (t - this.tFade0)/(this.tFade1 - this.tFade0)));
    c.uBlack.value = Math.pow(fu, 2.2);

    d.uStart.value = 90 - 40*haze;
    d.uEnd.value   = 2000 - 900*haze;
    d.uMaxRadius.value = 1.6 + 1.2*haze;

    /* THE ARRIVAL. The desert comes OUT OF the white rather than being cut to.
     *
     * 'Siirtymä lopun aavikkokohtaukseen töksähti, eli siihen voisi tehdä kans
     * blurrauksen/morfauksen. Ajoitetaan biittien mukaan tahdin ekalle
     * biitille aavikon alku.'
     *
     * S16 ends on a genuinely flat card — measured over its last four seconds,
     * mean 0.84, sd 0.04, frame-to-frame difference 0.003. There is nothing in
     * it to carry across, which is why the other four transitions' recipe (the
     * scenes share an OBJECT, drawn additively) has nothing to work with here:
     * neither side has a tunnel and one side has no geometry at all.
     *
     * So the shared thing is the WHITE itself. At the downbeat this scene
     * starts at S16's own value and the card lifts off it: uFlash decays over
     * a bar, and underneath it the defocus racks in over two — near plane on
     * the lens, wide radius, and the sky racking with the ground, because a
     * desert is two thirds sky and leaving it sharp would have left the frame
     * legible through the whole rack (the same finding as S11's arrival).
     *
     * This is the one place in the film where uFlash is the right instrument
     * and not a bug. Everywhere else it was wrong because it lays a flat card
     * over a picture; here the frame before the cut IS a flat card, and
     * continuing it is exactly what a match cut is.
     *
     * The number is measured, not chosen. S16's last frame is 0.844 mean,
     * sd 0.041; 0.34 puts this scene's first frame at 0.845, sd 0.047 —
     * within half a sd of it. The frame-to-frame difference at the join went
     * from 75.5 to 15.2, and what is left of it is the desert beginning to
     * appear, which is what the downbeat is supposed to do. */
    const open = 1 - Math.min(1, Math.max(0, (t - this.T0)/(2*this.tl.barSec)));
    if (open > 0.001){
      const card = Math.max(0, 1 - (t - this.T0)/this.tl.barSec);
      const o2 = open*open, o3 = o2*open;
      /* And the card SHATTERS rather than fading. 'Saisitko autiomaan
         sisäänmorfautumisen samalla tavalla sirpaloidusti kuin
         feikkiportaalit?' — the false gateways on this scene's own horizon
         come apart into glass, and this is the same figure at the size of the
         whole frame. See the note on shardCell() in core/post.js.

         Nine cells across the frame: fewer and the pieces are so large that
         one leaving is a wipe, more and the break reads as noise rather than
         as glass. The seed is the scene's own start time, so it is a constant
         and not a clock. */
      c.uShardAmt.value   = 0.32;
      c.uShardT.value     = card*card;
      c.uShardCells.value = 5.0;
      c.uShardSeed.value  = 4.31;
      c.uExposure.value *= (1 + 0.55*o2);
      c.uBloom.value    += 0.90*o2;
      d.uStart.value     = d.uStart.value*(1 - o3) + 3*o3;
      d.uEnd.value       = d.uEnd.value*(1 - o3) + 260*o3;
      d.uMaxRadius.value = d.uMaxRadius.value*(1 - o3) + 30*o3;
      d.uSkyDefocus.value = o2;
    }
  }

  debugLayers(){ return this.desert.debugLayers(); }

  dispose(){ this.desert.dispose(); }
}
