/* Regenerates lyrics.srt from lyrics.json.
   The subtitle file and the renderer read the same cue list, so this keeps the
   YouTube captions from drifting away from the video whenever a cue is nudged. */
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const IN  = arg('in', 'lyrics.json');
const OUT = arg('out', 'lyrics.srt');

const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));
const cues = (raw.lyrics ?? raw).slice().sort((a, b) => a.t - b.t);
if (!cues.length){
  console.error(`${IN} has no cues yet — nothing to write. Run the analysis pass first (docs/ANALYSIS-PLAN.md).`);
  process.exit(1);
}

const stamp = t => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const f = ms % 1000;
  const p = (v, n = 2) => String(v).padStart(n, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(f, 3)}`;
};

/* How long a caption stays up after the line has been spoken.

   The cue list holds the times the WORDS occupy, which is the right thing for
   the renderer and the wrong thing for a reader: a caption that leaves on the
   last syllable was never on screen long enough to be read, only long enough to
   be noticed. Broadcast practice is a lead-out of about half a second plus a
   floor that scales with how much there is to read.

   LEAD_OUT is held on after the audio ends; MIN_HOLD is the floor for a cue of
   no length at all; CPS is the reading rate the floor is computed at — 17
   characters a second is the conservative end of the usual 15–20, and these are
   German aviation phrases being read by people who may not speak German. */
const LEAD_OUT = 0.55, MIN_HOLD = 1.45, CPS = 17, GAP = 0.08;

const body = cues.map((c, i) => {
  const next = cues[i + 1];
  const spoken = (c.e ?? c.t + 1.2) - c.t;
  const readable = Math.max(MIN_HOLD, c.text.length/CPS + 0.45);
  let end = c.t + Math.max(spoken + LEAD_OUT, readable);
  // never run into the next cue: two frames of daylight between them
  if (next) end = Math.min(end, next.t - GAP);
  return `${i + 1}\n${stamp(c.t)} --> ${stamp(end)}\n${c.text}\n`;
}).join('\n');

fs.writeFileSync(OUT, body, 'utf8');
console.log(`${OUT}: ${cues.length} cues, ${cues[0].t.toFixed(2)}s .. ${cues.at(-1).t.toFixed(2)}s`);
