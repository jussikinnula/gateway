import * as THREE from 'three';
import { Timeline } from './timeline.js';
import { Post } from './core/post.js';
import { PortalTest } from './scenes/s00-portal-test.js';
import { UnderScene } from './scenes/s01-under.js';
import { PassageScene } from './scenes/s04-passage.js';
import { JungleScene } from './scenes/s05-jungle.js';
import { SecondPassageScene } from './scenes/s06-second-passage.js';
import { VolcanicScene } from './scenes/s07-volcanic.js';
import { FiveGatewaysScene } from './scenes/s08-five-gateways.js';
import { DarkScene } from './scenes/s09-dark.js';
import { ThirdPassageScene } from './scenes/s10-third-passage.js';
import { IslandsScene } from './scenes/s11-islands.js';
import { VoidScene } from './scenes/s12-void.js';
import { BleedScene } from './scenes/s13-bleed.js';
import { CollapseScene } from './scenes/s14-collapse.js';
import { LastPassageScene } from './scenes/s15-last-passage.js';
import { IntoTheLightScene } from './scenes/s16-into-the-light.js';
import { DesertScene } from './scenes/s17-desert.js';

/* Scene registry.
 *
 * One entry per scene id in timeline.json. `COVERED_BY` lets one file draw two
 * authored scenes back to back — declare it here rather than letting `--scene`
 * silently fall back to something else.
 *
 * Nothing below this block knows anything about what a scene draws. Add a file
 * under src/scenes/, add its id here, and `npm run check` will assert that every
 * authored scene dispatches to the builder that draws it. */
const BUILDERS = {
  S0: (tl) => new PortalTest(tl),
  S1: (tl) => new UnderScene(tl),
  S4: (tl) => new PassageScene(tl),
  S5: (tl) => new JungleScene(tl),
  S6: (tl) => new SecondPassageScene(tl),
  S7:  (tl) => new VolcanicScene(tl),
  S8:  (tl) => new FiveGatewaysScene(tl),
  S9:  (tl) => new DarkScene(tl),
  S10: (tl) => new ThirdPassageScene(tl),
  S11: (tl) => new IslandsScene(tl),
  S12: (tl) => new VoidScene(tl),
  S13: (tl) => new BleedScene(tl),
  S14: (tl) => new CollapseScene(tl),
  S15: (tl) => new LastPassageScene(tl),
  S16: (tl) => new IntoTheLightScene(tl),
  S17: (tl) => new DesertScene(tl),
};
/* S1-S3 are one unbroken rise from bar 1 to the break at bar 30 — three things
   the same shot does, not three shots. One file draws all three. */
const COVERED_BY = { S2: 'S1', S3: 'S1' };
const FALLBACK = 'S4';

const params = new URLSearchParams(location.search);
const RENDER = params.get('render') === '1';
const W = +(params.get('w') || 1920), H = +(params.get('h') || 1080);
const FPS = +(params.get('fps') || 60);

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias:false, powerPreference:'high-performance', preserveDrawingBuffer: RENDER
});

/* A LOST CONTEXT IS THE ONE FAILURE THAT SAYS NOTHING.
 *
 * When a draw call runs long enough to trip the graphics driver's watchdog,
 * the driver resets and the WebGL context is lost. Every call after that
 * silently does nothing: the preview freezes on its last frame and the offline
 * renderer waits forever for a frame that will never arrive. No exception, no
 * console error, no exit code — which is how one heavy scene cost two people
 * several rounds of looking for a bug in the wrong place.
 *
 * Three lines make it announce itself, and the message reaches render.mjs
 * through the console hook it already installs. */
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  console.error('WEBGL CONTEXT LOST — the graphics driver reset. ' +
    'A single draw call was too long for this GPU; nothing will render after this.');
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  console.error('WEBGL context restored (the renderer does not rebuild state; restart).');
}, false);
renderer.setClearColor(0x000000, 1);

const tl = await Timeline.load();
const builderFor = id => BUILDERS[COVERED_BY[id] || id];

let SCENE_ID = params.get('s') || window.__SCENE__ || null;
let TIMED = SCENE_ID === null;                 // no id pinned: follow the clock
if (SCENE_ID === null) SCENE_ID = FALLBACK;
let scene = (builderFor(SCENE_ID) || BUILDERS[FALLBACK])(tl);
let CURRENT_KEY = COVERED_BY[SCENE_ID] || SCENE_ID;
const post = new Post(renderer, 2, 2);

let scale = 1.0;
function size(w, h){
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, !RENDER);
  post.setSize(w, h);
  scene.camera.aspect = w/h;
  scene.camera.updateProjectionMatrix();
}
function fit(){
  const w = Math.max(2, Math.round(innerWidth*scale));
  const h = Math.max(2, Math.round(innerHeight*scale));
  size(w, h);
  canvas.style.width = innerWidth+'px';
  canvas.style.height = innerHeight+'px';
}

/* Free a scene's GPU memory before dropping it. A renderer walking the whole
   film touches every scene there is; holding them all at once is not an option
   once the environments get big. */
function disposeScene(sc){
  if (!sc || !sc.scene) return;
  sc.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats){
      if (m.uniforms) for (const k in m.uniforms){
        const v = m.uniforms[k].value; if (v && v.isTexture) v.dispose();
      }
      if (m.map && m.map.isTexture) m.map.dispose();
      m.dispose();
    }
  });
  if (sc.dispose) sc.dispose();
}

/* Which builder owns this instant. Outside every scene's span, the scene that
   most recently STARTED holds — so the head of the track gets the first scene
   and anything after the last one gets the last one.
 *
 * That is not what it did, and the bug was the last second of the film.
 *
 * The old fallback was `t >= tl.duration ? last : first`, and `tl.duration` is
 * the TRACK's duration, not the last scene's end. The schedule tiles bar 1 to
 * bar 176, which is 0.752 to 292.415, and the track runs to 293.407 — so for
 * the 0.99 s between the two, sceneAt() returned null, `t >= duration` was
 * false, and the film cut to `list[0]`. S1. Whose grade computes
 * `preBurst = exp(-max(0, T4 - t)*16)` with T4 at 49 s, which for any t past
 * that is exactly 1, which is uFlash 1.2, which is a whiteout.
 *
 * So the film ended: desert, fade to black, hold black for two and a half
 * seconds — and then one full second of pure white, at 0.909 mean, before the
 * audio stopped. Measured frame by frame at 10 fps: black through 292.4, 0.909
 * from 292.5 to the end.
 *
 * Two faults compounded, and this fixes the one that is actually wrong. A
 * decaying term written as exp(-max(0, cue - t)*k) is 1 for ALL time after its
 * cue — every 'rising into the cut' flash in this film is written that way and
 * it is correct inside the scene that owns it. What is not correct is a
 * dispatcher that hands a scene an instant three and a half minutes past its
 * own end. Holding the scene that most recently started also closes any gap
 * that ever opens up BETWEEN two scenes, which the old code would likewise
 * have answered with the first scene in the film. */
function keyForTime(t){
  const list = tl.d.scenes || [];
  if (!list.length) return FALLBACK;
  let sc = tl.sceneAt(t);
  if (!sc){
    for (const s of list) if (t >= s.t && (!sc || s.t > sc.t)) sc = s;
    if (!sc) sc = list[0];
  }
  const id = sc ? sc.id : FALLBACK;
  return COVERED_BY[id] || id;
}

let applySize = () => {};
function useScene(key){
  if (key === CURRENT_KEY || !BUILDERS[key]) return;
  const old = scene;
  scene = BUILDERS[key](tl);
  CURRENT_KEY = key;
  if (RENDER){ window.__sceneObj = scene; window.__sceneKey = key; }
  disposeScene(old);
  applySize();
}

function frame(t){
  if (TIMED) useScene(keyForTime(t));
  post.reset();
  scene.update(t, post);
  post.render(scene.scene, scene.camera, t, scene.refractScene);
}

/* ------------------------------------------------------------------ render */
if (RENDER){
  document.body.classList.add('render');
  canvas.width = W; canvas.height = H;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  applySize = () => size(W, H);
  applySize();
  window.__fps = FPS;
  window.__renderFrame = (n) => { frame(n / FPS); };
  window.__sceneObj = scene;
  window.__sceneKey = CURRENT_KEY;  // lets a test assert WHICH scene a frame is
  /* The coverage map itself, so check-scenes.mjs does not have to keep a second
     copy of it. It kept one, and a second copy of a mapping is a thing that
     goes out of date silently — which is the whole reason SCENES.md is
     generated rather than written. */
  window.__coveredBy = COVERED_BY;
  window.__post = post;
  window.__renderer = renderer;
  /* The same MUTE the preview has, reachable from a still render. The GPU-only
     artefact was named by muting populations one at a time by hand; being able
     to render the muted frame means a suspect can be tested against a file
     instead of against a description of a file. */
  /* A LIST, not a name. Hiding one layer at a time answers 'is this layer the
     only thing in front of that' and nothing else — and when two layers cover
     the same pixels, every single-layer test comes back negative and the
     conclusion drawn is that neither of them is responsible. That cost a round
     of chasing a waterfall that was behind four things at once. */
  window.__mute = (names) => {
    const L = scene.debugLayers && scene.debugLayers(); if (!L) return [];
    const off = new Set(String(names).split(',').map(s => s.trim()).filter(Boolean));
    Object.entries(L).forEach(([n, o]) => { if (o) o.visible = !off.has(n); });
    return Object.keys(L);
  };
  window.__solo = (name) => {
    const L = scene.debugLayers && scene.debugLayers(); if (!L) return [];
    Object.entries(L).forEach(([n, o]) => { if (o) o.visible = (n === name || n === 'dome'); });
    return Object.keys(L);
  };
  /* If this project ever ships a web font for on-screen type, wait for it here
     before setting __ready — a handful of frames set in the fallback face,
     scattered across the render blocks, is invisible until it is on YouTube.
     With no font to wait for, resolve on the next tick. */
  Promise.resolve().then(() => { window.__ready = true; });

/* ----------------------------------------------------------------- preview */
} else {
  const au = document.getElementById('au');
  const ui = document.getElementById('ui');
  const hint = document.getElementById('hint');
  const readEl = document.getElementById('read');
  const fillEl = document.getElementById('fill');
  const barEl  = document.getElementById('bar');
  const playEl = document.getElementById('play');
  const loopEl = document.getElementById('loopBtn');
  const resEl  = document.getElementById('res');

  au.src = window.__AUDIO__ || 'public/track.mp3';

  const scenes = tl.d.scenes || [];
  const shots  = tl.d.shots  || [];
  let A = 0, B = tl.duration, mine = [];

  applySize = fit;
  function pickScene(id){
    const make = builderFor(id);
    if (!make) return;
    SCENE_ID = id; TIMED = false;
    const old = scene;
    scene = make(tl);
    CURRENT_KEY = COVERED_BY[id] || id;
    if (old !== scene) disposeScene(old);
    fit();
    const sc = scenes.find(s => s.id === id);
    A = sc ? sc.t : 0;
    B = sc ? sc.tEnd : tl.duration;
    mine = shots.filter(s => s.t >= A - 0.01 && s.t < B);
    buildShotButtons();
    au.currentTime = A + 0.01;
    document.querySelectorAll('#scenes button')
      .forEach(b => b.classList.toggle('on', b.dataset.id === id));
  }

  const scBar = document.getElementById('scenes');
  {   /* the whole film, in order, scenes switched by the clock */
    const b = document.createElement('button');
    b.textContent = 'ALL'; b.dataset.id = '*';
    b.title = 'the whole film, scenes switched by the clock';
    b.onclick = () => {
      TIMED = true; SCENE_ID = '*';
      A = 0; B = tl.duration; mine = shots;
      buildShotButtons();
      au.currentTime = 0.01;
      document.querySelectorAll('#scenes button')
        .forEach(x => x.classList.toggle('on', x.dataset.id === '*'));
    };
    scBar.appendChild(b);
  }
  /* One button per thing that can be drawn, not one per authored scene.
   *
   * S0 is a builder with no entry in the timeline — it is the test card, and it
   * is deliberately not part of the film. Building the bar from `scenes` alone
   * therefore left it with no button: --scene S0 opened on it correctly and
   * then there was no way to see that it had, no way to get back to it after
   * clicking anything else, and nothing lit up, which reads as "it did not
   * work". Anything with a builder gets a button; the authored ones are
   * labelled from the timeline and the rest say what they are. */
  const builderIds = Object.keys(BUILDERS);
  const authored = new Set(scenes.map(s => COVERED_BY[s.id] || s.id));
  const order = [
    ...builderIds.filter(id => !authored.has(id)),                 // tools first
    ...scenes.map(s => s.id).filter(id => builderFor(id))          // then the film
  ];
  for (const id of order){
    const sc = scenes.find(s => s.id === id);
    const b = document.createElement('button');
    b.textContent = id; b.dataset.id = id;
    b.title = sc
      ? `${sc.name || ''} — bars ${sc.bar}–${sc.end - 1}` +
        (COVERED_BY[id] ? `  (drawn by ${COVERED_BY[id]})` : '')
      : 'not part of the film — a test card';
    b.onclick = () => pickScene(id);
    scBar.appendChild(b);
  }

  let looping = true, started = false;

  function buildShotButtons(){
    const host = document.getElementById('shots');
    host.textContent = '';
    barEl.querySelectorAll('.tick').forEach(t => t.remove());
    const buttons = mine.length <= 12;
    mine.forEach(sh => {
      const b = document.createElement('button');
      b.textContent = `${sh.bar} ${sh.name || ''}`;
      b.onclick = () => { au.currentTime = sh.t + 0.01; if (!started) start(); };
      if (buttons) host.appendChild(b);
      const tick = document.createElement('div');
      tick.className = 'tick' + (sh.reg === 'ALT' ? ' alt' : '');
      tick.style.left = ((sh.t - A)/(B - A)*100) + '%';
      barEl.appendChild(tick);
    });
  }
  /* And say so if the id asked for cannot be drawn, rather than quietly
     showing something else. */
  if (!builderFor(SCENE_ID)){
    console.warn(`no builder for "${SCENE_ID}" — falling back to ${FALLBACK}`);
    hint.textContent = `no scene "${SCENE_ID}" — showing ${FALLBACK}`;
    SCENE_ID = FALLBACK;
  }
  pickScene(SCENE_ID);

  async function start(){
    if (started) return;
    started = true; hint.style.display = 'none';
    au.currentTime = A + 0.01;
    try { await au.play(); } catch(e){ /* a user gesture will retry */ }
  }
  addEventListener('click', e => { if (!e.target.closest('#ui')) start(); });
  playEl.onclick = () => started ? (au.paused ? au.play() : au.pause()) : start();
  loopEl.onclick = () => { looping = !looping; loopEl.classList.toggle('on', looping); };
  const SCALES = [1, 1.5, 2, 0.75, 0.5];
  let scaleIdx = 0;
  resEl.title = '2× = supersampling (finer lines); below 1× = faster';
  resEl.onclick = () => {
    scaleIdx = (scaleIdx + 1) % SCALES.length;
    scale = SCALES[scaleIdx];
    resEl.textContent = String(scale) + '×';
    fit();
  };
  barEl.onclick = e => {
    const r = barEl.getBoundingClientRect();
    au.currentTime = A + (e.clientX - r.left)/r.width*(B - A);
    if (!started) start();
  };
  au.onplay  = () => playEl.textContent = '❚❚';
  au.onpause = () => playEl.textContent = '▶';
  au.onerror = () => {                     // some browsers block file:// media
    if (document.getElementById('pick')) return;
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'audio/*'; inp.id = 'pick';
    inp.onchange = e => { const f = e.target.files[0]; if (f) au.src = URL.createObjectURL(f); };
    const lab = document.createElement('span');
    lab.style.cssText = 'color:#e8623f;font-size:12px';
    lab.textContent = 'audio failed to load — pick the file: ';
    lab.appendChild(inp);
    ui.appendChild(lab);
  };

  /* ---- diagnostics -------------------------------------------------------
     Two keys, and between them they answer the two questions that cannot be
     answered by looking at a normal frame: is this pixel non-finite, and which
     population drew it. Both faults found in this project so far needed exactly
     one of these, and both needed it on the machine that showed the fault. */
  /* Two modes, and the second is the one that finds things.
     SOLO shows one population against nothing, which is useful for asking what
     a population looks like — and misleading for asking which one is wrong,
     because every surface in this project bakes the distance haze into its own
     colour. Take the sky away and a correct far-away branch turns into a pale
     stick floating in black. Two of the three answers from the last round were
     that, not a fault.
     MUTE hides one population and leaves the rest of the frame alone, so the
     artefact either disappears or it does not, and nothing else changes. */
  let debugNaN = false, isoIdx = 0, muteIdx = 0, isoNames = [];
  const KEEP = new Set(['dome']);       // the sky is not a population
  function names(){
    const L = scene.debugLayers && scene.debugLayers();
    isoNames = L ? Object.keys(L).filter(n => !KEEP.has(n)) : [];
    return L;
  }
  function isoLabel(){
    if (muteIdx > 0) return `   ·   MUTE: ${isoNames[muteIdx-1]}`;
    if (isoIdx > 0)  return `   ·   SOLO: ${isoNames[isoIdx-1]}`;
    return '';
  }
  function applyIsolation(){
    const L = names(); if (!L) return;
    Object.entries(L).forEach(([n, o]) => {
      if (!o) return;
      if (KEEP.has(n)) { o.visible = true; return; }
      if (muteIdx > 0)     o.visible = (n !== isoNames[muteIdx-1]);
      else if (isoIdx > 0) o.visible = (n === isoNames[isoIdx-1]);
      else                 o.visible = true;
    });
  }

  addEventListener('keydown', e => {
    if (e.key === ' '){ e.preventDefault(); playEl.click(); }
    else if (e.key === 'n' || e.key === 'N'){
      debugNaN = !debugNaN;
      post.qComp.u.uDebugNaN.value = debugNaN ? 1 : 0;
    }
    else if (e.key === 'l' || e.key === 'L'){        // solo
      names(); muteIdx = 0;
      isoIdx = (isoIdx + 1) % (isoNames.length + 1); applyIsolation();
    }
    else if (e.key === 'm' || e.key === 'M'){        // mute — the useful one
      names(); isoIdx = 0;
      muteIdx = (muteIdx + 1) % (isoNames.length + 1); applyIsolation();
    }
    else if (e.key === 'k' || e.key === 'K'){
      names();
      if (muteIdx > 0) muteIdx = (muteIdx - 2 + isoNames.length + 1) % (isoNames.length + 1);
      else isoIdx = (isoIdx - 2 + isoNames.length + 1) % (isoNames.length + 1);
      applyIsolation();
    }
    else if (e.key === 'h' || e.key === 'H') ui.classList.toggle('hidden');
    else if (e.key === 'ArrowRight') au.currentTime += e.shiftKey ? tl.beat : tl.barSec;
    else if (e.key === 'ArrowLeft')  au.currentTime -= e.shiftKey ? tl.beat : tl.barSec;
  });

  addEventListener('resize', fit);
  fit();

  let last = performance.now(), fps = 60;
  (function loop(){
    requestAnimationFrame(loop);
    const now = performance.now();
    fps += ((1000/Math.max(now - last, 1)) - fps)*0.06; last = now;

    let t = started ? au.currentTime : A + 0.65;
    if (started && looping && (t >= B || t < A - 0.5)){ au.currentTime = A + 0.01; t = A; }
    frame(t);
    // scenes rebuild their own visibility every frame, so re-apply after drawing
    if (isoIdx > 0 || muteIdx > 0) applyIsolation();

    const sh = mine.find(s => t >= s.t && t < s.tEnd);
    const bar = tl.bar(t);
    readEl.textContent =
      `${t.toFixed(2)}s  bar ${Math.floor(bar)}.${Math.floor((bar%1)*4)+1}  ` +
      `${sh ? (sh.reg ? sh.reg + ' ' : '') + (sh.name || '') : '—'}  ${fps.toFixed(0)}fps` +
      (debugNaN ? '   ·   NaN=magenta bloom=cyan' : '') + isoLabel() +
      (window.__BUILT__ ? `   ·   built ${window.__BUILT__}` : '');
    fillEl.style.width = Math.max(0, Math.min(1, (t - A)/(B - A)))*100 + '%';
  })();
}
