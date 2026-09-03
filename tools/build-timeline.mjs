/* Merges the four authored data files into the one file the runtime reads.
 *
 *   analysis.json    bar grid + measured per-bar energy   (produced by the analysis pass)
 *   structure.json   sections of the song, in bars        (authored, from the analysis)
 *   scenes.json      scenes and shots, in bars            (authored, the design document)
 *   lyrics.json      verified vocal cue times            (produced by the analysis pass)
 *        ->          timeline.json
 *
 * Everything downstream — the preview, the renderer, every scene file — reads
 * timeline.json and nothing else, so there is exactly one place a bar number
 * turns into a time, and the plan and the render cannot drift apart.
 *
 *   npm run timeline
 */
import fs from 'node:fs';

const read = (f, dflt) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : dflt;
const a = read('analysis.json', null);
if (!a) { console.error('analysis.json is missing — run the analysis pass first (see docs/ANALYSIS-PLAN.md)'); process.exit(1); }

const origin = a.grid_origin, barSec = a.bar_sec, beat = a.beat, duration = a.duration;
const tOf = bar => +(origin + (bar - 1) * barSec).toFixed(4);
const span = o => ({ ...o, t: tOf(o.bar), tEnd: tOf(o.end), bars: o.end - o.bar });

const structure = read('structure.json', { sections: [] });
const design    = read('scenes.json',    { scenes: [], shots: [] });
const lyr       = read('lyrics.json',    { lyrics: [] });

const out = {
  file: a.file || '(track)',
  bpm: a.bpm, beat, barSec, gridOrigin: origin, duration,
  totalBars: a.total_bars ?? Math.floor((duration - origin)/barSec) + 1,
  peaks: a.peaks || [],
  bars: a.bars || [],
  sections: (structure.sections || []).map(span),
  scenes:   (design.scenes   || []).map(span),
  shots:    (design.shots    || []).map(span),
  lyrics:   (lyr.lyrics ?? lyr) || []
};

/* Assertions worth having, because every one of them has been wrong before:
   a cut inside a bar, a scene that outlives the track, a shot outside its
   scene, a lyric cue past the end. */
const problems = [];
for (const s of [...out.scenes, ...out.shots, ...out.sections]){
  if (s.end <= s.bar) problems.push(`${s.id || s.name}: end bar ${s.end} is not after start bar ${s.bar}`);
  if (s.tEnd > duration + 0.01) problems.push(`${s.id || s.name}: runs to ${s.tEnd}s, past the track's ${duration.toFixed(2)}s`);
}
for (const sh of out.shots){
  const sc = out.scenes.find(x => x.id === sh.sceneId);
  if (!sc) { problems.push(`shot "${sh.name}" names scene ${sh.sceneId}, which does not exist`); continue; }
  if (sh.bar < sc.bar || sh.end > sc.end) problems.push(`shot "${sh.name}" (bars ${sh.bar}–${sh.end}) falls outside ${sc.id} (${sc.bar}–${sc.end})`);
}
for (let i = 1; i < out.scenes.length; i++){
  if (out.scenes[i].bar !== out.scenes[i-1].end)
    problems.push(`gap or overlap between ${out.scenes[i-1].id} (ends ${out.scenes[i-1].end}) and ${out.scenes[i].id} (starts ${out.scenes[i].bar})`);
}
for (const c of out.lyrics){
  if (c.t > duration) problems.push(`lyric cue "${c.text}" at ${c.t}s is past the end of the track`);
}
if (problems.length){ console.error('timeline.json NOT written:'); problems.forEach(p => console.error('  ' + p)); process.exit(1); }

fs.writeFileSync('timeline.json', JSON.stringify(out, null, 1));
console.log(`timeline.json: ${out.totalBars} bars, ${out.sections.length} sections, ` +
            `${out.scenes.length} scenes, ${out.shots.length} shots, ${out.lyrics.length} lyric cues`);
