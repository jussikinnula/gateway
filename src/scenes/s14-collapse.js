import { makeWorlds, drawWorld } from './worlds.js';

/* S14 — Collapse.  Bars 128–143.
 *
 * 'The cut rate goes from the bar to the beat to the eighth. By the end of it
 * there is no way to tell which world is the real one, which is the point.'
 *
 * Sixteen bars, three runs, and the whole scene is one function: given a time,
 * which world is on screen. Everything else — the camera, the grade, the
 * worlds themselves — is inherited from the scenes being cut between.
 *
 *   128-133  one cut per bar.
 *   134-139  one cut per beat.
 *   140-143  one cut per eighth.
 *
 * Three things make this work rather than merely flicker:
 *
 *   The cut index comes from the GRID, not from a counter. `Math.floor` of the
 *   bar, the beat or the eighth is a pure function of t, so frame 40000 knows
 *   which world it is showing without frame 39999 — which at an eighth-note
 *   cut rate is the difference between a render that can be split across six
 *   machines and one that cannot. The film's own rules require it and this is
 *   the scene where it would have been most tempting to keep a counter.
 *
 *   Each cut lands MID-MOVE. The shot list asks for it twice — 'each cut lands
 *   mid-move, so no move is ever completed' and 'moves are now shorter than
 *   the shots that contain them'. So a world is not shown at its fixed frame
 *   here: `phase` walks its own clock forward across the cut, and the phase
 *   carries on from where that world's previous appearance left off rather
 *   than restarting. Cutting back to a world that has moved on is what makes
 *   sixteen bars of this read as one collapsing thing instead of a slideshow.
 *
 *   The sequence does not repeat. The world for cut k is a hash of k, not
 *   k modulo the number of worlds, so no run of cuts ever becomes a pattern
 *   the eye can lock onto — 'no way to tell which world is the real one'
 *   fails immediately if the answer turns out to be 'every fifth one'.
 *
 * The two lyric cues in the last run, 'Keep moving.' at 141.00 and 'Don't look
 * back.' at 142.99, both land on downbeats and the shot list says to cut on
 * them. They already are cuts — an eighth-note grid contains every downbeat —
 * so what they get instead is a guaranteed CHANGE of world, which a hash alone
 * cannot promise.
 */

/* Five worlds, not six: the desert is out.
 *
 * 'Flashbackeissä ei tarvitsisi olla aavikkoa, koska se on loppukohtaus.' A
 * flashback to somewhere the film has not been yet is not a flashback. S8's
 * fifth door keeps its desert on purpose — that one is explicitly 'four doors
 * onto the past and one onto something that has not happened' — but this scene
 * is the collapse of what HAS happened, and cutting to the last twenty seconds
 * of the picture a dozen times before it arrives spends it. */
const CAST = ['jungle', 'volcanic', 'dark', 'islands', 'tunnel'];

function hash(i){
  let x = (i*2654435761 + 40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0)/4294967296;
}

export class CollapseScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S14') || { t: tl.timeOfBar(128), tEnd: tl.timeOfBar(144) };
    this.T0 = span.t; this.T1 = span.tEnd;
    this.tBeat = tl.timeOfBar(134);
    this.tEighth = tl.timeOfBar(140);

    this.worlds = makeWorlds(tl, CAST);
    /* main.js reads these after update(); they are replaced every frame by
       whichever world the cut lands on. Seeded here so the very first frame
       has something valid even if update() has not run. */
    this.scene = this.worlds[0].scene.scene;
    this.camera = this.worlds[0].scene.camera;
  }

  /** The cut index at time t, and how long each cut lasts. One place, because
      the phase below needs both and computing them twice invites them to
      disagree. */
  cutAt(t){
    const tl = this.tl;
    if (t < this.tBeat){
      const step = tl.barSec;
      return { k: Math.floor((t - tl.origin)/step), step };
    }
    if (t < this.tEighth){
      const step = tl.beat;
      return { k: 100000 + Math.floor((t - tl.origin)/step), step };
    }
    const step = tl.beat/2;
    return { k: 200000 + Math.floor((t - tl.origin)/step), step };
  }

  update(t, post){
    const { k, step } = this.cutAt(t);

    /* Which world. A hash of the cut index, so the run never becomes a cycle
       — see the note at the top. */
    let idx = Math.floor(hash(k)*this.worlds.length) % this.worlds.length;
    /* Except that a hash can repeat itself twice in a row, which at a bar's
       length reads as a missed cut. If it does, step on. */
    const prev = Math.floor(hash(k - 1)*this.worlds.length) % this.worlds.length;
    if (idx === prev) idx = (idx + 1 + Math.floor(hash(k + 7)*(this.worlds.length - 1))) % this.worlds.length;

    const w = this.worlds[idx];

    /* Where in this world's own clock we are. Each appearance carries on from
       the last rather than restarting: the cut index divided down gives a
       phase that keeps climbing, so a world cut back to has moved. Wrapped
       with fract so it never runs off the end of that world's `dur`. */
    const inCut = (t - (this.tl.origin + (k % 100000)*step))/step;
    const phase = ((k*0.37 + inCut*0.55) % 1 + 1) % 1;

    /* And a different vantage point each time a world comes round.
     *
     * 'Tulivuori on aina samasta näkykulmasta.' It was: worlds.js handed out
     * one instant per world, so every one of this scene's dozen cuts to the
     * volcano was the same photograph. It is a list now (see WORLDS), and the
     * choice is made HERE because only this scene needs it.
     *
     * Chosen by walking backwards to the last cut that showed this same world
     * and taking anything but the vantage it used. Bounded to twenty steps, so
     * it is still a pure function of k with no state and no history — the same
     * discipline the world choice itself is under, and the reason this scene
     * can be rendered out of order across six processes. A hash alone would
     * have repeated the angle a quarter of the time, which on a cut rate this
     * fast reads as the cut having failed. */
    const nv = w.views || 1;
    let view = Math.floor(hash(k*7 + 3)*nv) % nv;
    for (let back = 1; back <= 20; back++){
      const kb = k - back;
      let ib = Math.floor(hash(kb)*this.worlds.length) % this.worlds.length;
      const pb = Math.floor(hash(kb - 1)*this.worlds.length) % this.worlds.length;
      if (ib === pb) ib = (ib + 1 + Math.floor(hash(kb + 7)*(this.worlds.length - 1))) % this.worlds.length;
      if (ib !== idx) continue;
      const vb = Math.floor(hash(kb*7 + 3)*nv) % nv;
      if (view === vb) view = (view + 1 + Math.floor(hash(k*13 + 5)*(nv - 1))) % nv;
      break;
    }

    const out = drawWorld(w, post, this.camera.aspect || 16/9, phase, view, t);
    this.scene = out.scene;
    this.camera = out.camera;
    this.refractScene = out.refractScene;

    // ---- grade -------------------------------------------------------------
    /* Each world has just graded itself, which is what keeps the cuts feeling
       like cuts between PLACES rather than between camera angles. What this
       adds on top is only what belongs to the collapse itself. */
    const c = post.qComp.u;
    const p = Math.min(1, Math.max(0, (t - this.T0)/(this.T1 - this.T0)));
    /* A hit on every cut, hardest at the eighth-note rate. Decaying across the
       cut rather than flat, so the frame is brightest at the join. */
    const since = (t - (this.tl.origin + (k % 100000)*step))/step;
    const hit = Math.exp(-Math.max(0, since)*7.0);
    /* And it is a gain on what the world just wrote, not a flat lift on top
       of it. uFlash is `col += uFlash` in the composite — a constant added to
       every pixel in linear light before the 1/2.2 gamma, so 0.10 laid a 0.41
       grey over the WHOLE frame: measured, the floor at each cut was 0.345
       against 0.084 mid-cut. A veil over a place, at the exact instant the
       cut is asking the eye to read that place. Multiplying keeps the note
       above — brightest at the join — and lets the join be a bright version
       of the world rather than a pale one. See s10-third-passage.js for the
       measurement that found this across six scenes. */
    const jolt = hit*(0.4 + 0.6*p);
    c.uExposure.value = (c.uExposure.value || 1) * (1.0 + 0.40*jolt);
    c.uBloom.value    = (c.uBloom.value || 0) + 0.50*jolt;
    c.uCA.value       = (c.uCA.value || 0) + 0.0022*p;
    c.uSplit.value    = 0.0012*p*hit;
    c.uGrain.value    = (c.uGrain.value || 0) + 0.020*p;
    c.uExposure.value = (c.uExposure.value || 1)*(1 + 0.10*p);
  }

  dispose(){
    for (const w of this.worlds) if (w.scene.dispose) w.scene.dispose();
  }
}
