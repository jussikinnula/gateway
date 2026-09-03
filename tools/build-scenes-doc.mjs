/* Generates SCENES.md from scenes.json + analysis.json + lyrics.json.
 *
 * The design document and the machine-readable shot list are the same thing on
 * the previous project, and they drifted: a bar number nudged in one and not the
 * other, and the render followed the file nobody was reading. Here the prose is
 * generated, so there is exactly one copy of every bar number in the film.
 *
 *   npm run scenes
 */
import fs from 'node:fs';

const a = JSON.parse(fs.readFileSync('analysis.json', 'utf8'));
const d = JSON.parse(fs.readFileSync('scenes.json', 'utf8'));
const lyr = JSON.parse(fs.readFileSync('lyrics.json', 'utf8')).lyrics || [];
const sect = JSON.parse(fs.readFileSync('structure.json', 'utf8')).sections || [];

const O = a.grid_origin, BS = a.bar_sec;
const tOf = b => O + (b - 1) * BS;
const clock = x => `${Math.floor(x/60)}:${(x%60).toFixed(2).padStart(5,'0')}`;
const span = s => `bars ${s.bar}–${s.end - 1} · ${clock(tOf(s.bar))}–${clock(tOf(s.end))} · ${s.end - s.bar} bars, ${(tOf(s.end)-tOf(s.bar)).toFixed(1)} s`;
const sectionOf = b => (sect.find(x => b >= x.bar && b < x.end) || {}).name || '—';
const cuesIn = (b, e) => lyr.filter(c => c.bar >= b && c.bar < e);

const L = [];
L.push(`# Gateway — scenes\n`);
L.push(`The design document. **Generated from \`scenes.json\` by \`npm run scenes\` — edit the`);
L.push(`JSON, never this file.** Every bar number here appears exactly once in the project.\n`);
L.push(`${d.scenes.length} scenes, ${d.shots.length} shots, ${a.total_bars} bars, ${clock(a.duration)}, ${a.bpm.toFixed(3)} BPM.\n`);

L.push(`## The two registers\n`);
L.push(`Every shot is one of two things, and the difference is carried by movement and`);
L.push(`grade rather than by geometry:\n`);
L.push(`**TRANSIT** — inside the gateway. The membrane seen from underneath, and the`);
L.push(`tunnel of light beyond it. Forced perspective, motion along a single axis, roll,`);
L.push(`saturated colour that changes by phrase, heavy bloom and chromatic aberration.`);
L.push(`The camera is always going somewhere and always arrives.\n`);
L.push(`**WORLD** — being in a place. Slower, wider, atmospheric. Height fog, volumetric`);
L.push(`light, motion that is motivated by something in the frame. The camera looks`);
L.push(`rather than travels.\n`);
L.push(`There is no third register and no visible traveller. The viewer is the traveller;`);
L.push(`nothing in the film ever cuts away to look at them. That is what keeps five`);
L.push(`worlds from being a slideshow — the constant is not a character, it is a pair of`);
L.push(`eyes with two ways of behaving.\n`);

L.push(`## Shape\n`);
L.push(`Five worlds, four passages, and an ending that does not resolve.\n`);
L.push(`The three hook entries are the spine: **bar 38.02**, **bar 88.00** and **bar`);
L.push(`144.00**, each a measured vocal attack that lands on a bar line. The hook is`);
L.push(`always sung *inside* the tunnel, never in a world, and \`Into the light\` is`);
L.push(`always the exit. The fourth passage is the two-bar inserted break at bars 78–79,`);
L.push(`where five \`Gateway\` shouts a beat and a half apart become five membranes in`);
L.push(`five seconds.\n`);
L.push(`The passages get shorter and worse: fourteen bars, then eight, then six, then`);
L.push(`three. By the last one the tunnel does not work.\n`);

L.push(`## Scenes\n`);
L.push(`| | scene | register | bars | time | section |`);
L.push(`|---|---|---|---|---|---|`);
for (const s of d.scenes)
  L.push(`| ${s.id} | ${s.name} | ${s.reg} | ${s.bar}–${s.end-1} | ${clock(tOf(s.bar))} | ${sectionOf(s.bar)} |`);
L.push('');

for (const s of d.scenes){
  L.push(`---\n`);
  L.push(`## ${s.id} — ${s.name}\n`);
  L.push(`**${span(s)}** · ${s.reg} · ${sectionOf(s.bar)}  `);
  L.push(`*${s.place}*\n`);
  L.push(`${s.idea}\n`);
  L.push(`**Tech.** ${s.tech}\n`);
  const shots = d.shots.filter(x => x.sceneId === s.id);
  for (const sh of shots){
    L.push(`### ${sh.bar}–${sh.end - 1} · ${sh.name}  <sub>${clock(tOf(sh.bar))}–${clock(tOf(sh.end))}</sub>\n`);
    L.push(`${sh.desc}\n`);
    L.push(`- **Camera.** ${sh.cam}`);
    if (sh.sync) L.push(`- **Sync.** ${sh.sync}`);
    const c = cuesIn(sh.bar, sh.end);
    if (c.length) L.push(`- **Cues.** ` + c.map(x => `${x.text} (bar ${x.bar.toFixed(2)})`).join(' · '));
    L.push('');
  }
}

L.push(`---\n`);
L.push(`## Rules that outrank anything above\n`);
L.push(`**Every frame is a pure function of its index.** No clock, no accumulator, no`);
L.push(`\`Math.random\` in the frame path. Speed ramps, cut rates and strobes are all`);
L.push(`derived from the bar grid, so a range rendered on six pages is identical to the`);
L.push(`same range rendered on one. This is checkable — see README — and it has been`);
L.push(`broken twice on the previous project, both times invisibly.\n`);
L.push(`**Nothing that pulses with the beat may touch geometry or global brightness.**`);
L.push(`One exception, declared here: the strobe in S9 *is* global brightness, because`);
L.push(`the strobe is the scene. Everywhere else, beat response belongs in things that`);
L.push(`are already local and already moving.\n`);
L.push(`**Cuts land on bar lines.** The only cuts inside a bar are the five flashes in`);
L.push(`S8, the three in S12 and the eighth-note run in S14, and all of those are on`);
L.push(`measured cue or grid times taken from \`timeline.json\`.\n`);
L.push(`**No timing is hard-coded in a scene file.** Scenes read \`timeline.json\` and`);
L.push(`derive bar numbers, beat phase and measured energy from it. If a number in this`);
L.push(`document is wrong, it is wrong in \`scenes.json\` and nowhere else.\n`);
L.push(`## Build order\n`);
L.push(`S4 first — it is the only scene three others reuse, and if the tunnel is not`);
L.push(`good the film has no spine. Then S5, because the jungle is the hardest`);
L.push(`environment and everything after it is cheaper. Then S1–S3 as one block, since`);
L.push(`they share the water column with S4's membrane. Then the worlds in order of`);
L.push(`cost: S17 desert, S12 void, S9 dark, S7 volcanic, S11 islands. S13 and S14 come`);
L.push(`last because they need every environment to exist first.\n`);
L.push(`Delete \`src/scenes/s00-portal-test.js\` when S4 runs.\n`);

fs.writeFileSync('SCENES.md', L.join('\n'));
console.log(`SCENES.md: ${d.scenes.length} scenes, ${d.shots.length} shots`);
