import * as THREE from 'three';
import { FSQuad, rt } from './fsq.js';
import { NOISE } from './glsl.js';

const HEAD = `${NOISE}\nin vec2 vUv; out vec4 fragColor;`;

/* ---------- 1. volumetric light shafts, marched against the depth buffer ---------- */
const VOLUMETRIC = /* glsl */`
uniform sampler2D tColor, tDepth;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec2 uTanFov, uLightTilt, uDrift;
uniform float uNear, uFar, uTime, uSurfaceY, uIntensity, uAbsorb, uExtinction,
              uShaftScale, uShaftGain, uShaftSharp;
uniform vec3 uShaftColor, uAmbColor;
uniform vec2 uTexel;
${HEAD}
float linearZ(float d){ float z=d*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }

void main(){
  vec3 scene = texture(tColor, vUv).rgb;
  float d = texture(tDepth, vUv).x;
  float sceneZ = (d >= 1.0) ? uFar : linearZ(d);

  vec2 ndc = vUv*2.0-1.0;
  vec3 dirV = vec3(ndc*uTanFov, -1.0);
  vec3 dirW = mat3(uCamWorld) * dirV;

  const int STEPS = 56;
  float maxZ = min(sceneZ, 150.0);
  float dz = maxZ/float(STEPS);
  float jitter = hash12(gl_FragCoord.xy + vec2(uTime*57.0)) * dz;

  vec3 acc = vec3(0.0);
  for(int i=0;i<STEPS;i++){
    float z = jitter + dz*float(i);
    vec3 p = uCamPos + dirW * z;
    float below = max(uSurfaceY - p.y, 0.0);
    float att   = exp(-below*uAbsorb);
    // trace this sample back up along the light direction onto the surface
    vec2 hit = (p.xz + below*uLightTilt + uDrift) * uShaftScale;
    vec3 inScatter = uShaftColor * shaftMask(hit) * uShaftGain + uAmbColor;
    acc += inScatter * att * dz;
  }
  acc *= uIntensity;

  /* In-scatter only. This pass used to multiply the scene by
     exp(-z*uExtinction) as well, and that could not be made correct: the scene
     is drawn 4x multisampled, so the COLOUR arriving here is resolved while the
     DEPTH is not, and a silhouette pixel — half near leaf, half far air — was
     being extinguished as if it were all leaf. Twenty-two times too bright on
     the background half is a one-pixel white line down every silhouette in the
     frame. Taking the farthest depth in the neighbourhood only swaps it for a
     black line. The extinction now lives in the geometry pass where the
     rasteriser can resolve it — see extinct() in core/glsl.js. */
  vec3 col = scene * exp(-min(sceneZ, 150.0)*uExtinction) + acc;
  fragColor = vec4(col, 1.0);
}`;



/* ---------- 1a. distance defocus: softens the horizon and stops far, thin
       highlights (ship lights, specular glitter) from aliasing frame to frame */
/* One place to turn the sensor texture up, down or off.
 *
 * The speckle and the grain are set per scene, because each register wants its
 * own amount — but "how much noise does this film have" is a single decision
 * and it should not be spread over thirteen files. Scenes set the ratio; this
 * sets the level. 0 removes it from the whole video.
 *
 * It is not zero because removing it entirely was measured and does not buy
 * what it looks like it should: in the seeker register the moving lattice, not
 * the noise, is what costs the encoder — see POLISH.md. */
export const NOISE_SCALE = 0.72;

const DEFOCUS = /* glsl */`
uniform sampler2D tSrc, tDepth;
uniform vec2 uTexel;
uniform float uNear, uFar, uStart, uEnd, uMaxRadius, uFocus, uNearScale, uPxScale, uSkyDefocus;
uniform float uWarp;          // 0 = off; otherwise the fraction of the radius smeared
uniform vec2  uWarpC;         // the vanishing point, in uv
uniform float uWarpMid, uWarpHalf;   // the tracked subject's range, and how wide it is
${HEAD}
float linearZ(float d){ float z=d*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }
void main(){
  /* Radial streak.

     Speed is not motion blur along the screen — at these closing rates every
     point in the frame is moving AWAY FROM THE POINT THE VEHICLE IS AIMED AT,
     and the faster it goes the longer each of those tracks gets. So the taps
     march back toward that vanishing point and a point source becomes a line
     pointing at it, which is what a long exposure of an approach looks like.
     The chromatic split rides the same axis for the same reason.

     It runs before the depth early-out on purpose: the sky is exempt from the
     defocus so that stars stay sharp, but stars are exactly what has to streak
     here. Zero by default, so no other scene sees this at all. */
  if(uWarp > 0.0001){
    /* The subject does not smear.

       A tracking shot puts the thing being tracked at rest on the sensor: the
       world sweeps past and the subject is the one part of the frame that is
       NOT moving, which is why it comes out sharp and everything else does not.
       Blurring the whole frame is a zoom effect, not a speed effect — it says
       the camera is moving rather than that the subject is.

       So the pixels at the subject's own range are exempt. uWarpHalf is how
       deep that window is; zero switches the whole exemption off, which is what
       the seeker view wants, because there the subject IS the world. */
    if(uWarpHalf > 0.0){
      float dz0 = texture(tDepth, vUv).x;
      if(dz0 < 0.9995){
        float zs = linearZ(dz0);
        float keep = 1.0 - smoothstep(uWarpHalf*0.55, uWarpHalf, abs(zs - uWarpMid));
        if(keep > 0.995){ fragColor = texture(tSrc, vUv); return; }
        if(keep > 0.005){
          vec2 rayK = vUv - uWarpC;
          float jK = hash12(gl_FragCoord.xy);
          vec3 sK = vec3(0.0); float wK = 0.0;
          for(int i=0;i<16;i++){
            float f = (float(i) + jK)/16.0;
            float sc = 1.0 - uWarp*(1.0 - keep)*f;
            float w  = 1.0 - f*0.72;
            sK += texture(tSrc, uWarpC + rayK*sc).rgb*w; wK += w;
          }
          fragColor = vec4(sK/wK, 1.0);
          return;
        }
      }
    }
    vec2 ray = vUv - uWarpC;
    /* Dithered, and sixteen taps rather than twelve.

       A fixed ladder of taps is a comb: anything small and bright — which in
       this scene is the vehicle — comes out as a row of separate dots rather
       than a streak, and a row of dots reads as a string of lights and not as
       one object moving. Offsetting the ladder by a per-pixel hash puts the
       gaps in different places on neighbouring pixels, which is the same trick
       the defocus rings use two branches below and for the same reason. */
    float j = hash12(gl_FragCoord.xy);
    vec3 sum = vec3(0.0); float wsum = 0.0;
    for(int i=0;i<16;i++){
      float f = (float(i) + j)/16.0;
      float sc = 1.0 - uWarp*f;
      float w  = 1.0 - f*0.72;                       // the head of the streak is the bright end
      float e  = uWarp*0.012*(0.30 + length(ray));
      sum.r += texture(tSrc, uWarpC + ray*(sc + e)).r*w;
      sum.g += texture(tSrc, uWarpC + ray*sc).g*w;
      sum.b += texture(tSrc, uWarpC + ray*(sc - e)).b*w;
      wsum += w;
    }
    fragColor = vec4(sum/wsum, 1.0);
    return;
  }
  float d = texture(tDepth, vUv).x;
  /* Nothing was drawn into depth here: that is the sky dome. Stars and the moon
     must stay sharp, so the background is normally exempt from the defocus.

     Normally. A rack that leaves the sky sharp is not a rack, it is a soft
     foreground: the eye reads the picture as resolved the moment ANY edge in it
     is resolved, and in a scene whose background is a nebula full of stars
     those edges are the whole frame. uSkyDefocus opens the exemption - the dome
     is then treated as lying far beyond the ramp, and its radius is scaled by
     the uniform so the exemption can be closed continuously rather than
     switched. Zero, the default and what Post.reset() restores, is exactly the
     old behaviour. */
  float sky = step(0.9995, d);
  if(sky > 0.5 && uSkyDefocus <= 0.0){ fragColor = texture(tSrc, vUv); return; }
  float z = sky > 0.5 ? uFocus + uEnd*4.0 : linearZ(d);
  /* Defocus measured from a FOCUS DISTANCE rather than from the lens.

     With uFocus at 0 this is exactly the old expression — everything nearer
     than uStart is sharp and the far field softens — which is what every scene
     that only wants the horizon taken off the boil still gets. Give it a focus
     distance and the same ramp opens in both directions from there, so a
     subject can sit sharp with the world going soft in front of it as well as
     behind. The near side is scaled because it is not symmetric in a real lens
     either: defocus grows faster on the near side of the plane of focus. */
  float dz = z - uFocus;
  /* uPxScale: radii are written against a 1080-line frame and scaled to the one
     being drawn. Everything measured in pixels here is otherwise measured in
     the WRONG pixels the moment the master is supersampled — see the note on
     the uniform in Post.render(). */
  float r = (dz >= 0.0
    ? uMaxRadius*smoothstep(uStart, uEnd, dz)
    : uMaxRadius*smoothstep(uStart*uNearScale, uEnd*uNearScale, -dz))*uPxScale
    *(sky > 0.5 ? uSkyDefocus : 1.0);
  if(r < 0.55*uPxScale){ fragColor = texture(tSrc, vUv); return; }

  // two rings of taps, rotated per pixel so the pattern never shows
  float a = hash12(gl_FragCoord.xy)*6.28318;
  float ca = cos(a), sa = sin(a);
  vec3 sum = texture(tSrc, vUv).rgb; float wsum = 1.0;
  for(int i=0;i<8;i++){
    float ang = a + float(i)*0.7853982;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 o1 = dir*r*0.55*uTexel;
    vec2 o2 = dir*r*1.00*uTexel;
    sum += texture(tSrc, vUv+o1).rgb*0.85; wsum += 0.85;
    sum += texture(tSrc, vUv+o2).rgb*0.55; wsum += 0.55;
  }
  fragColor = vec4(sum/wsum, 1.0);
}`;

/* ---------- 1b. POV register: phosphor CRT + HUD overlay ---------- */
const PHOSPHOR = /* glsl */`
uniform sampler2D tSrc, tHud;
uniform vec2 uTexel;
uniform float uAmount, uTime, uScan, uHorizonY, uRoll, uReticle, uAspect,
              uDilate, uNoise, uNoiseHz, uNoiseScale, uHud, uFloor, uCollapse, uRush, uBreak, uBreakEdge,
              uStretch, uJitter, uPxScale;
uniform vec3 uPhosphor;
${HEAD}
float lineMask(vec2 p, vec2 a, vec2 b, float w){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return 1.0 - smoothstep(0.0, w, length(pa - ba*h));
}
void main(){
  /* Break-up. The picture is read through a displaced coordinate rather than
     displaced after the fact, so the tear takes the HUD, the noise and the
     bleed with it — a slice that slides with clean text still sitting on it
     reads as an overlay bug, not as a signal coming apart. */
  vec2 suv = vUv;
  if(uBreak > 0.0){
    float sl  = floor(vUv.y*46.0);
    float now = floor(uTime*11.0);
    /* uBreakEdge biases the tear outward: a picture that comes apart at the
       edges first still has a centre to read, which is a different event from
       a picture that fails everywhere at once. 0 = everywhere, 1 = edges. */
    float edge = mix(1.0, smoothstep(0.08, 0.52, length(vUv - 0.5)), uBreakEdge);
    float on  = step(1.0 - uBreak*0.35*edge, hash12(vec2(sl, now)));
    suv.x += on*(hash12(vec2(sl*1.7, now + 9.0)) - 0.5)*0.10*uBreak*edge;
    vec2 blk  = floor(vUv*vec2(24.0, 14.0));
    float bon = step(1.0 - uBreak*0.22*edge, hash12(blk + floor(uTime*7.0)*13.0));
    suv += bon*(vec2(hash12(blk + 1.0), hash12(blk + 2.0)) - 0.5)*0.05*uBreak*edge;
    suv = clamp(suv, 0.0, 1.0);
  }

  vec3 src = texture(tSrc, suv).rgb;
  if(uAmount < 0.001 && uCollapse <= 0.0){ fragColor = vec4(src,1.0); return; }

  /* Speed stretch. A radial smear toward the centre — where the picture came
     from — rather than a symmetric blur: forward motion drags every mark
     outward across the frame, so its trail points inward. Additive rather than
     averaged, because these are lines on black and averaging only dims them. */
  if(uStretch > 0.001){
    /* Sixteen taps, not six. A max filter over few taps does not smear a line,
       it prints six copies of it — at the frame edge the spacing was nine
       pixels and the result read as ghosting, which is a different artefact
       with a different meaning. At sixteen the taps overlap and it reads as
       one mark being dragged. */
    vec2 radial = suv - 0.5;
    vec3 acc = src;
    for(int i=1;i<=16;i++){
      float f = float(i)/16.0;
      acc = max(acc, texture(tSrc, suv - radial*f*uStretch).rgb*(1.0 - f*0.80));
    }
    src = acc;
  }

  // 1 px lines are all WebGL will draw, so widen them here: a small max filter
  // reads as phosphor bleed rather than as a thicker line
  vec3 wide = src;
  for(int i=0;i<8;i++){
    float a = float(i)*0.7853982;
    wide = max(wide, texture(tSrc, suv + vec2(cos(a),sin(a))*uTexel*uDilate*uPxScale).rgb);
  }
  src = mix(src, wide, 0.72);

  // luminance -> phosphor ramp
  float l = dot(src, vec3(0.2126,0.7152,0.0722));
  l = max(l, texture(tHud, suv).r * uHud);
  // a floor, so large near-black surfaces stay black instead of turning into
  // a green wash — only actual light sources and lines should register
  vec3 green = uPhosphor * pow(clamp((l - uFloor)*2.9, 0.0, 1.15), 0.78);

  vec2 p = (vUv-0.5)*vec2(uAspect,1.0);

  // artificial horizon: rolls with the camera, slides with pitch
  float c = cos(uRoll), s2 = sin(uRoll);
  vec2 dir = vec2(c, s2);
  vec2 ctr = vec2(0.0, uHorizonY);
  float horizon = lineMask(p, ctr - dir*uAspect, ctr + dir*uAspect, 0.0026);
  // gap in the middle so the reticle stays readable
  horizon *= smoothstep(0.05, 0.11, abs(dot(p-ctr, dir)));

  /* The reticle judders when the airframe is working: it is drawn against a
     coordinate that is shaken, while the horizon is not — an instrument that
     cannot hold its own aim point, next to one that still can. */
  vec2 pr = p;
  if(uJitter > 0.0001){
    float j = floor(uTime*37.0);
    pr += (vec2(hash12(vec2(j, 11.0)), hash12(vec2(j, 23.0))) - 0.5)*uJitter;
  }

  // centre reticle: small cross with a gap
  float ret = 0.0;
  ret += lineMask(pr, vec2(-0.055,0.0), vec2(-0.018,0.0), 0.0038);
  ret += lineMask(pr, vec2( 0.018,0.0), vec2( 0.055,0.0), 0.0038);
  ret += lineMask(pr, vec2(0.0,-0.055), vec2(0.0,-0.018), 0.0038);
  ret += lineMask(pr, vec2(0.0, 0.018), vec2(0.0, 0.055), 0.0038);

  // sparse side ticks — texture, not information
  for(int i=-2;i<=2;i++){
    float y = float(i)*0.085;
    float w = (i==0) ? 0.030 : 0.017;
    ret += lineMask(pr, vec2(-0.34,y), vec2(-0.34+w,y), 0.0032)*0.55;
    ret += lineMask(pr, vec2( 0.34,y), vec2( 0.34-w,y), 0.0032)*0.55;
  }

  green += uPhosphor*(horizon*0.62 + min(ret,1.0)*uReticle*0.70);

  /* Rush. Radial streaks running from the reticle outward, spaced in angle and
     travelling in log radius so they slow near the centre and fly at the edge,
     which is what perspective does to anything passing the lens. It is drawn
     rather than modelled because there is nothing out there to model: at this
     altitude the ground gives no speed at all, and the scene is about speed. */
  if(uRush > 0.001){
    float r = length(p);
    float a = atan(p.y, p.x)/6.2831853 + 0.5;
    float k = 96.0;
    float ai = floor(a*k), af = fract(a*k);
    float seed = hash12(vec2(ai, 3.0));
    float ph = fract(seed + uTime*(0.55 + seed*0.55));
    float rr = exp(mix(-3.6, 0.20, ph));
    // thin: a mark passing the lens, not a cone of light
    float streak = exp(-abs(r - rr)*(240.0/(1.0 + rr*9.0)));
    float aq = (af - 0.5)*2.0;          // pow(x,2.0) is undefined for x<0
    streak *= exp(-aq*aq*90.0);
    streak *= smoothstep(0.03, 0.13, r)*(0.30 + 0.70*ph);
    green += uPhosphor*streak*uRush;
  }

  // scanlines + rolling refresh bar
  float scan = 0.86 + 0.14*sin(vUv.y*uScan);
  float roll = 0.97 + 0.03*sin((vUv.y + uTime*0.11)*6.28318);
  green *= scan*roll;
  // sensor noise: fine speckle plus a coarser drifting grain
  /* Speckle sized in REFERENCE pixels. Hashing the raw fragment coordinate
     gives one sample per framebuffer pixel, so a 2x supersampled master
     averages four of them per output pixel and the noise floor halves — the
     register's own texture quietly disappearing from the only version that
     matters. Quantising the coordinate first makes the speckle the same size in
     the finished picture at any render scale. */
  /* Held, and coarse.

     A new random field every frame at 60 fps, one sample per reference pixel,
     is the most expensive thing that can be handed to a video codec: every
     pixel changes every frame, motion estimation finds nothing to predict, and
     the bitrate goes into the grain instead of the picture. Measured on a POV
     frame pair, the noise was moving 4.3× as much of the image as the actual
     flight was — so three quarters of what YouTube was being asked to encode
     was static.

     Two changes, and neither is a compromise on the look. The field updates at
     uNoiseHz rather than per frame, so two frames in three are IDENTICAL in
     their noise and cost the encoder nothing; twenty per second is film-grain
     rate rather than video-noise rate, which is arguably more correct for a
     sensor anyway. And the cell is two reference pixels rather than one, which
     is a quarter of the samples and survives YouTube's own downscale, where
     single-pixel speckle simply turns to mud. */
  float tq = floor(uTime*uNoiseHz);
  vec2 npx = floor(gl_FragCoord.xy/(uPxScale*2.0));
  float n1 = hash12(npx + tq*97.0);
  float n2 = hash12(floor(npx*0.34) + tq*23.0);
  /* And a little quieter. A two-pixel cell covers four times the area of a
     one-pixel one, so the same amplitude reads considerably stronger; this
     holds the register's texture roughly where it was while taking a quarter
     off what changes on a refresh frame. */
  green += uPhosphor * ((n1-0.5)*1.15 + (n2-0.5)*0.70) * uNoise * uNoiseScale;
  green *= 0.92 + 0.08*n2;
  // occasional dropout band
  float dz = step(0.982 - uBreak*0.12, hash12(vec2(floor(uTime*9.0), floor(vUv.y*70.0))));
  green *= 1.0 - dz*(0.55 + 0.30*uBreak);

  /* Shutdown. A CRT losing its vertical deflection does not dim — it collapses:
     the raster closes from the top and bottom edges inward, everything that is
     left piles into one bright line across the middle, and the line decays.

     Only the BLEND collapses, not the picture. Where the raster has switched
     off the source frame shows through at full strength, so the display going
     dark reveals the world instead of blacking it out. That is the whole point
     of the moment: the vector image is not needed any more.

     uCollapse: 0 = normal, 0..1 = closing, >1 = the line dying. */
  float amt = uAmount;
  if(uCollapse > 0.0){
    float sq   = clamp(uCollapse, 0.0, 1.0);
    float band = pow(clamp(1.0 - sq, 0.0, 1.0), 0.75);
    float dy   = abs(vUv.y - 0.5)*2.0;
    // guard the edges apart: smoothstep(e,e,x) is undefined, and band hits 0
    float e1 = max(band, 2e-4), e0 = e1*0.86;
    amt *= 1.0 - smoothstep(e0, e1, dy);

    float w    = max(band*0.055, 0.0018);
    float line = exp(-(dy*dy)/(w*w))
               * smoothstep(0.0, 0.30, uCollapse)
               * exp(-max(uCollapse - 1.0, 0.0)*7.0);
    fragColor = vec4(mix(mix(src, green, amt), uPhosphor*2.4, clamp(line,0.0,1.0)), 1.0);
    return;
  }
  fragColor = vec4(mix(src, green, amt), 1.0);
}`;

/* ---------- 1c. copy ----------
   A plain resolve of the scene target into a texture something else can read.
   The bubbles in S1 are a refractive pass: they draw the picture BEHIND them,
   displaced by their own lens, which means they have to sample it — and a
   target cannot be sampled while it is being drawn into. */
const COPY = /* glsl */`
uniform sampler2D tSrc;
${HEAD}
void main(){ fragColor = texture(tSrc, vUv); }`;

/* ---------- 2. bright pass ---------- */
const BRIGHT = /* glsl */`
uniform sampler2D tSrc; uniform float uThreshold, uKnee;
${HEAD}
void main(){
  vec3 c = texture(tSrc, vUv).rgb;
  /* Scrub non-finite values before the bloom chain, not after.
     A single NaN written by any scene shader is not a single bad pixel: this
     pass feeds three successive downsamples, and a NaN in a downsample poisons
     every texel it is averaged into, so one pixel becomes a black block the size
     of a bloom tile. NaN fails its own equality test; Inf is caught by the
     magnitude check. Costs two comparisons and makes the whole chain immune to
     a class of bug that is otherwise invisible until it is on screen. */
  c = mix(vec3(0.0), c, vec3(equal(c, c)));
  c = clamp(c, vec3(0.0), vec3(1e4));
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float s = clamp((l-uThreshold)/max(uKnee,1e-4), 0.0, 1.0);
  fragColor = vec4(c*s, 1.0);
}`;

/* ---------- 3. separable gaussian ---------- */
const BLUR = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uDir;
${HEAD}
void main(){
  vec3 s = texture(tSrc, vUv).rgb*0.227027;
  s += (texture(tSrc, vUv+uDir*1.3846).rgb + texture(tSrc, vUv-uDir*1.3846).rgb)*0.316216;
  s += (texture(tSrc, vUv+uDir*3.2307).rgb + texture(tSrc, vUv-uDir*3.2307).rgb)*0.070270;
  fragColor = vec4(s, 1.0);
}`;

/* ---------- 4. composite: bloom + CA + grade + vignette + grain + tonemap ---------- */
const COMPOSITE = /* glsl */`
uniform sampler2D tSrc, tBloom0, tBloom1, tBloom2;
uniform float uBloom, uCA, uVignette, uGrain, uExposure, uTime, uFlash, uSplit, uBlack, uPxScale, uNoiseHz, uNoiseScale;
uniform float uShardAmt, uShardT, uShardCells, uShardSeed;
uniform float uFish, uAspect;
uniform float uDebugNaN;
uniform vec3 uLift, uGain;
${HEAD}
vec3 aces(vec3 x){
  const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
}

/* A SHATTERED flash.

   uFlash is a constant added to every pixel — the right instrument exactly
   once in this film, where the frame before a cut is already a flat white
   card and continuing it is a match cut. But a card that then fades evenly
   fades like a card, and the desert's arrival wanted it to come apart the way
   the false gateways on its own horizon do: 'lasisirpaleiden kasvava möykky',
   drawn in env/desert.js with F1/F2 cellular noise, because a Voronoi cell IS
   a flat-faced shard.

   So this is that same figure, at the size of the whole frame. Each cell
   carries its own departure threshold from the cell id, so they leave in a
   scattered order rather than together, and each flares along its own edges
   as it goes — glass catches light on the way out.

   The arithmetic is written so both ends are EXACT: at uShardT = 1 every
   cell's k is 1, which is the flat card and nothing else, and at uShardT = 0
   every k is 0, which is no card at all. A threshold scheme that only
   approaches zero would leave a permanent haze on the scene it uncovered. */
vec2 shardHash(vec2 p){
  p = fract(p*vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(vec2(p.x*p.y, p.y*p.x + 0.37));
}
vec3 shardCell(vec2 p){
  vec2 n = floor(p), f = fract(p);
  float md = 8.0, md2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j));
    vec2 o = shardHash(n + g + uShardSeed);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md){ md2 = md; md = d; id = fract(shardHash(n + g + uShardSeed + 3.7).x*7.13); }
    else if (d < md2){ md2 = d; }
  }
  return vec3(sqrt(md), id, sqrt(md2));
}
void main(){
  /* THE LENS. uFish bends the whole frame the way a very short lens does:
     the middle is magnified and the edges are squeezed into it, so straight
     lines bow outward. Written as a resample of the source rather than as a
     distortion of the geometry, because it has to apply to everything in the
     frame at once — a fisheye that a fog card or a sky dome did not know about
     would be the one flat thing in a bent picture.
 
     The offset is scaled DOWN with radius, never up: the destination edge
     reads from inside the source, so nothing is ever sampled from outside the
     frame and there is no smeared border. What it costs is the corners of the
     original, which is what a fisheye costs anyway.
 
     Aspect-corrected, or the bulge is an ellipse. Zero by default and reset
     every frame in Post.reset(), so a scene that wants a lens asks for one and
     no scene inherits it. */
  vec2 sc = vUv - 0.5;
  float r2 = dot(sc, sc);
  vec2 uv = vUv;
  if (uFish > 0.0001){
    vec2 pa = sc*vec2(uAspect, 1.0);
    float rr = dot(pa, pa);
    uv = 0.5 + sc*(1.0 - uFish*0.62*rr);
  }
  vec2 off = (uv-0.5);
  // chromatic aberration grows toward the edges
  float ca = uCA*(0.25+r2);
  /* uCA is radial and small — a lens. uSplit is flat and large — a signal
     losing its colour timing. They are different faults and both are wanted. */
  vec3 col;
  col.r = texture(tSrc, uv - off*ca + vec2(uSplit, 0.0)).r;
  col.g = texture(tSrc, uv).g;
  col.b = texture(tSrc, uv + off*ca - vec2(uSplit, 0.0)).b;

  /* Diagnostic. Press N in the preview.
     The scrub two lines below hides non-finite pixels by turning them black,
     which is indistinguishable from a pixel that is simply dark — so when
     something looks wrong there is no way to tell from the screen whether it is
     a NaN or a badly shaded triangle. With this on, anything non-finite comes
     out magenta instead, and the question is answered by looking. */
  if (uDebugNaN > 0.5){
    vec3 raw = texture(tSrc, uv).rgb;
    vec3 bl  = texture(tBloom0,uv).rgb + texture(tBloom1,uv).rgb + texture(tBloom2,uv).rgb;
    bool bad = !all(equal(raw, raw)) || any(greaterThan(abs(raw), vec3(1e6)));
    bool badBloom = !all(equal(bl, bl)) || any(greaterThan(abs(bl), vec3(1e6)));
    if (bad || badBloom){
      fragColor = vec4(bad ? vec3(1.0, 0.0, 1.0) : vec3(0.0, 1.0, 1.0), 1.0);
      return;
    }
  }

  /* Same scrub as the bright pass, on the direct path. A NaN reaching here
     survives clamp() and aces() with an undefined result and shows up as a
     black pixel; on the bloom path it shows up as a black tile. */
  col = mix(vec3(0.0), col, vec3(equal(col, col)));

  vec3 bloom = texture(tBloom0,uv).rgb*0.5 + texture(tBloom1,uv).rgb*0.32 + texture(tBloom2,uv).rgb*0.18;
  col += bloom*uBloom;
  if (uShardAmt > 0.0){
    vec3 vo = shardCell((vUv - 0.5)*vec2(uAspect, 1.0)*uShardCells);
    /* Softness w: how much of the range one cell spends going. Wide enough
       that a cell dissolves rather than blinking, narrow enough that the
       frame is not uniformly half-there for the whole move. */
    const float w = 0.25;
    float lo = vo.y*(1.0 - w);
    float k  = smoothstep(lo, lo + w, uShardT);
    float edge = smoothstep(0.10, 0.0, vo.z - vo.x);
    /* The rim flares while the cell is ON ITS WAY out and at no other time.
       k*k*(1-k), peaking at two thirds gone rather than halfway: k*(1-k) was
       the obvious form and it left the last cells as hollow outlines floating
       over a picture that had already resolved — at k = 0.06 it still returns
       0.22 of the peak, which is a drawn line. This returns 0.02. */
    float going = k*k*(1.0 - k)*6.75;
    float facet = 0.93 + 0.14*vo.y;
    col += uShardAmt*(k*facet + edge*(0.12*k + 0.85*going));
  }
  col += uFlash;

  col *= uExposure;
  col = uLift + col*uGain;                     // simple lift/gain grade
  col *= 1.0 - uVignette*smoothstep(0.15,0.75,r2);
  col = aces(col);
  col = pow(col, vec3(1.0/2.2));
  // reference pixels, for the same reason as the sensor speckle above
  float gq = floor(uTime*uNoiseHz);
  float g = hash12(floor(gl_FragCoord.xy/(uPxScale*2.0)) + vec2(gq*137.0, gq*71.0));
  col += (g-0.5)*uGrain*0.78*uNoiseScale;   // same reason as the speckle above
  // last of all, so a cut to black takes the grain with it
  col = mix(col, vec3(0.0), uBlack);
  fragColor = vec4(col, 1.0);
}`;

export class Post {
  constructor(renderer, w, h){
    this.renderer = renderer;
    /* Multisampling. Every camera in this project pans or tracks, so geometry
       silhouettes are swept across the pixel grid constantly; without MSAA the
       building and horizon edges crawl. */
    this.sceneTarget = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
      samples: 4
    });
    this.sceneTarget.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.volTarget = rt(w,h);
    this.refractTarget = rt(w,h);
    this.povTarget = rt(w,h);
    this.dofTarget = rt(w,h);
    const bw = w>>1, bh = h>>1;
    this.bright = rt(bw,bh);
    this.blur = [];
    for(let i=0;i<3;i++){
      const s = 1<<(i+1);
      this.blur.push([rt(Math.max(1,w/s|0), Math.max(1,h/s|0)), rt(Math.max(1,w/s|0), Math.max(1,h/s|0))]);
    }
    const U = (o)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{value:v}]));

    this.qVol = new FSQuad(VOLUMETRIC, U({
      tColor:null, tDepth:null, uCamWorld:new THREE.Matrix4(), uCamPos:new THREE.Vector3(),
      uTanFov:new THREE.Vector2(1,1), uNear:0.1, uFar:400, uTime:0,
      /* NOTE: inherited from Stingray, where this pass was underwater light.
         Off in every scene in this film (uIntensity 0), and skipped entirely
         when it is — see Post.render(). Its extinction term is still written
         against the same constant the scenes use, so a scene that switches this
         on gets the falloff twice; re-author it before using it. */
      uSurfaceY:46, uIntensity:0.0, uAbsorb:0.060, uExtinction:0.022,
      uShaftScale:0.055, uShaftGain:1.15, uShaftSharp:2.6,
      uShaftColor:new THREE.Color(0.40,0.88,1.00), uAmbColor:new THREE.Color(0.006,0.032,0.055),
      uLightTilt:new THREE.Vector2(0.42,0.24), uDrift:new THREE.Vector2()
    }));
    this.qDof = new FSQuad(DEFOCUS, U({
      tSrc:null, tDepth:null, uTexel:new THREE.Vector2(),
      uNear:0.25, uFar:1600, uStart:95, uEnd:620, uMaxRadius:2.7,
      uFocus:0, uNearScale:0.45, uPxScale:1, uSkyDefocus:0,
      uWarp:0, uWarpC:new THREE.Vector2(0.5,0.5), uWarpMid:0, uWarpHalf:0
    }));
    this.qPhos = new FSQuad(PHOSPHOR, U({
      tSrc:null, tHud:null, uTexel:new THREE.Vector2(), uAmount:0, uTime:0,
      uScan:900, uHorizonY:0, uRoll:0, uReticle:1, uAspect:16/9,
      uDilate:1.35, uNoise:0.055, uNoiseHz:12.0, uNoiseScale:NOISE_SCALE, uHud:1.0, uFloor:0.020, uCollapse:0.0,
      uRush:0.0, uBreak:0.0, uBreakEdge:0.0, uStretch:0.0, uJitter:0.0, uPxScale:1,
      uPhosphor:new THREE.Color(0.24,1.0,0.40)
    }));
    this.qCopy   = new FSQuad(COPY,   U({ tSrc:null }));
    this.qBright = new FSQuad(BRIGHT, U({ tSrc:null, uThreshold:1.05, uKnee:0.40 }));
    this.qBlur   = new FSQuad(BLUR,   U({ tSrc:null, uDir:new THREE.Vector2() }));
    this.qComp   = new FSQuad(COMPOSITE, U({
      tSrc:null, tBloom0:null, tBloom1:null, tBloom2:null,
      uBloom:0.55, uCA:0.0032, uVignette:0.70, uGrain:0.030, uExposure:1.0, uTime:0, uFlash:0.0, uPxScale:1, uNoiseHz:12.0, uNoiseScale:NOISE_SCALE,
      uShardAmt:0.0, uShardT:0.0, uShardCells:9.0, uShardSeed:0.0,
      uSplit:0.0, uBlack:0.0, uDebugNaN:0.0, uFish:0.0, uAspect:16/9,
      uLift:new THREE.Color(0.004,0.012,0.020), uGain:new THREE.Color(1.02,1.0,1.03)
    }));
  }
  /* Effects only one or two scenes use. A uniform lives in the pass, not in the
     scene, so anything left set leaks into whatever is previewed next — this is
     called once per frame before the scene writes its own values. */
  reset(){
    const ph = this.qPhos.u, c = this.qComp.u;
    ph.uCollapse.value = 0; ph.uRush.value = 0; ph.uBreak.value = 0;
    ph.uBreakEdge.value = 0; ph.uStretch.value = 0; ph.uJitter.value = 0;
    c.uFlash.value = 0; c.uSplit.value = 0; c.uBlack.value = 0; c.uFish.value = 0;
    c.uShardAmt.value = 0;
    /* The grade's lift and gain are not effects but they leak the same way:
       S10 sets a warm gain for the climax and S11 sets a black lift, and a
       scene that does not write them inherits whichever was previewed last.
       Restored here to the neutral values every other scene assumes. */
    c.uLift.value.setRGB(0.004, 0.012, 0.020);
    c.uGain.value.setRGB(1.02, 1.00, 1.03);
    /* The defocus leaks the same way and now has more to leak: S6 focuses on a
       subject two kilometres out and S12 opens the ramp right up for the city,
       and either one inherited by a scene that only sets the radius would put
       the wrong part of the frame in focus. Back to the constructed defaults —
       far softening only, no focal plane. */
    const d = this.qDof.u;
    d.uStart.value = 95; d.uEnd.value = 620; d.uMaxRadius.value = 2.7;
    d.uFocus.value = 0; d.uNearScale.value = 0.45; d.uSkyDefocus.value = 0;
    d.uWarp.value = 0; d.uWarpC.value.set(0.5, 0.5);
    d.uWarpMid.value = 0; d.uWarpHalf.value = 0;
  }
  setSize(w,h){
    this.qComp.u.uAspect.value = w/Math.max(1, h);
    this.sceneTarget.setSize(w,h); this.volTarget.setSize(w,h); this.povTarget.setSize(w,h); this.dofTarget.setSize(w,h);
    this.refractTarget.setSize(w,h);
    this.bright.setSize(w>>1,h>>1);
    this.blur.forEach((pair,i)=>{ const s=1<<(i+1); pair.forEach(t=>t.setSize(Math.max(1,w/s|0),Math.max(1,h/s|0))); });
  }
  /* refract: an optional Scene of objects that need to read the picture behind
     them. They are drawn AFTER everything else, into the same target and with
     its depth buffer intact, with a resolved copy of that picture bound to
     tScene — which is the only way anything in a forward renderer can be a
     lens. Nothing else in the film needs it yet; S1's bubbles do. */
  render(scene, camera, time, refract){
    const r = this.renderer;
    r.setRenderTarget(this.sceneTarget); r.clear(); r.render(scene, camera);

    if (refract && refract.children.length){
      /* Resolve first. sceneTarget is multisampled, and reading .texture
         triggers the resolve; copying it out means the refractive pass reads a
         finished picture and never samples the target it is drawing into. */
      this.qCopy.u.tSrc.value = this.sceneTarget.texture;
      this.qCopy.render(r, this.refractTarget);
      refract.traverse(o => {
        const u = o.material && o.material.uniforms;
        if (!u) return;
        if (u.tScene) u.tScene.value = this.refractTarget.texture;
        if (u.uRes) u.uRes.value.set(this.sceneTarget.width, this.sceneTarget.height);
      });
      r.setRenderTarget(this.sceneTarget);
      const ac = r.autoClear; r.autoClear = false;
      r.render(refract, camera);
      r.autoClear = ac;
    }

    const uv = this.qVol.u;
    uv.tColor.value = this.sceneTarget.texture;
    uv.tDepth.value = this.sceneTarget.depthTexture;
    uv.uCamWorld.value.copy(camera.matrixWorld);
    uv.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);
    uv.uTanFov.value.set(t*camera.aspect, t);
    uv.uNear.value = camera.near; uv.uFar.value = camera.far; uv.uTime.value = time;
    uv.uDrift.value.set(time*0.02, time*0.013);
    /* Skipped when there is no in-scatter, which is every scene in this film so
       far: with uIntensity at 0 the pass was a full-screen copy wrapped around
       fifty-six raymarch steps of nothing. The defocus reads the scene target
       directly instead. */
    const volOn = uv.uIntensity.value > 0.0;
    if (volOn) this.qVol.render(r, this.volTarget);

    /* How big a pixel is, against the 1080-line frame every number in this file
       was chosen on.

       The master is supersampled — the renderer draws at 2x and scales down —
       and every effect measured in framebuffer pixels is therefore half as wide
       in the finished picture as it is in the preview. Measured on a seeker
       frame: at 2x the sensor speckle all but disappears, because four
       framebuffer samples average into one output pixel and the noise floor
       halves. The defocus and the phosphor bleed shrink the same way.

       Geometry is supposed to get sharper with supersampling. The grade is not.
       So the passes that work in pixels take this factor and scale by it, and
       the ones that work in UV (scanlines, chromatic aberration, vignette,
       bloom on its own half-res chain) are already right and ignore it. */
    const pxScale = Math.max(this.dofTarget.height/1080, 1e-3);

    const df = this.qDof.u;
    df.uPxScale.value = pxScale;
    df.tSrc.value = volOn ? this.volTarget.texture : this.sceneTarget.texture;
    df.tDepth.value = this.sceneTarget.depthTexture;
    df.uTexel.value.set(1/this.volTarget.width, 1/this.volTarget.height);
    df.uNear.value = camera.near; df.uFar.value = camera.far;
    this.qDof.render(r, this.dofTarget);

    const ph = this.qPhos.u;
    ph.uPxScale.value = pxScale;
    ph.tSrc.value = this.dofTarget.texture;
    ph.uTime.value = time;
    ph.uAspect.value = camera.aspect;
    ph.uTexel.value.set(1/this.dofTarget.width, 1/this.dofTarget.height);
    // the shutdown line outlives uAmount, so the pass has to survive it too
    const povOn = ph.uAmount.value > 0.001 || ph.uCollapse.value > 0.0;
    if (povOn) this.qPhos.render(r, this.povTarget);
    const chainSrc = povOn ? this.povTarget.texture : this.dofTarget.texture;

    this.qBright.u.tSrc.value = chainSrc;
    this.qBright.render(r, this.bright);

    let src = this.bright.texture;
    for(let i=0;i<3;i++){
      const [a,b] = this.blur[i];
      const w = a.width, h = a.height;
      this.qBlur.u.tSrc.value = src; this.qBlur.u.uDir.value.set(1/w,0); this.qBlur.render(r,a);
      this.qBlur.u.tSrc.value = a.texture; this.qBlur.u.uDir.value.set(0,1/h); this.qBlur.render(r,b);
      src = b.texture;
    }
    const c = this.qComp.u;
    c.uPxScale.value = pxScale;                 // grain in reference pixels
    c.tSrc.value = chainSrc;
    c.tBloom0.value = this.blur[0][1].texture;
    c.tBloom1.value = this.blur[1][1].texture;
    c.tBloom2.value = this.blur[2][1].texture;
    c.uTime.value = time;
    this.qComp.render(r, null);
    r.setRenderTarget(null);
  }
}
