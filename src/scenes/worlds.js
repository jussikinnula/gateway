import { JungleScene } from './s05-jungle.js';
import { VolcanicScene } from './s07-volcanic.js';
import { DarkScene } from './s09-dark.js';
import { IslandsScene } from './s11-islands.js';
import { DesertScene } from './s17-desert.js';
import { PassageScene } from './s04-passage.js';

/* The worlds, as a list three scenes cut between.
 *
 * S8 flashes through five of them, S13 dissolves two and then four together,
 * and S14 cuts between all of them at the bar, then the beat, then the eighth.
 * All three need the same thing — a world, and a time inside it that looks
 * like itself — and none of them should own that list, because the moment two
 * of them own it they disagree about it.
 *
 * `at` is a fixed time inside each scene's own span, and it has to be: every
 * scene here clamps its own internal ramps to its own T0..T1, so handing one
 * a time from bar 130 shows it at whichever end it clamps to, which is the
 * least characteristic frame it has. Sampling each at a moment chosen once
 * also means a cut to a world is the SAME picture every time it is cut to,
 * which is what makes a run of cuts read as alternating between places rather
 * than as footage playing underneath.
 *
 * `dur` is how long a world stays legible: how much of its own time to let
 * run when a scene wants motion inside a cut rather than a frozen frame. S14
 * uses it; S8 and S13 do not.
 *
 * Constructing all six is not free — a jungle, a volcanic plain, an island
 * field, a crowd, a desert and a tunnel — so this is a factory rather than a
 * list of instances. A scene builds only the worlds it actually cuts to, and
 * the ones it builds it builds once.
 */
/* Each world is sampled from SEVERAL vantage points, not one.
 *
 * 'Tulivuori on aina samasta näkykulmasta. Käytetään jokaisesta tulivuoren
 * näyttämisestä eri kuvakulmaa. Myös saarekkeista eri kuvakulmia.'
 *
 * `at` was a single instant, and the note above it explains why it had to be
 * one: a scene handed a time outside its own span shows itself at whichever
 * end it clamps to, and sampling at a moment chosen once means a cut to a
 * world is the same picture every time. That second half is exactly right for
 * S8, where five doors open once each — and exactly wrong for S14, where the
 * same world comes round a dozen times in sixteen bars. The same picture
 * twelve times is a slideshow with two slides.
 *
 * So it is a LIST of instants now, every one of them still a moment chosen
 * once inside that scene's own span, and every one still a place that world
 * looks like itself. They are taken from the scene's own camera path rather
 * than invented: the volcanic ones are two points on its orbit and two down
 * its run, so the cone is seen from opposite sides and then from underneath at
 * speed; the island ones are a keel against the nebula, a low pass over the
 * grass by the lake, and two mid-field views. Nothing new is authored — the
 * shots already existed, they were just never used.
 */
export const WORLDS = [
  /* Bar 46, not 50. Bar 50 lands in the one stretch of S5 that has nothing in
     frame — a dark green blur between the boardwalk and the fern wall — and
     every scene that cuts to 'the jungle' was cutting to that. Bar 46 is the
     boardwalk with the lantern on it, which is what the jungle looks like when
     it looks like itself. The others are the canopy shot (now that it has a
     composition in it) and the cold blue approach to the passage. */
  { id: 'jungle',   make: (tl) => new JungleScene(tl),
    ats: (tl) => [46, 48.4, 52.6, 60.2].map(b => tl.timeOfBar(b)),   dur: 2.0 },
  { id: 'volcanic', make: (tl) => new VolcanicScene(tl),
    ats: (tl) => [70.9, 72.4, 74.2, 76.2].map(b => tl.timeOfBar(b)), dur: 1.6 },
  /* The dark world is sampled INSIDE a strobe flash, which is the same fault
     the jungle's bar 50 was and is worth spelling out because it cost one
     frame in five of S14.

     S9's strobe is flat 1 for FLASH_S — two frames, 0.033 s — after every
     beat and then drops to a floor of 0.03. That is lit for eight per cent of
     each beat and black for the other ninety-two. `at` was already on a bar
     line and therefore on a beat, so phase 0 was lit and S8's third door
     always looked right; but `dur` was 1.2 seconds, so S14 — the one scene
     that actually walks the phase — sampled a uniformly random instant across
     three beats and got the dark part almost every time. Measured across the
     whole film at two frames a second: 12 of S14's 54 frames were flat black
     at 0.053, which is exactly the one cut in six that the cast hands to this
     world.

     So `dur` is the flash, not a second and a bit of it, and every vantage is
     nudged a quarter of a frame past its beat so no rounding can put phase 0
     on the wrong side of it. The world barely moves inside a cut now, which is
     not a compromise: this is the world whose shot list says the figures stand
     in the dark and do not move. The four bars are four different drifts of
     the camera, which is all the parallax this scene has and all it wants. */
  /* And `dur` is 0.55 again, twenty times what it was, because the light this
     world shows a flashback is no longer the light it shows itself. The note
     above stands as the record of why it was 0.026: sampled with S9's own
     strobe, which is lit for eight per cent of a beat, anything wider walked
     the phase into the dark part and put a flat black frame on one cut in six.
     The fix then was to sample INSIDE a flash — which is exactly what made the
     crowd read as fully lit, and that was the next note. A flashback now gets
     its own light: a dim base that is always there with a fast pulse on top
     (see FB_HZ in s09-dark.js). There is no dark part to land in any more, so
     the window can be opened until the pulse actually runs inside a cut.
     0.55 and not more because bar 86.5 plus 0.9 s reaches this scene's closing
     blaze, and a flashback that arrives already white is not a flashback. */
  { id: 'dark',     make: (tl) => new DarkScene(tl),
    ats: (tl) => [81, 83, 85, 86.5].map(b => tl.timeOfBar(b) + 0.004),  dur: 0.55,
    shot: { flashback: true } },
  /* And one of the island vantages is a MOVE rather than an instant.
     'Voisi esim. olla vesiputousta kohti niin etta vesiputouksen alta noustaan
     ja kiihdytetaan nopeasti jokea pitkin jarvelle.' Everything else in this
     table is a moment on a camera move the scene already makes; this shot is
     not in the scene, so IslandsScene authors it and this is where it is
     named. `at` still picks the instant the WORLD is shown at — the water,
     the light, the lit island — and the move only replaces the camera. */
  { id: 'islands',  make: (tl) => new IslandsScene(tl),
    ats: (tl) => [96.5, 102.6, 107.3, 110.5].map(b => tl.timeOfBar(b)), dur: 2.4,
    moves: (tl) => [{ at: tl.timeOfBar(101.4), cam: 'fall' }] },
  { id: 'desert',   make: (tl) => new DesertScene(tl),
    ats: (tl) => [166].map(b => tl.timeOfBar(b)),  dur: 2.4 },
  /* Bar 43 is gone, and it is worth saying why, because it is the same fault
     the dark world's `dur` was. A vantage is not an instant here — it is an
     instant plus `dur` of that scene's own clock — so it has to be legible for
     the whole window and not only at its start. Bar 43 plus 1.4 s lands at
     72.15, which is inside S4's arrival: the passage blows out into the jungle
     over its last second, and measured at that instant the frame was a flat
     0.84 grey, sd 15. One cut in S14 was a white card. The other three are
     spaced to leave the last two bars of the passage alone. */
  { id: 'tunnel',   make: (tl) => new PassageScene(tl),
    ats: (tl) => [34, 37, 40, 42].map(b => tl.timeOfBar(b)), dur: 1.4 }
];

/** Build the named worlds, in the order named. */
export function makeWorlds(tl, ids){
  return ids.map(id => {
    const w = WORLDS.find(x => x.id === id);
    if (!w) throw new Error('unknown world: ' + id);
    const ats = w.ats(tl);
    const moves = w.moves ? w.moves(tl) : [];
    return { id, scene: w.make(tl), ats, at: ats[0], dur: w.dur, shot: w.shot,
             moves, views: ats.length + moves.length };
  });
}

/** Draw one world into the frame, and hand back its scene and camera.
 *
 *  `phase` 0..1 walks that world's own clock across its `dur`, so a cut can
 *  hold a moving picture rather than a still. At phase 0 it is exactly the
 *  frame `at` names, which is what the flash scenes want.
 *
 *  The aspect fix is not optional: main.js only sets a camera's aspect when
 *  the SCENE changes, and from its point of view none of these scenes ever
 *  does — so a swapped-in camera keeps whatever its own constructor gave it,
 *  and every cut would be squeezed at any output shape but 16/9. */
export function drawWorld(w, post, aspect, phase = 0, view = 0, now = 0){
  /* `view` picks the vantage point; phase then walks that world's own clock
     forward from it. Default 0, so a caller that only ever shows a world once
     — S8's five doors, S13's three chambers — is unchanged and keeps the
     property that a cut to a world is the same picture every time. */
  const ats = w.ats || [w.at];
  const moves = w.moves || [];
  const n = ats.length + moves.length;
  const k = ((view % n) + n) % n;
  if (k < ats.length){
    /* `shot` is how a world says that being LOOKED BACK AT is a different
       state from being in — the dark world lights itself differently for a
       flashback than for its own eight bars. Undefined for every world that
       has nothing to say about it, which is all of them but one.

       `now` is the CALLER'S clock and not the world's, and the distinction
       matters: a cut's phase advances 0.55 across the cut, so a world whose
       window is 0.55 s runs at a fifth of real speed inside a bar-length cut
       and at half again above it inside an eighth-length one — an eight-fold
       range. Anything that has to be seen at a rate, a strobe above all, has
       to be driven from the room's time rather than from the memory's. */
    w.scene.update(ats[k] + phase*w.dur, post, w.shot && { ...w.shot, now });
  } else {
    /* A move. The world's own clock still runs across `dur` — the water has to
       be moving, or a shot that flies up a river photographs a photograph —
       and `phase` doubles as the position along the move. Which means a cut
       lands somewhere different along it every time, and the several cuts a
       scene makes to this world show the rise, the crossing and the run
       rather than three copies of one of them. */
    const m = moves[k - ats.length];
    w.scene.update(m.at + phase*w.dur, post, { ...w.shot, cam: m.cam, u: phase, now });
  }
  const cam = w.scene.camera;
  if (cam.aspect !== aspect){ cam.aspect = aspect; cam.updateProjectionMatrix(); }
  return { scene: w.scene.scene, camera: cam, refractScene: w.scene.refractScene };
}
