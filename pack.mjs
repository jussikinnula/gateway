/* Builds a single self-contained preview.html that runs from file:// —
   JS bundle and timeline data inlined, audio referenced next to it.
   This is the right way to review a scene: it runs in real time on a GPU. */
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k,d)=>{ const i=process.argv.indexOf('--'+k); return i>0?process.argv[i+1]:d; };

/* npm eats its own flags.
 *
 *   npm run pack -- --scene S0     the -- passes it through; process.argv has it
 *   npm run pack --scene=S0        npm keeps it, and sets npm_config_scene=S0
 *   npm run pack --scene S0        npm keeps the FLAG and passes S0 as an arg,
 *                                  so npm_config_scene is the string "true"
 *
 * All three are things a person will reasonably type, and two of them used to
 * be silently ignored — the pack ran, said nothing, and opened on whatever
 * package.json declared. */
function requestedScene(){
  const fromArgv = arg('scene', null);
  if (fromArgv) return { id: fromArgv, via: '--scene' };
  const env = process.env.npm_config_scene;
  if (env && env !== 'true') return { id: env, via: 'npm --scene=' };
  if (env === 'true'){
    /* npm swallowed the flag; the value is sitting in argv on its own. */
    const rest = process.argv.slice(2).filter(a => !a.startsWith('--'));
    if (rest.length) return { id: rest[0], via: 'npm --scene (value recovered)' };
  }
  return null;
}

function declaredScene(){
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return pkg.preview && pkg.preview.scene;
  } catch { return null; }
}
/* Which scene the preview opens on is written down in package.json rather than
   inferred from mtime: a checkout, a download or a sync rewrites every mtime at
   once, and "the last file edited" is then whatever landed last. */
const DECLARED = declaredScene();
const REQ = requestedScene();
const SCENE = REQ ? REQ.id : (DECLARED || 'S0');
const OUT   = arg('out', path.resolve('preview.html'));

await build({ logLevel: 'warn' });

const distHtml = fs.readFileSync('dist/index.html', 'utf8');
const m = distHtml.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/);
if (!m) throw new Error('bundle script tag not found in dist/index.html');
const js = fs.readFileSync(path.join('dist', m[1].replace(/^\//,'')), 'utf8');

/* Refresh the served copy from the source first.

   The runtime reads /data/timeline.json, which setup.mjs copies out of the
   repository root — so there are two copies of the timeline and only one of
   them is ever edited. Change a scene boundary in the root file and everything
   agrees except the thing that actually runs. Two files and a few milliseconds
   buys the guarantee that the preview cannot be packed against stale data. */
fs.mkdirSync('public/data', { recursive: true });
for (const f of ['timeline.json', 'lyrics.json']){
  const src = path.resolve(f), dst = path.join('public/data', f);
  if (!fs.existsSync(src)) continue;
  const a = fs.statSync(src).mtimeMs;
  const b = fs.existsSync(dst) ? fs.statSync(dst).mtimeMs : -1;
  if (a > b){ fs.copyFileSync(src, dst); console.log('data  ->', f, '(refreshed from the root)'); }
}

const data = fs.readFileSync('public/data/timeline.json', 'utf8');
const root = path.resolve('.');
const mp3 = fs.readdirSync(root).find(f => f.toLowerCase().endsWith('.mp3')) || 'track.mp3';

// a bare </script> inside the bundle would close the tag early
const safeJs   = js.replace(/<\/script/gi, '<\\/script');
const safeData = data.replace(/<\/script/gi, '<\\/script');

const tail =
  `<script>window.__TIMELINE__=${safeData};` +
  `window.__SCENE__=${JSON.stringify(SCENE)};` +
  /* Stamped so the preview can say when it was packed: an already-open file://
     page does not reload itself, and "is this the new one?" has no other answer
     on screen. */
  `window.__BUILT__=${JSON.stringify(
      new Date().toISOString().slice(0,16).replace('T',' '))};` +
  `window.__AUDIO__=${JSON.stringify(encodeURIComponent(mp3))};</script>\n` +
  `<script type="module">\n${safeJs}\n</script>\n</body>`;

// NOTE: the replacement must be a function — a string replacement would treat
// $&, $' and $` inside the minified bundle as substitution directives.
const html = distHtml.replace(m[0], () => '').replace('</body>', () => tail);

fs.writeFileSync(OUT, html);
console.log(`preview -> ${OUT}`);
console.log(`   opens on ${SCENE}` +
            (REQ ? ` (from ${REQ.via})` : ` (from package.json preview.scene)`) +
            `, audio "${mp3}" (must sit in the same folder)`);
console.log(`   ${(html.length/1024).toFixed(0)} kB, no server needed`);
