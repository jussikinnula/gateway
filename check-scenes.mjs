/* Does every second of the film draw the scene it is supposed to?
 *
 * Every other way of looking at this project — the preview buttons, the stills
 * tool, every check in the build log — looks at one scene at a time. On the
 * previous project that let a full render ship four minutes of the wrong scene,
 * because nothing had ever asked the renderer to cross a scene boundary.
 *
 *   npm run check
 *
 * Add project-specific assertions below the dispatch check as they earn their
 * place: camera-vs-terrain clearance, a path that must stay inside a tunnel,
 * anything that is true of the whole film and checked in no single shot. */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server:{ port:5271, host:'127.0.0.1' }, logLevel:'warn' });
await server.listen();
const EXEC = process.env.CHROMIUM_PATH;
const b = await chromium.launch({ ...(EXEC?{executablePath:EXEC}:{}),
  args:['--use-angle=default','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{ width:320, height:180 } });
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,160)));
await p.goto('http://127.0.0.1:5271/?render=1&w=320&h=180&fps=60', { waitUntil:'load' });
await p.waitForFunction('window.__ready === true', null, { timeout:60000 });

const rows = await p.evaluate(async () => {
  const out = [];
  const scenes = window.__sceneObj.tl.d.scenes || [];
  for (const sc of scenes){
    const t = (sc.t + sc.tEnd)/2;
    window.__renderFrame(Math.round(t*60));
    out.push({ want: sc.id, t:+t.toFixed(1), got: window.__sceneKey });
  }
  return { rows: out, covered: window.__coveredBy || {} };
});

/* Read from the page, never mirrored here: one copy of the mapping. */
const OWN = rows.covered;
let bad = 0;
for (const r of rows.rows){
  const expect = OWN[r.want] || r.want;
  const ok = r.got === expect;
  if (!ok) bad++;
  console.log(`${r.want.padEnd(4)} t=${String(r.t).padStart(6)}  ->  ${String(r.got).padEnd(4)} ${ok?'ok':'MISMATCH expected '+expect}`);
}
console.log(bad ? `${bad} MISMATCHES`
                : `all ${rows.rows.length} authored scenes dispatch to the right builder`);
console.log('page errors:', errs.length ? errs.slice(0,3) : '(none)');
await b.close(); await server.close();
process.exit(bad ? 1 : 0);
