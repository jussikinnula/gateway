import { chromium } from 'playwright';
import { createServer } from 'vite';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* Offline render, straight into ffmpeg.
 *
 * This used to write a PNG per frame into a directory and mux them afterwards.
 * At the new default size that is 4–6 MB a frame and about 80 GB for one pass of
 * the film — all of it written, read back once and deleted. The frames now go
 * into ffmpeg's stdin as they come off the canvas: no directory, no second pass
 * over the disk, and no discovering at minute forty that the volume is full.
 *
 * `--png <dir>` puts the old sink back. Not as a fallback — as the tool for
 * checking that a render is reproducible, which is the one precondition all of
 * this rests on (see the note on JOBS below).
 */

const arg = (k, d) => { const i = process.argv.indexOf('--'+k); return i>0 ? process.argv[i+1] : d; };
const has = k => process.argv.includes('--'+k);

/* 2560x1440 by default.
 *
 * Not for the pixels — for what YouTube does with them. It decides what to
 * spend from the resolution it is given: 1080p is served as H.264 on a low
 * fixed budget, 1440p and above get VP9 or AV1 and several times the bitrate.
 * A viewer watching the 1440p file in a 1080p window sees a better picture than
 * the same shot uploaded at 1080p, and the player's downscale is also, free,
 * most of the supersample that --ss 2 would otherwise cost four times the
 * render time to produce. */
const W = +arg('w', 2560), H = +arg('h', 1440), FPS = +arg('fps', 60);
/* Supersampling. At 1x the seeker register's lines are at the physical minimum
   of one pixel and there is nothing left to make them finer with — rendering
   larger and filtering down is the only lever. Much less necessary now that the
   default is 1440: try one bar both ways before paying for it. */
const SS = Math.max(1, Math.min(4, +arg('ss', 1)));
const RW = W*SS, RH = H*SS;
const FROM = +arg('from', 0), TO = +arg('to', 0);          // seconds
const OUT = arg('out', 'gateway.mp4');
const PNG_DIR = arg('png', '');                            // set = old behaviour
const AUDIO = arg('audio', 'public/track.mp3');
const CRF = arg('crf', '14');
const PRESET = arg('preset', 'slow');
const KEEP = has('keep');                                  // keep the part files

/* How many pages render at once.
 *
 * Every frame in this project is a pure function of its index, so frames are
 * independent and the order they are produced in cannot change what they are.
 * That is what makes this free — and it is a real precondition, not a boast:
 * `--png` two ranges at --jobs 1 and --jobs 6 and diff them, and if they differ
 * something in a scene is integrating over time and this whole script is
 * producing a subtly different film every run.
 *
 * It is worth doing because the per-frame cost is not the drawing. On a 4060 Ti
 * the whole film rendered at about 5 fps whether it drew two million pixels a
 * frame or eight — the time goes into encoding the PNG, shipping it out of the
 * browser and encoding it, all of which is per-page serial work on a machine
 * with a lot of idle cores. */
const JOBS = Math.max(1, Math.min(16,
  +arg('jobs', Math.max(1, Math.min(6, Math.floor(os.cpus().length/4))))));
const EXEC = process.env.CHROMIUM_PATH || undefined;

const first = Math.round(FROM*FPS), last = Math.round(TO*FPS);
if (last < first){ console.error('nothing to render: --to must be after --from'); process.exit(1); }
/* A bare invocation renders ONE frame and exits in about a second, which from
   the outside is indistinguishable from a renderer that failed to start — and
   that is exactly what it looked like when npm swallowed the argument
   separator on Windows PowerShell and the flags never arrived here at all.
   Same fault class as the debug tool that reported success while doing
   nothing: a tool that does nothing has to say so. */
if (last === first && !has('scene')){
  console.warn(`\n  ---------------------------------------------------------------\n` +
    `  NOTE: no time range given, so this renders ONE frame at ${FROM}s.\n` +
    `  If you meant to render a span, --from/--to did not reach this script.\n` +
    `  On Windows PowerShell 'npm run render -- --from ...' can lose the --,\n` +
    `  so call it directly instead:  node render.mjs --from A --to B --out x.mp4\n` +
    `  ---------------------------------------------------------------\n`);
}
if (PNG_DIR) fs.mkdirSync(PNG_DIR, { recursive: true });

const server = await createServer({ server:{ port: 5199, host:'127.0.0.1' }, logLevel:'warn' });
await server.listen();
const SCENE = arg('scene', '');
// without this the renderer could only ever produce S4, whatever --from said
const url = `http://127.0.0.1:5199/?render=1&w=${RW}&h=${RH}&fps=${FPS}`
          + (SCENE ? `&s=${SCENE}` : '');

/* GPU or software.

   This script used to force `--use-angle=swiftshader`, which pins Chromium to
   its software rasteriser. That is right on a machine with no GPU and wrong on
   one with a GPU: the shaders in this project are cheap for any modern card and
   ruinous for a CPU.

   `--gpu off` keeps the old behaviour. The default asks ANGLE for its own best
   backend — D3D11 on Windows, which is the GPU — and still allows the software
   fallback, so the same command works on a laptop, a render box and a container
   with no display at all. Which one you actually got is printed below rather
   than assumed: the two differ by an order of magnitude in speed and by nothing
   at all in appearance, so there is no way to tell from the frames. */
const GPU = String(arg('gpu', 'on')).toLowerCase() !== 'off';
const GL_ARGS = GPU
  ? ['--use-angle=default', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const launchOpts = EXEC ? { executablePath: EXEC } : {};
let browser;
try {
  browser = await chromium.launch({ ...launchOpts,
    args: [...GL_ARGS, '--disable-lcd-text', '--hide-scrollbars',
           '--force-device-scale-factor=1'] });
} catch (e) {
  console.warn('Playwright Chromium not available, trying installed Chrome…');
  browser = await chromium.launch({ channel: 'chrome',
    args: [...GL_ARGS, '--hide-scrollbars', '--force-device-scale-factor=1'] });
}
/* The renderer report needs a page of its own only long enough to ask. */
const probe = await browser.newPage();
await probe.goto(url, { waitUntil:'load' });
const gl = await probe.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const d = c && c.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : (c ? 'unknown' : 'no context');
});
const soft = /swiftshader|software|llvmpipe/i.test(gl);
await probe.close();
console.log(`renderer: ${gl}${soft ? '   ← software; expect this to be slow' : ''}`);

/* Frames come out of the page as PNG data, not through Playwright's element
   screenshot.

   Measured at 1920x1080: element screenshot 1710 ms/frame, page screenshot
   79 ms, canvas.toDataURL 27 ms. The element path is sixty times the cost of
   asking the canvas for its own pixels, because it captures the page and crops
   rather than reading the element.

   This showed up as an absurdity in the field: on a 4060 Ti, `--ss 2` ran at
   5.5 fps and 1x ran at 2.2, so rendering FOUR TIMES the pixels was two and a
   half times faster. The supersampled path already went through the canvas; the
   1x path did not. Nothing about the renderer was slow — the capture was.

   Raw pixels are the tempting next step and they are a trap: gl.readPixels into
   a Uint8Array crosses the CDP bridge as JSON, and 2560x1440 RGBA is 14 MB a
   frame before any encoding. The PNG is 4–6 MB and ffmpeg reads it directly.

   At ss = 1 the draw is 1:1 and the canvas is only a courier. */
async function makePage(){
  const pg = await browser.newPage({ viewport:{ width:RW, height:RH }, deviceScaleFactor:1 });
  pg.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  pg.on('console', m => { if(m.type()==='error') console.error('CONSOLE:', m.text()); });
  await pg.goto(url, { waitUntil:'load' });
  await pg.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  await pg.evaluate(([w,h])=>{
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    /* alpha:false for the compositing, not for the file — Chromium still writes
       an RGBA PNG either way. That is harmless: the encoder converts to
       yuv420p, so ranges rendered at different settings still encode together. */
    const g = c.getContext('2d', { alpha: false });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    window.__grab = () => {
      g.drawImage(document.getElementById('c'), 0, 0, w, h);
      return c.toDataURL('image/png');
    };
  }, [W, H]);
  return pg;
}

const pages = [];
for (let i = 0; i < JOBS; i++) pages.push(await makePage());

const total = last - first + 1;
/* Contiguous blocks, not an interleaved queue.

   With no --scene the page follows the timeline and rebuilds when it crosses a
   scene boundary, so a page handed every sixth frame would rebuild the world
   several times a second. In blocks each page crosses a handful of boundaries in
   its whole run.

   Piping makes this decision load-bearing rather than merely tidy. A page
   producing a contiguous run feeds its OWN ffmpeg in order, which is why there
   is no reordering machinery anywhere below: the ordering problem is solved by
   the work split rather than by a pending map and a promise chain. The parts are
   concatenated at the end, which costs one pass with `-c copy`. */
const BLOCK = Math.max(1, Math.ceil(total/JOBS));

/* One encoder per block.

   -framerate before -i - is the INPUT rate and is what sets the timebase;
   after it, it would be an output filter and would drop or duplicate frames
   instead. Video only here — the audio is muxed once, at the concat, so it is
   never cut into pieces and rejoined.

   aq-mode 3 biases quantisation toward the dark parts of the frame, which on
   night footage is the single most useful encoder flag there is: without it
   x264 spends its bits on the exhaust and the windows and leaves the dark two
   thirds of every frame to band. */
function encoder(file){
  const ff = spawn('ffmpeg', [
    /* QUIET, and this is not cosmetic.

       x264 at this preset buffers about fifty frames before it emits one, so
       for the first minute of any render ffmpeg prints 'frame= 0 fps=0.0' —
       once a second, on the same line, forever. That line lands on top of THIS
       script's own progress, which is the only one that says anything true
       ('frame 25/781, eta 1584s'), and the part file on disk is 48 bytes of mp4
       header the whole time. Three independent signals, all of them saying the
       renderer is dead, while it is in fact working normally.

       It cost a round of debugging to find that out, on both sides. -nostats
       silences the counter; -loglevel error keeps anything that is actually
       wrong. */
    '-nostats', '-loglevel', 'error',
    '-y', '-f','image2pipe', '-framerate', String(FPS), '-i','-',
    '-an',
    '-c:v','libx264','-preset',PRESET,'-crf',CRF,'-pix_fmt','yuv420p',
    '-x264-params','aq-mode=3:aq-strength=1.0:bframes=3:ref=5',
    '-g', String(FPS*2), '-keyint_min', String(FPS),
    '-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709',
    file
  ], { stdio:['pipe','ignore','inherit'] });
  ff.on('error', e => { console.error('\nffmpeg failed to start:', e.message); process.exit(1); });
  return ff;
}

/* stdin.write returns false when the kernel buffer is full; ignoring that just
   moves the queue into Node's heap, which at 5 MB a frame is how a render ends
   as an out-of-memory kill four hours in. */
const write = (ff, buf) => new Promise(res => {
  if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res);
});

const parts = [];
let done = 0;
const t0 = Date.now();
let lastTick = 0;
/* Elapsed is printed too, and the line is refreshed on a CLOCK rather than
   only every twenty-fifth frame.
 
   Every 25 frames is fine at sixty frames a second and useless at one frame
   every eight seconds: the volcanic scene printed 'frame 25/781' and then said
   nothing for three minutes, which is indistinguishable from having stopped —
   and was reported as exactly that, twice, by two different people looking at
   the same output. A progress meter that only moves when the work is fast is
   a progress meter for work that did not need one. */
const tick = () => {
  lastTick = Date.now();
  const el = (Date.now()-t0)/1000, fps = done/el;
  /* HEAP on the progress line, because a renderer that dies of memory should
     show the memory going. A full render was killed by Node's four-gigabyte
     limit at frame 1012 and there was nothing in the output beforehand to say
     so; a number that climbs frame by frame turns that from an autopsy into
     something anyone can watch. Flat is healthy. Climbing steadily means
     roughly heap-growth-per-frame is being retained somewhere, and that
     number is the whole diagnosis. */
  const mb = process.memoryUsage().heapUsed/1048576;
  process.stdout.write(`\r  frame ${done}/${total}  ${fps.toFixed(2)} fps  ` +
                       `elapsed ${el.toFixed(0)}s  ` +
                       `eta ${((total-done)/Math.max(fps,1e-6)).toFixed(0)}s  ` +
                       `heap ${mb.toFixed(0)}MB   `);
};

await Promise.all(pages.map(async (pg, j) => {
  const lo = first + j*BLOCK, hi = Math.min(last, lo + BLOCK - 1);
  if (lo > hi) return;
  const part = PNG_DIR ? null : `${OUT}.part${j}.mp4`;
  const ff = part ? encoder(part) : null;
  if (part) parts[j] = part;
  for (let n = lo; n <= hi; n++){
    /* A WATCHDOG on every frame, because the failure this renderer actually
       has in the field is a silent stall: the page stops answering and this
       loop waits for a promise that will never settle, while the elapsed
       counter keeps climbing. There is no error, no exit code and no clue —
       and the two most common causes both look identical from here.
       
       One is a lost WebGL context: a draw call long enough to trip the
       graphics driver's watchdog gets the whole context reset, and every call
       after it does nothing forever. main.js reports that now (see the
       webglcontextlost handler there) and it arrives on the CONSOLE line
       above. The other is simply a frame slower than the timeout, which is
       what a heavy scene on a slow machine looks like, and the message below
       says which by telling you how long it waited.
       
       AND THE TIMER MUST BE CLEARED, or this watchdog is a four-megabyte
       per frame leak that kills a full render outright. It did: 'JavaScript
       heap out of memory' at frame 1012, 38 seconds in, on a render that had
       worked perfectly a few hours earlier — the difference being that this
       watchdog did not exist then.

       `guard` is declared INSIDE the loop body, in the same block scope as the
       frame's own data. V8 allocates one context object per scope, so the
       timer's closure — which needs `n` for its message — retains that whole
       context, and the frame's base64 data URL is sitting in it. Every frame
       therefore pinned one entire frame for the full timeout.

       This is worth stating carefully because the first attempt to prove it
       FAILED. An isolated reproduction showed no retention at all, and the
       explanation was nearly abandoned on that basis. The test was wrong: it
       declared the guard outside the loop, which removes the very scope
       sharing that causes the leak. Moved inside, the same test goes from
       60 MB to 1245 MB over 300 frames — 4 MB a frame, exactly.

       Ninety seconds is far longer than any frame should take and short enough
       that nobody watches a dead terminal for an hour. */
    const guard = (label, pr) => {
      let timer;
      const bomb = new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(
          `frame ${n} (t = ${(n/FPS).toFixed(3)}s) stalled: ${label} did not return in 90s.` + `\n` +
          `  If a WEBGL CONTEXT LOST line appeared above, the graphics driver reset` + `\n` +
          `  the context — one draw call was too long for this GPU, and nothing` + `\n` +
          `  renders after it, which is why it stops rather than slows.` + `\n` +
          `  If not, the frame is simply slower than 90s, or the page died without` + `\n` +
          `  printing anything; any PAGE ERROR line above is the next thing to read.`
        )), 90000);
      });
      return Promise.race([pr, bomb]).finally(() => clearTimeout(timer));
    };
    await guard('renderFrame', pg.evaluate(i => window.__renderFrame(i), n));
    const u = await guard('grab', pg.evaluate(() => window.__grab()));
    const buf = Buffer.from(u.slice(u.indexOf(',')+1), 'base64');
    if (PNG_DIR) fs.writeFileSync(path.join(PNG_DIR, String(n).padStart(6,'0')+'.png'), buf);
    else await write(ff, buf);
    done++;
    if (done === total || Date.now() - lastTick > 1000) tick();
  }
  /* Closing stdin is what tells ffmpeg the stream ended; waiting for close is
     what stops the process exiting while the file is still being written. Both,
     in that order — getting it wrong gives a part that is short by a second,
     which then shows up as a jump in the middle of the finished film. */
  if (ff) await new Promise(res => { ff.on('close', res); ff.stdin.end(); });
}));

console.log('');
await browser.close();
await server.close();

if (PNG_DIR){
  console.log(`done -> ${PNG_DIR}   ${W}x${H}` +
              (SS > 1 ? `  (rendered ${RW}x${RH}, ${SS}x supersampled)` : ''));
  process.exit(0);
}

/* Join the parts and put the sound on.

   -ss before the audio input is a fast seek on that input alone, which is what
   a range render needs: the picture starts at FROM and so must the track. */
const list = `${OUT}.parts.txt`;
const used = parts.filter(Boolean);
fs.writeFileSync(list, used.map(p => `file '${path.resolve(p)}'`).join('\n') + '\n');
const hasAudio = fs.existsSync(AUDIO);
if (!hasAudio) console.warn(`\n${AUDIO} not found — writing a silent file. Run \`npm run setup\`.`);
const mux = ['-nostats','-loglevel','error','-y','-f','concat','-safe','0','-i',list,
  ...(hasAudio ? ['-ss',String(FROM),'-i',AUDIO] : []),
  '-map','0:v', ...(hasAudio ? ['-map','1:a','-c:a','aac','-b:a','320k','-shortest'] : []),
  '-c:v','copy','-movflags','+faststart', OUT];
console.log('ffmpeg', mux.join(' '));
const r = spawnSync('ffmpeg', mux, { stdio:['ignore','ignore','inherit'] });
if (r.status === 0 && !KEEP){ used.forEach(p => fs.unlinkSync(p)); fs.unlinkSync(list); }

const mb = fs.existsSync(OUT) ? (fs.statSync(OUT).size/1e6).toFixed(0) : '?';
console.log(`done -> ${OUT}   ${W}x${H}` +
            (SS > 1 ? `  (rendered ${RW}x${RH}, ${SS}x supersampled)` : '') +
            `   ${JOBS} page${JOBS>1?'s':''}   ${mb} MB`);
