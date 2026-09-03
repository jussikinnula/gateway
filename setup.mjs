/* Copies the track and the timeline data into public/ so the dev server and the
   offline renderer can serve them. Keeps the 11 MB audio file out of git. */
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('.');
fs.mkdirSync('public/data', { recursive: true });
const mp3 = fs.readdirSync(root).find(f => f.toLowerCase().endsWith('.mp3'));
if (!mp3) {
  console.error(`No .mp3 found in ${root}.`);
  console.error('The track is not part of this repository — see README.md.');
  process.exit(1);
}
fs.copyFileSync(path.join(root, mp3), 'public/track.mp3');
console.log('track ->', mp3);
for (const f of ['timeline.json', 'lyrics.json']) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join('public/data', f)); console.log('data  ->', f); }
  else console.warn('missing (skipped):', f);
}
