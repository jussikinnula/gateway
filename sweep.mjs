/* One frame per shot block, rendered through the TIMELINE dispatch — the same
   path the master render uses — rather than by selecting each scene by hand.
   That is the difference that matters: the per-scene preview reads the scene
   registry, the film reads the scene TABLE, and only the second one can be
   stale. */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
const OUT = process.argv[2] || '/tmp/sweep';
fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({ root:'/root/repo', server:{port:5229, host:'127.0.0.1'}, logLevel:'warn' });
await server.listen();
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars'] });
const p = await b.newPage({ viewport:{width:960,height:540} });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (/ERROR:|INVALID_/.test(m.text())) errs.push(m.text().slice(0,200)); });
await p.goto(`http://127.0.0.1:5229/?render=1&w=960&h=540&fps=60`, {waitUntil:'load'});
await p.waitForFunction('window.__ready === true', null, {timeout:60000});
const bar = n => 0.2215 + (n-1)*1.764706;
const map = [];
const BARS = [2, 8, 12, 18, 24, 29, 34, 40, 44, 46.4, 49.5, 53, 57, 60, 65, 70, 76, 81,
              84, 88, 93, 97, 100, 105, 110, 113.5, 116, 118, 120, 121.6, 122.6,
              124, 127, 130, 133, 141, 148, 152, 154.8, 157];
for (const bn of BARS){
  const t = bar(bn);
  const d = await p.evaluate((t) => {
    window.__renderFrame(Math.round(t*60));
    return document.getElementById('c').toDataURL('image/png');
  }, t);
  const id = await p.evaluate(() => window.__sceneObj.constructor.name.replace('Scene',''));
  fs.writeFileSync(`${OUT}/${String(bn).padStart(6,'0')}_${id}.png`, Buffer.from(d.split(',')[1],'base64'));
  map.push([bn, id]);
}
/* The mapping is the point, not the pictures. A scene boundary that moved in
   the source and not in the served copy of the timeline shows up here as the
   wrong name against a bar number, which is the one failure mode that every
   other check in this project is blind to — they all read the source of truth,
   and the film reads the copy. */
console.log('  bar      scene');
for (const [bn, id] of map) console.log(`  ${String(bn).padEnd(7)}  ${id}`);
console.log('frames:', BARS.length, ' errors:', errs.length ? errs.slice(0,6) : '(none)');
await b.close(); await server.close();
