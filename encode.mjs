/* Frames + track -> mp4.
 *
 *   node encode.mjs --fps 60 --from 0 --out master.mp4
 *   node encode.mjs --fps 60 --from 0 --out youtube.mp4 --yt
 *
 * The --yt flag is not a quality setting, it is a delivery one. YouTube
 * re-encodes everything it is given, and what it hands back depends far more on
 * the resolution it was given than on the bitrate: 1080p is served as H.264 on
 * a low fixed budget, while 1440p and above get VP9 or AV1 and several times
 * the bits. For dark footage with fine moving detail — which is most of this
 * film and all of the seeker register — that is the difference between "grainy"
 * and "broken".
 *
 * So --yt encodes at 1440p. Rendering natively at 2560x1440 is better again
 * (`node render.mjs --w 2560 --h 1440`); if the frames are 1080p it upscales,
 * which still buys the codec tier even though it invents no detail.
 *
 * aq-mode 3 is the other half. Adaptive quantisation biased toward dark regions
 * is what a night film wants: without it x264 spends its bits on the few bright
 * things — the exhaust, the windows, the HUD — and leaves the dark two thirds
 * of every frame to band.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const arg = (k,d)=>{ const i=process.argv.indexOf('--'+k); return i>0?process.argv[i+1]:d; };
const has = k => process.argv.includes('--'+k);

const FPS=+arg('fps',60), FROM=+arg('from',0), OUT=arg('out','out.mp4'), DIR=arg('dir','frames');
const YT = has('yt');
const HEIGHT = +arg('height', YT ? 1440 : 0);          // 0 = leave the frames as they are
const START=Math.round(FROM*FPS);

/* Only rescale if the frames are actually smaller than the target. Rendering
   natively at 2560x1440 and then asking ffmpeg to "scale to 1440" is a resample
   to the size it already is: harmless, but it is a lie in the command line and
   somebody will one day read it as the upscale doing the work. */
let scaleTo = HEIGHT;
if (HEIGHT){
  const first = `${DIR}/${String(START).padStart(6,'0')}.png`;
  if (fs.existsSync(first)){
    const r = spawnSync('ffprobe', ['-v','error','-select_streams','v:0',
      '-show_entries','stream=height','-of','csv=p=0', first], { encoding:'utf8' });
    const h = parseInt((r.stdout||'').trim(), 10);
    if (Number.isFinite(h)){
      console.log(`source frames are ${h} lines`);
      if (h >= HEIGHT) scaleTo = 0;
    }
  }
}
const vf = scaleTo ? ['-vf', `scale=-2:${scaleTo}:flags=lanczos`] : [];
const enc = YT
  ? ['-c:v','libx264','-preset','slower','-crf','14','-pix_fmt','yuv420p',
     '-x264-params','aq-mode=3:aq-strength=1.0:bframes=3:ref=5']
  : ['-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p'];

const a=['-y','-framerate',String(FPS),'-start_number',String(START),
  '-i',`${DIR}/%06d.png`,'-ss',String(FROM),'-i','public/track.mp3',
  '-map','0:v','-map','1:a','-shortest', ...vf, ...enc,
  '-c:a','aac','-b:a', YT ? '320k' : '256k','-movflags','+faststart',OUT];
console.log('ffmpeg',a.join(' '));
spawnSync('ffmpeg',a,{stdio:'inherit'});
