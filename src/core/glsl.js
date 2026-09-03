// Shared GLSL chunks reused by scene + post shaders.
export const EXTINCT = /* glsl */`
/* Distance extinction: the falloff every scene in this film is graded against.

   It used to live in the volumetric post pass, applied as scene*exp(-z*k) with
   z read from the depth buffer. That could not be made correct. The scene is
   drawn into a 4x multisampled target, so the COLOUR that reaches a post pass
   is resolved — a silhouette pixel is a coverage-weighted blend of the leaf in
   front and the four hundred metres of air behind — while the DEPTH is not: a
   depth resolve keeps one sample. Multiplying a half-and-half colour by the
   extinction owed to twelve metres put the background half of it twenty-two
   times too bright, which is a one-pixel white line down the lit side of every
   silhouette in the frame. Taking the farthest depth in the neighbourhood
   instead just swaps it for a one-pixel black line, because the foreground half
   is then twenty times too dark.

   There is no depth that is right for a blended pixel. So it moves here, into
   the geometry pass, where the rasteriser resolves the extinguished colour
   along with everything else and an edge pixel gets exactly the blend it should
   — which is what multisampling is for.

   Radial distance rather than view-space z, which is what the post pass used:
   at the corner of a 16:9 frame that is about fifteen percent more air, and
   fifteen percent more air is the truth. */
const float EXT_K = 0.022;      // per unit
const float EXT_MAX = 150.0;    // beyond this the air is saturated and it stops
vec3 extinct(vec3 col, float dist){
  return col*exp(-min(dist, EXT_MAX)*EXT_K);
}
/* For a scene with no air in it.

   The tunnel and the void between worlds are not full of anything: there is
   nothing between the camera and a ring for the light to be lost in, and what
   falloff those scenes have is authored — a 1/(1+d) on the wall, a fade on the
   mist — not physical. When the extinction lived in the post pass they got it
   anyway, at the saturated value, because nothing was ever written into their
   depth buffer; every brightness constant in tunnel.js was then chosen against
   that. So it stays, as what it always actually was: the constant the film's
   grade sits at. Distance-extinguishing those scenes for real would brighten
   them by a factor of about twenty-seven and mean re-authoring every colour in
   them for no gain. */
vec3 extinctVoid(vec3 col){
  return col*exp(-EXT_MAX*EXT_K);
}`;

export const NOISE = /* glsl */`
float hash11(float p){ p=fract(p*.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),
             mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y);
}

/* Gradient noise, and rotated octaves.
 *
 * fbm() used to be five octaves of vnoise() with the domain simply doubled
 * between them, and that combination has a signature you cannot un-see once you
 * have: a grid.
 *
 * Two causes and they compound. VALUE noise puts its extrema ON the integer
 * lattice — every local maximum is a lattice point and every saddle is an edge
 * midpoint — so the field is a grid of blobs with axis-aligned creases between
 * them. And doubling the domain without turning it means every octave's lattice
 * is aligned with every other octave's, so the creases of all five land on the
 * same two axes and reinforce instead of cancelling.
 *
 * Gradient noise fixes the first: the value is zero at every lattice point and
 * the structure lives BETWEEN them, so there is nothing at the grid to see. The
 * quintic fade curve rather than the cubic one matters here too — with the
 * cubic, the second derivative jumps at every cell boundary, which is invisible
 * in the noise itself and very visible in anything that takes its slope, like a
 * water normal.
 *
 * And a rotation of about thirty-seven degrees between octaves fixes the
 * second. It is irrational in the useful sense: no number of applications
 * brings the lattices back into alignment, so whatever is left of a grid in one
 * octave is at a different angle in the next and never accumulates. The offset
 * per octave is there so the origin is not a special point either.
 */
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz)*p3.zy)*2.0 - 1.0;
}
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0 - 15.0) + 10.0);
  float a = dot(hash22(i + vec2(0,0)), f - vec2(0,0));
  float b = dot(hash22(i + vec2(1,0)), f - vec2(1,0));
  float c = dot(hash22(i + vec2(0,1)), f - vec2(0,1));
  float d = dot(hash22(i + vec2(1,1)), f - vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y)*0.72 + 0.5;
}
float fbm(vec2 p){
  const mat2 R = mat2(0.80181, 0.59758, -0.59758, 0.80181);   // ~36.7 degrees
  float a = 0.5, s = 0.0;
  for(int i=0;i<5;i++){
    s += a*gnoise(p);
    p = R*p*2.03 + 11.7;
    a *= 0.5;
  }
  /* Matched to the distribution the old value-noise fbm had, and this is not
     cosmetic bookkeeping — it is the whole reason the jungle went flat when the
     noise changed underneath it.
     Gradient noise is far more Gaussian than value noise: same mean, but the
     standard deviation of five octaves measured 0.073 against the old 0.123,
     and the tail is what everything downstream reads. The jungle's dapple is
     smoothstep(0.52, 0.92) on a sum of two of these — a threshold sitting three
     sigma out — so a forty-percent narrower distribution did not dim the light
     patches, it very nearly deleted them: the 99.9th percentile fell from 0.82
     to 0.71, and after the dapple's own curve that is three times less light on
     the forest floor.
     A monotonic remap with a slope of about 1.7 at the centre puts sigma and
     the tail back where they were (0.120 and 0.842 measured against 0.123 and
     0.820), so every constant tuned against the old noise still means what it
     meant. smoothstep rather than a multiply so it saturates smoothly instead
     of clipping. */
  return smoothstep(0.038, 0.930, s);
}`;

/* Analytic height fog: density falls off exponentially with altitude, integrated
   along the view ray. Gives a mist layer that sits on the sea and thins upward,
   instead of a uniform distance fog. */
export const HEIGHT_FOG = /* glsl */`
float heightFog(vec3 camPos, vec3 world, float density, float falloff, float baseY){
  vec3 d = world - camPos;
  float dist = length(d);
  if(dist < 1e-4) return 0.0;
  float a = density * exp(-falloff*(camPos.y - baseY));
  float b = falloff * (d.y/dist);
  float t = abs(b) > 1e-5 ? (1.0 - exp(-b*dist))/b : dist;
  return 1.0 - exp(-a*max(t,0.0));
}`;

/* Sum of Gerstner waves. Horizontal displacement is what sharpens the crests
   and flattens the troughs — the main thing a plain sine field cannot do. */
export const GERSTNER = /* glsl */`
struct WaveOut { vec3 pos; vec3 nrm; float jac; };

/* An open water surface.
 *
 * Requires NOISE (fbm) to be included ahead of it, in both the vertex and the
 * fragment shader.
 *
 * Three attempts at this, and the useful part is why the first two looked like
 * a pattern rather than like water.
 *
 *   SIX WAVES IS A CHORD. Six components with tidy wavelengths beat against
 *   each other on a period you can see, and from underneath — where the whole
 *   surface is in frame at once — the beat is the tile. Twenty-two components
 *   in a geometric progression with an irrational ratio, and phase offsets off
 *   the golden ratio, so no two of them ever line up again.
 *
 *   ONE AXIS IS A COMB. Fanning every component around a single direction gave
 *   a surface that was combed: every ripple in the frame running the same way,
 *   which is a texture, not a sea. Only the longest few share a direction now —
 *   that is the swell, and a swell does have one — and everything from the
 *   fourth component down takes its direction from the golden angle, which
 *   spreads over the full circle and never clumps. Isotropic chop on oriented
 *   swell is what open water actually is.
 *
 *   AND A PERIODIC MODULATION IS STILL PERIODIC. Bunching the chop onto the
 *   long wave's own phase is a real effect and it made things worse: it put a
 *   second, slower, VERY visible rhythm over the first, and the surface went
 *   from tiled to corduroy. What varies the roughness of real water is not a
 *   sine, it is patches — slicks and cat's paws that have no wavelength at all.
 *   So the roughness is an fbm field, drifting slowly, and there is no period
 *   in it to find.
 *
 * The mesh is about seven units a quad and the shortest components are under
 * three, so the spectrum is split: geometry carries what the mesh can hold and
 * everything finer goes into the NORMAL per fragment, where it has no
 * resolution to alias against.
 */
const int   WAVE_N     = 22;
/* Where the spectrum stops being geometry.
 *
 * This was at eleven, which left the finest GEOMETRIC wave at twenty units —
 * and twenty units, four hundred away and seen at a grazing angle, is a dozen
 * pixels. So the smallest thing the ceiling could show was a dozen pixels
 * across, and a ceiling whose finest detail is a dozen pixels across is a field
 * of cells. The mesh was the resolution limit and it was visible as one.
 *
 * Seven puts everything below about fifty units into the normal instead, where
 * it has no resolution at all: each component fades by its own pixel footprint,
 * so the near water is finely worked and the far water smoothly loses detail
 * and gains roughness. Which is what distance does.
 *
 * Nothing is lost by not displacing them. Seen from below, this surface is read
 * entirely through the angle of its normal — the displacement matters for the
 * silhouette of a wave against the sky, and there is no sky and no silhouette
 * down here. */
const int   WAVE_SPLIT = 7;
const float WAVE_L0    = 340.0;
const float WAVE_RATIO = 0.8305;
const float WAVE_SWELL = 0.62;  // the direction the long waves run, in radians

/* How rough this patch of water is. A drifting field with no period in it, so
   there are calm lanes and rippled lanes and they never come back around. */
float waveRough(vec2 xz, float time, float scale){
  vec2 q = xz/(scale*230.0);
  float a = fbm(q + vec2(time*0.011, -time*0.008));
  float b = fbm(q*2.7 - vec2(time*0.019, time*0.014));
  return 0.30 + 1.45*smoothstep(0.28, 0.82, a*0.72 + b*0.38);
}

void waveParams(int i, float scale, float rough,
                out float k, out float A, out vec2 d, out float ph0){
  float fi = float(i);
  float f  = fi/float(WAVE_N - 1);            // 0 = longest, 1 = shortest
  float L  = WAVE_L0*pow(WAVE_RATIO, fi)*scale;
  k = 6.28318/L;
  /* Amplitude falls a little slower than the wavelength, which keeps the
     steepness roughly constant down the spectrum — that is what makes small
     waves look like small waves and not like scratches. */
  A = 1.70*pow(L/(WAVE_L0*scale), 0.88)*scale;

  /* Direction. The golden angle for the chop: equidistributed over the whole
     circle, and consecutive components land nowhere near each other, so no two
     ever comb together. The swell keeps its own axis with a little spread. */
  float iso = fi*2.39996323 + 1.7;
  float sw  = WAVE_SWELL + (fract(fi*0.6180339887) - 0.5)*0.42;
  float mixd = smoothstep(1.0, 4.5, fi);
  vec2 ds = vec2(cos(sw), sin(sw));
  vec2 di = vec2(cos(iso), sin(iso));
  d = normalize(mix(ds, di, mixd) + vec2(1e-5, 0.0));

  /* Roughness touches the chop and leaves the swell alone: a slick flattens the
     ripple on the water, it does not flatten the sea. */
  A *= mix(1.0, rough, smoothstep(0.18, 0.62, f));
  ph0 = fract(fi*0.7548776662)*6.28318;
}

/* The part the mesh can hold. */
WaveOut gerstner(vec2 xz, float time, float steep, float scale){
  float rough = waveRough(xz, time, scale);
  vec3 p = vec3(xz.x, 0.0, xz.y);
  vec3 n = vec3(0.0, 1.0, 0.0);
  float jac = 0.0;
  for(int i=0;i<WAVE_SPLIT;i++){
    float k, A, ph0; vec2 d;
    waveParams(i, scale, rough, k, A, d, ph0);
    float Q  = steep/(k*A*float(WAVE_N));     // keep crests from self-intersecting
    float ph = k*dot(d, xz) + time*sqrt(9.81*k) + ph0;
    float c = cos(ph), s = sin(ph);
    p.x += Q*A*d.x*c;
    p.z += Q*A*d.y*c;
    p.y += A*s;
    n.x -= d.x*k*A*c;
    n.z -= d.y*k*A*c;
    jac += Q*k*A*s;
  }
  n.y = 1.0 - jac;
  WaveOut o; o.pos = p; o.nrm = normalize(n); o.jac = jac;
  return o;
}

/* The rest of it, as slope and curvature, evaluated wherever it is looked at.
   xy = the slope to add to the normal; z = the extra jacobian, which is what
   focuses light and therefore what draws the caustics.

   px is the width of a pixel in world units — max(fwidth(x), fwidth(z)) at the
   call site. It is a parameter and not an fwidth() in here because this chunk
   is compiled into the vertex shader as well, and a derivative there is not
   merely wrong, it will not compile.

   Fading each component by its own pixel footprint is not optional polish. The
   shortest component is under three units and most of this surface is six
   hundred units away, so without it every one of these waves is far below a
   pixel — and a sub-pixel pattern does not get finer, it aliases into a
   fixed-size speckle that sits on the picture like chain mail and does not move
   with the water. The same rule the leaves and the rain in the jungle are
   under: a pattern too fine to resolve gets FAINTER, never smaller.

   Short waves are also much flatter than the spectrum alone would make them.
   Surface tension caps how steep a capillary wave can get; without the cap
   these components were putting tens of degrees of slope on the normal, which
   flipped Snell's window on and off inside a single pixel and read as grit. */
vec4 ripple(vec2 xz, float time, float steep, float scale, float px){
  float rough = waveRough(xz, time, scale);
  vec3 acc = vec3(0.0);
  float unres = 0.0;
  for(int i=WAVE_SPLIT;i<WAVE_N;i++){
    float k, A, ph0; vec2 d;
    waveParams(i, scale, rough, k, A, d, ph0);
    /* The capillary cap, applied by size rather than to everything in here.
       Surface tension limits how steep a SHORT wave can be; it has nothing to
       say about a forty-unit one, and flattening those by a fifth would take
       the body out of the water. */
    float fi2 = float(i)/float(WAVE_N - 1);
    float A0 = A*mix(0.85, 0.20, smoothstep(0.35, 0.80, fi2));
    float L = 6.28318/k;
    float vis = 1.0 - smoothstep(L*0.10, L*0.44, px);
    /* What we could not draw still exists.
       Fading a component out by its pixel footprint is the right thing to do
       with its GEOMETRY — but the water it stood for does not become flat, it
       becomes rough at a scale below the pixel. Keeping the mean-square slope
       of everything that was dropped turns it into a roughness the shading can
       use, which is what a real photograph averages over inside one pixel. */
    float slope = k*A0;
    float miss = 1.0 - vis;
    unres += miss*miss*slope*slope*0.5;
    if (vis <= 0.001) continue;
    A = A0*vis;
    float Q  = steep/(k*A*float(WAVE_N));
    float ph = k*dot(d, xz) + time*sqrt(9.81*k) + ph0;
    acc.x -= d.x*k*A*cos(ph);
    acc.y -= d.y*k*A*cos(ph);
    acc.z += Q*k*A*sin(ph);
  }
  return vec4(acc, sqrt(unres));
}`;




/* One-pixel antialiased lattice, shared by the city and the ridge so both
   registers draw with exactly the same line.

   Two halves, and the second matters as much as the first. Once a cell is
   narrower than about a pixel, every pixel lands on a line and the grid
   solidifies into a flat sheet — so the pattern is faded out by its own cell
   size, by fwidth and never by distance.

   Sub-pixel widths need care too. Narrowing the ramp below a pixel breaks the
   line into dashes, because most pixels then fall outside it. A real thin line
   does not get narrower than a pixel — it gets FAINTER, its coverage of the
   pixel dropping with its width. So the geometry is held at half a pixel and
   anything thinner is expressed as intensity. */
export const LATTICE = /* glsl */`
float lattice(vec2 uv, float cell, float width);
float latticeLod(vec2 uv, float cell, float width, float minPx);
float lattice(vec2 uv, float cell, float width){
  vec2 g = uv/cell;
  vec2 w = fwidth(g);
  vec2 d = abs(fract(g - 0.5) - 0.5)/max(w, vec2(1e-5));
  float wpx = max(width, 0.5);
  float line = (1.0 - min(min(d.x, d.y)/wpx, 1.0)) * min(width/0.5, 1.0);
  float vis = 1.0 - smoothstep(0.16, 0.55, max(w.x, w.y));
  return line*vis;
}

/* The same graticule with the cell doubling as it recedes.

   A fixed cell has one usable range of distances and two failure modes either
   side of it: close up it is a wide-open grid with nothing in it, and far away
   the cells fall below a pixel, where lattice() correctly gives up and the
   surface goes blank. Both were visible in the sea POV — the horizon simply
   stopped, several hundred metres short of where the water actually ends.

   So the level is chosen per pixel from the screen-space derivative: whichever
   power-of-two multiple of the base cell keeps a cell at least minPx pixels
   across. Consecutive levels are crossfaded by the fractional part, so lines
   thin out and vanish as they recede rather than popping, and the grid reaches
   the horizon at a constant apparent density — which is what an instrument
   drawing a graticule would do, and what the fixed cell was pretending to do
   over the small part of the frame where it happened to be right. */
float latticeLod(vec2 uv, float cell, float width, float minPx){
  vec2 w = fwidth(uv);
  float px = max(max(w.x, w.y), 1e-6);
  float lod = max(0.0, log2(px*minPx/cell));
  float l = floor(lod), f = lod - l;
  float c0 = cell*exp2(l);
  return mix(lattice(uv, c0, width), lattice(uv, c0*2.0, width), f);
}`;
