import * as THREE from 'three';
import { NOISE } from '../core/glsl.js';
import { JungleScene } from './s05-jungle.js';
import { PassageScene } from './s04-passage.js';
import { DarkScene } from './s09-dark.js';
import { IslandsScene } from './s11-islands.js';

/* S12 — Void.  Bars 113–119.
 *
 * The drums cut and there is no world here at all. This is the space between
 * them, and it is the first time the traveller has been in it without a
 * tunnel around him.
 *
 * The shot list calls it 'the cheapest scene in the film and the one that has
 * to be graded most carefully', which is exactly right and is the whole
 * problem: an empty frame has nothing in it to be wrong, so everything that
 * IS in it — the grey, the vignette, the grain — is doing all the work at
 * once. Three decisions carry the scene.
 *
 *   Not black. 'A grey with no direction in it.' Black reads as an ending or
 *   as a fault; grey reads as somewhere. So there is a dome, and it holds a
 *   gradient with no horizon in it: a soft ramp along an axis deliberately
 *   tilted off vertical, between two greys close enough together that the
 *   ramp is felt rather than seen. A gradient along the Y axis, however
 *   gentle, puts a sky and a ground back into a scene whose entire premise is
 *   that there is neither.
 *
 *   The camera falls, and nothing shows it — but the frame is not still.
 *   'Falling, but with nothing to fall past, so it does not read as falling'
 *   describes how the shot should FEEL, and the first pass here read it as an
 *   instruction to make the picture literally motionless. It did: measured
 *   across the finished scene, the difference between two frames three
 *   seconds apart and two frames NINE seconds apart was identical — 2.79
 *   against 2.82 — which is the signature of a field that is not changing at
 *   all and a difference that is entirely film grain. Worse, that grain
 *   updates at 12Hz and holds for five frames, so the picture was bit-for-bit
 *   frozen in 83-millisecond blocks. Reported, correctly, as 'näkyy vain
 *   harmaata'.
 *
 *   So the void churns now: two noise layers drifting along different axes at
 *   different rates, whose interference turns over in place rather than
 *   travelling, and a gradient axis that rotates about fourteen degrees across
 *   the scene. Neither gives a direction of travel, a horizon or a scale —
 *   there is still nothing to fall past. They only make the difference
 *   between a void and a still frame of one.
 *
 *   Three flashes. On the measured shouts, not on bar lines — see FLASH_DUR
 *   and the note on the shot list's own contradiction below.
 */

/* The dome's two greys, and the axis the ramp runs along. The axis is
   normalised at construction; what matters here is only that it is nowhere
   near (0,1,0). */
/* Dark and cold, not mid-grey, and this is the second correction to the same
   note. 'A grey with no direction in it' was built literally: a flat field
   sitting at half luminance, which measures as exactly what it looked like —
   a grey card. Nothing in the brief asks for mid-grey. It asks for NOT BLACK,
   which a deep cold blue-violet with structure in it satisfies far better
   than a neutral 50% does, and which is also the only version of this that
   reads as a volume the camera is inside rather than a surface it is facing.
   uWarm is for the pockets the structure opens up: not a light source, no
   direction, just the faint warmth that keeps the whole thing from being one
   colour. */
const VOID_DEEP = [0.045, 0.052, 0.082];
const VOID_MID  = [0.105, 0.115, 0.148];
const VOID_WARM = [0.200, 0.176, 0.155];
const VOID_AXIS = [0.42, 0.20, -0.88];

/* Units per second downward. Produces no parallax — the dome rides with the
   camera — and is implemented anyway rather than left at zero, because 'the
   camera falls' is the shot, and a scene whose camera secretly does not move
   is a scene that lies to whatever reads it next. */
const FALL_V = 26;

/* How fast the field turns over, in noise units per second, and how far the
   gradient axis swings, in radians per second. Both are small and both had to
   stop being smaller: the first pass ran the churn at about a fiftieth of
   this and the axis not at all, which measured as no change whatever above
   the grain. The test that matters is not 'can I see it move' — you cannot,
   and should not — it is 'does the frame differ more from one nine seconds
   away than from one three seconds away'. It now does. */
const CHURN_V = 0.135;
const AXIS_V  = 0.030;

/* Two frames at 60, exactly, at every phase — which is worth deriving rather
 * than assuming, because the assumption was wrong the first time and cost a
 * frame.
 *
 * The window is [c, c + D). The frames inside it are the integers n with
 * 60c <= n < 60(c + D), so the count is ceil(60c + 60D) - ceil(60c). At
 * 60D = 2 that is exactly 2 whether 60c is an integer or not: for a
 * non-integer x, ceil(x + 2) = ceil(x) + 2, and for an integer k the frames
 * are simply k and k+1. The first pass here used 2.5/60 out of a worry that a
 * cue landing off the frame grid could give a single frame — it cannot, and
 * 2.5 does the opposite of protecting against it, yielding three frames
 * whenever a cue IS frame-aligned, which all three of these turn out to be.
 * Counted directly off a render before and after. */
const FLASH_DUR = 2/60;

/* What the flashes show.
 *
 * The shot list says 'each showing a world for two frames' without saying
 * which. The three worlds that belong here are the ones between the jungle
 * and this scene — volcanic (S7), dark (S9), islands (S11) — and none of them
 * is built yet. So these are stand-ins occupying the same three slots, and
 * swapping a real one in later is one line each: the scene class, and a time
 * inside its own span to sample it at.
 *
 * Each is evaluated at a FIXED time in its own scene rather than at the void's
 * current time. Two reasons. Their update() methods clamp to their own spans,
 * so handing them t = 192 would show every one of them at its first frame,
 * which is the least characteristic thing any of them looks like. And a fixed
 * time is a fixed picture: the flash is the same two frames however the
 * renderer is sliced, which is the same purity rule everything else here
 * obeys. */
const FLASH_WORLDS = [
  { make: (tl) => new JungleScene(tl),  at: (tl) => tl.timeOfBar(46),
    tint: [0.10, 0.30, 0.16], ghost: true },
  { make: (tl) => new PassageScene(tl), at: (tl) => tl.timeOfBar(38),
    tint: [0.16, 0.24, 0.38], ghost: false },
  /* The crowd, not the desert.
   *
   * Two notes, one swap. 'Mustat hahmot silmillä eivät ole mukana
   * flashbackeissä alussa' — they were not: this list had jungle, tunnel,
   * desert and islands, and the one world in this film with a FACE in it was
   * missing from the sequence that is supposed to be the traveller's memory.
   * And 'flashbackeissä ei tarvitsisi olla aavikkoa, koska se on
   * loppukohtaus' — a flashback to somewhere the film has not been yet is not
   * a flashback, it is a spoiler, and the desert is the last twenty seconds of
   * the picture.
   *
   * The crowd is also the better ghost of the two. What the fog holds is an
   * OUTLINE, and a crowd of standing figures with a ragged top edge is the
   * most nameable silhouette this film owns — more so than a dune line, which
   * with the sound off is a horizon like any other. */
  { make: (tl) => new DarkScene(tl),    at: (tl) => tl.timeOfBar(85) + 0.004,
    tint: [0.34, 0.10, 0.10], ghost: true },
  { make: (tl) => new IslandsScene(tl), at: (tl) => tl.timeOfBar(103),
    tint: [0.30, 0.18, 0.40], ghost: true }
];

/* Which three are photographed for the fog to hold. The tunnel is not one of
   them: it is a corridor seen end-on and its silhouette is a circle, which in
   a fog reads as a lens flare rather than as a place. The other three have
   horizons, canopies and rims — outlines you could name with the sound off. */
const GHOSTS = [0, 2, 3];
const GHOST_W = 512, GHOST_H = 288;

function buildVoid(){
  const geo = new THREE.SphereGeometry(400, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uDeep:  { value: new THREE.Color(...VOID_DEEP) },
      uMid:   { value: new THREE.Color(...VOID_MID) },
      uWarm:  { value: new THREE.Color(...VOID_WARM) },
      uAxis:  { value: new THREE.Vector3(...VOID_AXIS).normalize() },
      uChurn: { value: 0 },
      uNoise: { value: 0.60 },
      /* The three photographs, and how much of each is in the air. */
      tG0: { value: null }, tG1: { value: null }, tG2: { value: null },
      uGA:   { value: new THREE.Vector3(0, 0, 0) },
      uGPan: { value: new THREE.Vector3(0, 0, 0) },
      uGTint0: { value: new THREE.Color(1, 1, 1) },
      uGTint1: { value: new THREE.Color(1, 1, 1) },
      uGTint2: { value: new THREE.Color(1, 1, 1) }
    },
    vertexShader: /* glsl */`
      varying vec3 vD;
      varying vec3 vV;
      void main(){ vD = normalize(position);
        vec4 mv = modelViewMatrix*vec4(position, 1.0);
        /* The direction FROM THE EYE, in the camera's own frame. The ghosts
           are mapped on this rather than on the dome's own direction, and the
           difference is not academic: this camera falls, so it looks very
           nearly straight DOWN, and a world laid out by world-space azimuth
           and elevation ends up entirely off the edge of its own photograph.
           The first version of this drew the clamped border pixel across the
           whole sky and nothing else. */
        vV = mv.xyz;
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      uniform vec3 uDeep, uMid, uWarm, uAxis;
      uniform float uChurn, uNoise;
      uniform sampler2D tG0, tG1, tG2;
      uniform vec3 uGA, uGPan;
      uniform vec3 uGTint0, uGTint1, uGTint2;
      varying vec3 vD;
      varying vec3 vV;
      /* THREE-DIMENSIONAL, and it has to be. Two-dimensional noise sampled on
         a pair of the direction's components — fbm(dir.xz), say — gives every
         point the same value as its mirror image through the plane of the
         missing component: the field is reflected top to bottom, and the
         reflection's axis is a line across the frame. That is a horizon, which
         is the one thing this scene is not allowed to have. It was invisible
         while the features were larger than the frame; raising the frequency
         to give the void some structure made it a visible seam within one
         render. Triplanar: three 2-D samples blended by the direction's own
         components, which has no plane of symmetry anywhere on the sphere. */
      float v3(vec3 p){
        vec3 w = abs(p);
        w /= (w.x + w.y + w.z + 1e-5);
        return fbm(p.xy)*w.z + fbm(p.yz + 17.0)*w.x + fbm(p.zx + 43.0)*w.y;
      }
      /* THE WORLDS, AS OUTLINES IN THE AIR.
       *
       * Each of the three is photographed once — its own scene, its own
       * camera, into a small target, at the same fixed instant its flash uses
       * — and what is used here is not the picture but its EDGES. A
       * photograph laid into fog is a photograph laid into fog; a contour of
       * one is something half-seen, which is the whole difference. The
       * gradient is taken as a two-tap difference in luminance, which at this
       * resolution and this opacity is all the edge detection the effect can
       * spend.
       *
       * Mapped by the view direction rather than by screen position, so a
       * ghost sits in the volume and the camera looks past it. Each pans at
       * its own rate: three things sliding at three speeds is the only
       * parallax available to a scene with nothing in it, and it is what
       * stops them reading as three slides in a projector.
       *
       * And they live INSIDE the fog's own structure — multiplied by the
       * churn field — so a world surfaces where the cloud happens to be
       * thick and is gone where it thins. That is what keeps them weather
       * rather than overlays. */
      float lum(vec3 c){ return dot(c, vec3(0.30, 0.59, 0.11)); }
      /* LOCAL CONTRAST, not a two-tap gradient and not the picture itself.
       *
       * A two-tap difference finds only what changes within a pixel or two,
       * which at this size is nothing a viewer could name — the first pass at
       * this put a few faint striations in the fog and no world. And the
       * photograph itself cannot be used directly: these three are lit for
       * their own scenes and rendered without the compositor, so the jungle's
       * average is a fifth of the desert's, and any threshold that finds the
       * canopy turns the dunes into a solid block.
       *
       * The centre minus a wide ring around it is blind to both. What it
       * returns is what is darker or brighter THAN ITS SURROUNDINGS: a dune's
       * ridge, an island's rim, the edge of a frond. That is the outline of
       * the place, at whatever exposure it happens to have been photographed
       * at, and it is the same measurement for all three. */
      float ghostEdge(sampler2D tex, vec2 guv){
        /* Outside the frame the photograph has nothing to say. Faded rather
           than clamped: a clamped edge smears the border pixel into a stripe
           across half the sky. */
        vec2 e = min(guv, 1.0 - guv);
        float inside = smoothstep(0.0, 0.12, min(e.x, e.y));
        if (inside <= 0.001) return 0.0;
        /* TWO SCALES, and the coarse one is what makes it a place.
 
           A fine local contrast finds edges, and edges alone are hairlines —
           at this opacity they read as scratches on the fog rather than as
           anything standing in it. The coarse one finds MASSES: a ridge
           against a sky, an island against space, a canopy against a gap in
           it. Those are the shapes a viewer can name, and the fine pass is
           there only to put a line on them. */
        float c = lum(texture(tex, guv).rgb);
        float f = c - 0.25*(lum(texture(tex, guv + vec2( 0.011, 0.0)).rgb)
                          + lum(texture(tex, guv + vec2(-0.011, 0.0)).rgb)
                          + lum(texture(tex, guv + vec2(0.0,  0.020)).rgb)
                          + lum(texture(tex, guv + vec2(0.0, -0.020)).rgb));
        float m = c - 0.25*(lum(texture(tex, guv + vec2( 0.052, 0.0)).rgb)
                          + lum(texture(tex, guv + vec2(-0.052, 0.0)).rgb)
                          + lum(texture(tex, guv + vec2(0.0,  0.092)).rgb)
                          + lum(texture(tex, guv + vec2(0.0, -0.092)).rgb));
        float d = abs(f)*0.55 + abs(m)*1.45;
        /* A high gain, and it is not arbitrary: these photographs are taken
           without the compositor, so they carry the raw scene at whatever
           exposure it happens to leave the renderer at — a jungle at a fifth
           of the desert's average and both far below where the grade would
           put them. The measurement is a local difference, so a gain is the
           only thing it needs. */
        return clamp(d*30.0, 0.0, 1.0)*inside;
      }

      void main(){
        vec3 dir = normalize(vD);
        /* The horizonless gradient. smoothstep over the full -1..1 of the dot
           product, so there is no edge anywhere in it — the ramp covers the
           entire sphere and no part of it is ever steep enough to read as a
           line. The axis it runs along rotates slowly; see update(). */
        float k = smoothstep(-1.0, 1.0, dot(dir, uAxis));
        vec3 col = mix(uDeep, uMid, k);
        /* The churn, in three scales at three rates. Each layer is sampled on
           a different pair of axes and drifts a different way, so the sum has
           no net direction to it — what moves is the interference between
           them, which turns over in place. One layer translating would have
           been simpler and would have given the void a current, which is a
           direction, which is the one thing this scene is not allowed to
           have.

           Three rather than one is what makes it a volume. Layers that turn
           over at different speeds read as being at different depths even
           though nothing here has a position and nothing parallaxes — it is
           the only depth cue available to a scene with no ground, no scale
           and no light, and without it the field is a painted surface however
           much it moves. Weighted so the largest dominates: the finer two are
           there to be felt, and a field where they compete starts to look
           like cloud, which is a place. */
        /* THE FREQUENCIES ARE SET BY THE FIELD OF VIEW, and that is the
           correction this needed. At 1.15 per unit of direction the dominant
           layer's features are larger than the frame is: a sixty-two degree
           view spans about one noise cell of it, so whatever the layer is
           doing, the picture is one flat sample of it. Measured across the
           finished scene, the internal contrast was a standard deviation of
           8.6 out of 255 and two frames four seconds apart differed by 5.8
           where two seconds apart differed by 5.0 — which is not a field
           evolving, it is grain with a hint of drift under it. Nothing about
           the brief asks for that; it asks for no horizon and no direction,
           and a void with weather in it has neither.
 
           So the scales are raised until there are several cells across the
           frame, and the drift coefficients are raised WITH them: the pattern
           moves by churn/frequency in direction units, so scaling both keeps
           the apparent speed exactly where it was tuned and only adds
           structure for it to happen to. */
        float n1 = v3(dir*3.40 + vec3( uChurn*2.50, -uChurn*0.90,  uChurn*1.40));
        float n2 = v3(dir*7.00 + vec3(-uChurn*4.70,  uChurn*3.30, -uChurn*2.10) + 5.0);
        float n3 = v3(dir*14.0 + vec3( uChurn*7.70, -uChurn*6.20,  uChurn*4.40) + 11.0);
        float n  = 0.58*n1 + 0.29*n2 + 0.13*n3;
        /* Stretched about its own middle. A triplanar sample is the average of
           three, and averaging three of anything narrows its distribution —
           the field came back correct and symmetry-free and half a stop
           flatter than the two-dimensional version it replaced. This puts the
           spread back without touching where the middle sits, so the grade
           above it still means what it meant. */
        n = clamp((n - 0.5)*1.62 + 0.5, 0.0, 1.0);
        /* And more of it reaches the picture. The old range put the field
           inside plus or minus a quarter of the base colour, which is under
           the grain for most of the frame. */
        col *= 0.46 + 1.30*n;
        col = mix(col, uWarm, smoothstep(0.56, 0.94, n)*uNoise);

        /* The ghosts. Azimuth measured from the way the camera is looking, so
           the frame spans most of one photograph; elevation from the same
           direction. Both scaled so a world is about a frame wide — smaller
           and it is a picture hanging in the fog, wider and it is a texture. */
        vec3 vd = normalize(vV);
        float az = atan(vd.x, -vd.z);
        float el = asin(clamp(vd.y, -1.0, 1.0));
        float body = 0.35 + 0.65*smoothstep(0.30, 0.72, n);
        /* The scales come from the FRUSTUM, not from taste. A sixty-two degree
           vertical field spans plus or minus 0.54 radians of elevation and, at
           sixteen by nine, plus or minus 0.81 of azimuth; mapping those onto
           the nought-to-one of a photograph is one division each. Guessed
           instead, they put most of the frame outside the picture and the
           ghost came back as a band across the middle with cut edges — which
           is what a texture looks like when you have run off the end of it. */
        float g0 = uGA.x > 0.001 ? ghostEdge(tG0, vec2(az*0.58 + 0.5 + uGPan.x, el*0.85 + 0.5)) : 0.0;
        float g1 = uGA.y > 0.001 ? ghostEdge(tG1, vec2(az*0.52 + 0.5 + uGPan.y, el*0.78 + 0.5)) : 0.0;
        float g2 = uGA.z > 0.001 ? ghostEdge(tG2, vec2(az*0.63 + 0.5 + uGPan.z, el*0.92 + 0.5)) : 0.0;
        g0 *= uGA.x*body; g1 *= uGA.y*body; g2 *= uGA.z*body;
        float gs = clamp(g0 + g1 + g2, 0.0, 1.0);
        /* A shadow first and a colour second. The outline darkens the fog it
           is in — which is what an object half a mile off in cloud does — and
           carries only a trace of its own world's light, or the void stops
           being a void and becomes a slide show. */
        vec3 gcol = (uGTint0*g0 + uGTint1*g1 + uGTint2*g2)/max(1e-4, g0 + g1 + g2);
        /* Held back to half-seen. At full strength the desert stops being a
           memory in the fog and becomes a desert with fog on it, which is a
           different scene and not this one. */
        col *= 1.0 - gs*0.74;
        col += gcol*gs*0.28;

        gl_FragColor = vec4(col, 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

export class VoidScene {
  constructor(tl){
    this.tl = tl;
    const span = tl.scene('S12') || { t: tl.timeOfBar(113), tEnd: tl.timeOfBar(120) };
    this.T0 = span.t; this.T1 = span.tEnd;

    this._void = new THREE.Scene();
    this._cam = new THREE.PerspectiveCamera(62, 16/9, 0.1, 1200);
    this.dome = buildVoid();
    this._void.add(this.dome);

    /* Handed to main.js, and swapped for a world's own scene and camera on a
       flash frame — see update(). */
    this.scene = this._void;
    this.camera = this._cam;

    /* The three shouts, read out of the timeline rather than written down
       here: 'no timing is hard-coded in a scene file'.

       The shot list contradicts itself about where these go. It puts a shot
       called 'Three shouts' at bars 117-119 and then, in that shot's own sync
       note, cites the cues at 115.63, 115.89 and 116.14 — which are in the
       PREVIOUS shot's span. Two things settle it. Those three are one beat
       apart, which is what the shot list asks for, where bars 117/118/119
       would be one BAR apart. And the rules section, which outranks the shot
       list by its own statement, lists 'the three in S12' among the few cuts
       in the film allowed to land inside a bar 'on measured cue times taken
       from timeline.json'. So they go on the shouts, and bars 116-119 are the
       silence after them: three glimpses of somewhere, and then nothing at
       all for three and a half bars, which is a good deal more frightening
       than three glimpses on the way out would have been. */
    const cues = (tl.d.lyrics || [])
      .filter(c => c.bar >= 115.4 && c.bar <= 116.4)
      .map(c => c.t)
      .sort((a, b) => a - b);
    const shouts = cues.length === 3 ? cues
      : [115.63, 115.89, 116.14].map(b => tl.timeOfBar(b));

    /* MORE OF THEM, and spread. Three glimpses in the middle and nothing
       either side was defensible as a structure and did not survive being
       watched: eleven seconds is a long time to hold a grey. So the three
       shouts keep their place and their weight — they are still the only ones
       the rules allow to land off the bar, and they still run green,
       blue-white, amber in that order — and around them the void is pierced
       on the BEAT, building toward the shouts and decaying after them.
 
       Two frames for the strong ones, one for the weak. A single frame is not
       half a glimpse; it is a different thing, closer to something catching
       the corner of the eye, and the difference between the two is most of
       what makes a run of these read as intensity rather than as a metronome. */
    const beat = tl.beat || (tl.barSec/4);
    const AROUND = [
      [-13, 0.30, 3], [-10, 0.36, 0], [-7, 0.44, 2], [-5, 0.52, 3],
      [-3, 0.62, 0], [-1, 0.74, 2],
      [ 4, 0.86, 3], [ 6, 0.72, 0], [ 8, 0.62, 1], [11, 0.50, 2],
      [14, 0.40, 3], [18, 0.32, 0], [23, 0.26, 2]
    ];
    this.flashes = [];
    for (let i = 0; i < shouts.length; i++){
      this.flashes.push({ t: shouts[i], w: i, dur: 2/60, s: 1.0 });
    }
    for (const [n, str, wi] of AROUND){
      const ft = shouts[0] + n*beat;
      if (ft < this.T0 + 0.30 || ft > this.T1 - 0.30) continue;
      this.flashes.push({ t: ft, w: wi, dur: str >= 0.60 ? 2/60 : 1/60, s: str });
    }
    this.flashes.sort((a, b) => a.t - b.t);

    /* Built eagerly, all three, and the cost is real: this constructor builds
       a jungle, a tunnel and a desert to show six frames of them. Lazy
       construction would spread that cost and cap the memory at one world,
       and was rejected on purpose — it would put a hitch at the flash instead
       of at the cut, which is the one moment in this scene where a hitch
       would be visible. Nothing here uses Math.random, so all three are the
       same worlds every time they are built. */
    this.worlds = FLASH_WORLDS.map(w => ({ scene: w.make(tl), at: w.at(tl) }));

    this._pos = new THREE.Vector3();
    /* The gradient axis, and the axis it swings about. The swing axis is
       deliberately not parallel to the gradient's own — rotating a vector
       about itself is a no-op, and that is an easy way to ship a rotation
       that does nothing. */
    this._axis0 = new THREE.Vector3(...VOID_AXIS).normalize();
    this._axis  = new THREE.Vector3();
    this._swing = new THREE.Vector3(0.17, 0.94, 0.29).normalize();
  }

  /* Photograph the three worlds, once.
   *
   * Done on the first frame rather than in the constructor, for the same
   * reason S13's layout is: taking the picture means running that world's
   * update, and every scene here writes to the compositor when it updates —
   * there is no compositor yet while this object is being built.
   *
   * Once is enough and once is required. Each world is sampled at the same
   * fixed instant its flash uses, so the outline in the fog and the glimpse
   * that pierces it are the same picture of the same place; and a photograph
   * taken once is a photograph that cannot make the scene depend on the frame
   * before it, which is the purity rule this film is built on. */
  _photograph(post){
    const r = post.renderer;
    if (!r) return;
    const prev = r.getRenderTarget();
    this._gRT = GHOSTS.map(() => new THREE.WebGLRenderTarget(GHOST_W, GHOST_H, {
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
      depthBuffer: true
    }));
    for (let i = 0; i < GHOSTS.length; i++){
      const w = this.worlds[GHOSTS[i]];
      w.scene.update(w.at, post);
      const cam = w.scene.camera, a0 = cam.aspect;
      cam.aspect = GHOST_W/GHOST_H; cam.updateProjectionMatrix();
      r.setRenderTarget(this._gRT[i]);
      r.clear();
      r.render(w.scene.scene, cam);
      cam.aspect = a0; cam.updateProjectionMatrix();
    }
    r.setRenderTarget(prev);
    const du = this.dome.material.uniforms;
    du.tG0.value = this._gRT[0].texture;
    du.tG1.value = this._gRT[1].texture;
    du.tG2.value = this._gRT[2].texture;
    du.uGTint0.value.setRGB(...FLASH_WORLDS[GHOSTS[0]].tint);
    du.uGTint1.value.setRGB(...FLASH_WORLDS[GHOSTS[1]].tint);
    du.uGTint2.value.setRGB(...FLASH_WORLDS[GHOSTS[2]].tint);
    this._shot = true;
  }

  /** Which flash, if any, owns this instant. -1 for none. */
  flashAt(t){
    for (let i = 0; i < this.flashes.length; i++){
      const f = this.flashes[i];
      if (t >= f.t && t < f.t + f.dur) return i;
    }
    return -1;
  }

  update(t, post){
    const u = Math.max(0, t - this.T0);
    if (!this._shot) this._photograph(post);

    /* The fall, whether or not anything shows it. */
    this._pos.set(0, -FALL_V*u, 0);
    this._cam.position.copy(this._pos);
    this._cam.lookAt(this._pos.x, this._pos.y - FALL_V, this._pos.z - 1);
    this.dome.position.copy(this._pos);

    /* The two things that keep the frame from being a still. Both are pure
       functions of u, so any frame still renders without the one before it. */
    const du = this.dome.material.uniforms;
    du.uChurn.value = u*CHURN_V;

    /* How much of each world is in the air.
     *
     * Two terms. A slow BASE — a wide bump, one per world, at a different
     * third of the scene — so that even with nothing else happening the fog
     * is turning something over. And a MEMORY: after a flash of that world,
     * the outline of it lingers for a couple of seconds and fades, so what
     * pierced the void a moment ago is what the void is still holding. The
     * second is the one that makes the scene feel caused rather than
     * scheduled. */
    const sp = Math.max(1e-3, this.T1 - this.T0);
    const q = u/sp;
    for (let i = 0; i < GHOSTS.length; i++){
      const centre = 0.26 + i*0.26;
      const d = (q - centre)/0.30;
      let amt = 0.56*Math.exp(-d*d);
      for (const f of this.flashes){
        if (f.w !== GHOSTS[i]) continue;
        const dt = t - (f.t + f.dur);
        if (dt >= 0 && dt < 3.0) amt = Math.max(amt, 0.88*f.s*Math.exp(-dt*0.85));
      }
      du.uGA.value.setComponent(i, amt);
      /* Each pans at its own rate — three things sliding at three speeds is
         the only parallax a scene with nothing in it can have. */
      du.uGPan.value.setComponent(i, u*[0.0115, -0.0082, 0.0061][i]);
    }
    this._axis.copy(this._axis0).applyAxisAngle(this._swing, u*AXIS_V);
    du.uAxis.value.copy(this._axis);

    // ---- the flashes -------------------------------------------------------
    const fi = this.flashAt(t);
    if (fi >= 0){
      const w = this.worlds[this.flashes[fi].w];
      /* The world grades itself. post.reset() has already run this frame, so
         whatever that scene writes into the compositor is what these two
         frames look like — which is the point: a glimpse of somewhere should
         arrive with that somewhere's own light on it, not with the void's. */
      w.scene.update(w.at, post);
      this.scene = w.scene.scene;
      this.camera = w.scene.camera;
      this.refractScene = w.scene.refractScene;
      /* main.js only sets the aspect when the SCENE changes, and from its
         point of view this scene never does — so a swapped-in camera would
         otherwise keep whatever aspect its own constructor gave it and the
         flash would be squeezed at any output shape but 16/9. */
      if (this.camera.aspect !== this._cam.aspect){
        this.camera.aspect = this._cam.aspect;
        this.camera.updateProjectionMatrix();
      }
      return;
    }
    this.scene = this._void;
    this.camera = this._cam;
    this.refractScene = undefined;

    // ---- grade -------------------------------------------------------------
    const c = post.qComp.u, d = post.qDof.u;

    /* Bar 113 is the measured drum cut and the picture empties on it. The cut
       itself does most of that work; this is the last of the previous world's
       light going out over about a third of a second, so the void is arrived
       at rather than started in. */
    const empty = 1 - Math.exp(-u*7.0);

    /* The afterglow, and it does two jobs.
       The first is the one it was written for: two frames of a world cut hard
       back to grey reads as a dropped frame rather than as a choice — the same
       trap S6's formEnv names, where a single black frame at a cut looked like
       a fault. So each flash leaves a decaying lift behind it.

       The second matters more, and is why it is tinted and why it now runs a
       third of a second rather than a sixth. The world flash is exactly two
       frames, which is exact in the offline render — t there is n/60 and
       nothing is ever skipped. The live preview is not so lucky: it samples
       the <audio> element's currentTime, which advances in coarse steps and
       is entitled to jump straight over a 33-millisecond window, so the world
       frames can simply never be drawn while reviewing. The afterglow cannot
       be missed by any sampler, and it carries that world's own colour, so
       even a preview that skips the flash still shows green, then blue-white,
       then desert amber — three different somewheres, in the right order, at
       the right moments. In the render it is what it always was: the eye
       catching up with something it saw. */
    let after = 0, tint = null;
    for (let i = 0; i < this.flashes.length; i++){
      const f = this.flashes[i];
      const dt = t - (f.t + f.dur);
      if (dt >= 0 && dt < 0.5){
        const a = Math.exp(-dt*9.0)*f.s;
        if (a > after){ after = a; tint = FLASH_WORLDS[f.w].tint; }
      }
    }

    /* Held low. An empty frame has no highlight to anchor it, so exposure
       here sets the whole picture and nothing pulls it back. */
    c.uExposure.value = 0.92 - 0.18*empty + 0.30*after;
    c.uBloom.value    = 0.08 + 0.45*after;
    c.uCA.value       = 0.0006;
    /* Strong, and radial rather than directional, which is the only kind of
       shaping this scene can take: a vignette says 'the frame has a centre',
       not 'the world has an up'. It is most of what keeps a near-flat grey
       from reading as a broken render. */
    c.uVignette.value = 0.42 + 0.22*empty;
    /* The highest grain in the film, deliberately. There is nothing else in
       the frame for the eye to hold, and a perfectly smooth grey at this size
       bands on any 8-bit display — the grain is simultaneously the texture,
       the dither, and the only evidence the picture is live. */
    c.uGrain.value    = 0.058;
    /* The lift is where the afterglow's colour goes. It adds before the gain
       and the tonemap, so on a field this flat it tints the whole frame — an
       afterimage of a place rather than a white blink. */
    c.uLift.value.setRGB(0.008 + (tint ? tint[0]*after*0.30 : 0),
                         0.010 + (tint ? tint[1]*after*0.30 : 0),
                         0.016 + (tint ? tint[2]*after*0.30 : 0));
    c.uGain.value.setRGB(0.96, 0.97, 1.02);
    /* And no WHITE on top of that, which is what 0.16*after was doing. uFlash is `col += uFlash` in the
       composite — a constant added to every pixel in linear light, before the
       exposure and before the 1/2.2 gamma, so the gamma pulls the bottom of
       its range wide open and it has no gentle setting on a dark frame:
       0.10 comes out as a 0.41 grey over the WHOLE picture, 0.16 as 0.53,
       0.30 as 0.70. See s10-third-passage.js for the measurement that found
       this and the arithmetic that predicts it.

       It is the wrong term here twice over. It took this scene's floor from
       0.243 to 0.504 — a flat pale card over the only two things in the
       frame, the fog and the world-silhouettes — and it did it in white,
       diluting the very tint above that is supposed to make the afterglow
       'an afterimage of a place rather than a white blink'. The lift keeps
       the colour; the exposure and the bloom carry the brightness. */
    c.uFlash.value    = 0.0;

    /* Nothing to focus on and nothing to defocus: a blur radius over a field
       this smooth costs a full pass and changes no pixel worth the name. */
    d.uStart.value = 10;
    d.uEnd.value   = 1200;
    d.uMaxRadius.value = 0.0;
  }

  debugLayers(){ return { dome: this.dome }; }

  dispose(){
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    if (this._gRT) for (const rt of this._gRT) rt.dispose();
    for (const w of this.worlds) if (w.scene.dispose) w.scene.dispose();
  }
}
