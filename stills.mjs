/* Single frames from one scene, straight to PNG.

   render.mjs renders a continuous range for encoding; this renders a handful of
   chosen instants, which is what checking a shot actually needs. It also fails
   loudly on shader errors — a program that does not compile draws whatever the
   last valid one left behind, and that has cost several rounds of tuning a
   parameter that was not connected to anything.

     node stills.mjs --scene S8 --t 148.46,150.22,151.99 --out stills

   Times are seconds. Use timeline.html to turn bars into seconds, or
   0.2215 + (bar - 1)*1.764706. */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--'+k); return i>0 ? process.argv[i+1] : d; };
const SCENE = arg('scene', 'S4');
const TIMES = arg('t', '').split(',').filter(Boolean).map(Number);
const OUT = arg('out', 'stills');
const W = +arg('w', 1280), H = +arg('h', 720), FPS = +arg('fps', 60);
const EXEC = process.env.CHROMIUM_PATH || undefined;

if (!TIMES.length){ console.error('nothing to render: pass --t 148.46,150.22'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const server = await createServer({ server:{ port: 5201, host:'127.0.0.1' }, logLevel:'warn' });
await server.listen();

const launch = { args:['--use-gl=angle','--use-angle=swiftshader',
                       '--enable-unsafe-swiftshader','--hide-scrollbars',
                       '--force-device-scale-factor=1'] };
let browser;
try { browser = await chromium.launch(EXEC ? { ...launch, executablePath: EXEC } : launch); }
catch { browser = await chromium.launch({ channel:'chrome', args: launch.args }); }

const page = await browser.newPage({ viewport:{ width:W, height:H }, deviceScaleFactor:1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 220)));
page.on('console', m => { const s = m.text(); if (/ERROR:|INVALID_/.test(s)) errs.push(s.slice(0, 220)); });

await page.goto(`http://127.0.0.1:5201/?render=1&w=${W}&h=${H}&fps=${FPS}&s=${SCENE}`, { waitUntil:'load' });
/* And if it never becomes ready, say WHY.
   A syntax error anywhere in the module graph — a stray backtick inside a GLSL
   comment has now done this twice — means main.js never runs, __ready is never
   set, and the only thing this script used to print was 'Timeout 60000ms
   exceeded' with an empty log. That is a tool reporting that something is
   wrong while withholding the one line that says what, which this project has
   already paid for once in check-scenes.mjs. The page errors are right there;
   print them. */
try {
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
} catch (e) {
  console.error('the page never became ready.');
  if (errs.length) for (const x of errs) console.error('  ' + x);
  else console.error('  ...and reported no error, so suspect the dev server or the URL.');
  await browser.close(); await server.close(); process.exit(1);
}

const MUTE = arg('mute', ''), SOLO = arg('solo', ''), DBG = arg('dbg', '');
if (DBG) await page.evaluate(n => {
  const walk = o => { if (o.material && o.material.uniforms && o.material.uniforms.uDebug)
                        o.material.uniforms.uDebug.value = n;
                      (o.children||[]).forEach(walk); };
  walk(window.__sceneObj.scene);
}, +DBG);
if (MUTE) console.log('  layers:', await page.evaluate(n => window.__mute(n), MUTE));
if (SOLO) console.log('  layers:', await page.evaluate(n => window.__solo(n), SOLO));
const TAG = MUTE ? `_no-${MUTE}` : SOLO ? `_only-${SOLO}` : DBG ? `_dbg${DBG}` : '';

const canvas = page.locator('#c');
for (const t of TIMES){
  await page.evaluate(n => window.__renderFrame(n), Math.round(t*FPS));
  const file = path.join(OUT, `${SCENE}_${t.toFixed(2)}${TAG}.png`);
  await canvas.screenshot({ path: file });
  console.log('  ', file);
}

const uniq = [...new Set(errs)];
console.log(uniq.length ? 'SHADER/PAGE ERRORS:\n  ' + uniq.slice(0, 8).join('\n  ') : 'errors: none');
await browser.close();
await server.close();
process.exit(uniq.length ? 1 : 0);
