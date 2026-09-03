/* core/glsl.js's noise, on the CPU.
 *
 * Two files need to evaluate a height field outside a shader — desert.js, to
 * stand its false portals on the sand, and volcanic.js, to fly a camera over
 * terrain without going through it — and both need the answer the GPU is
 * about to give, not one like it. So this is a mirror of the NOISE chunk in
 * core/glsl.js, constant for constant, and the two have to move together.
 *
 * One line of warning about that chunk, because it is the trap here: GLSL
 * builds matrices in COLUMN order, so mat2(a,b,c,d) is the rows [[a,c],[b,d]],
 * not [[a,b],[c,d]]. Transposing it by accident gives noise that looks
 * perfectly plausible on its own and shares no features whatever with the
 * terrain actually on screen, which is the worst kind of wrong for something
 * whose only job is to agree.
 *
 * The two run at different precisions — float32 on the GPU, float64 here — so
 * they do not agree bit for bit. They agree to a small fraction of a unit
 * against terrain heights of hundreds, which is far below anything that could
 * show at the ranges either caller works at.
 */

export function hash22(x, y){
  let p0 = x*0.1031, p1 = y*0.1030, p2 = x*0.0973;
  p0 -= Math.floor(p0); p1 -= Math.floor(p1); p2 -= Math.floor(p2);
  const d = p0*(p1 + 33.33) + p1*(p2 + 33.33) + p2*(p0 + 33.33);
  p0 += d; p1 += d; p2 += d;
  let a = (p0 + p1)*p2, b = (p0 + p2)*p1;
  a -= Math.floor(a); b -= Math.floor(b);
  return [a*2 - 1, b*2 - 1];
}

export function gnoise(x, y){
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx*fx*fx*(fx*(fx*6 - 15) + 10);
  const uy = fy*fy*fy*(fy*(fy*6 - 15) + 10);
  const g = (cx, cy) => {
    const h = hash22(ix + cx, iy + cy);
    return h[0]*(fx - cx) + h[1]*(fy - cy);
  };
  const a = g(0, 0), b = g(1, 0), c = g(0, 1), d = g(1, 1);
  const mix = (u, v, k) => u + (v - u)*k;
  return mix(mix(a, b, ux), mix(c, d, ux), uy)*0.72 + 0.5;
}

export function fbm(x, y){
  let a = 0.5, s = 0, px = x, py = y;
  for (let i = 0; i < 5; i++){
    s += a*gnoise(px, py);
    const rx = 0.80181*px - 0.59758*py;
    const ry = 0.59758*px + 0.80181*py;
    px = rx*2.03 + 11.7; py = ry*2.03 + 11.7;
    a *= 0.5;
  }
  /* smoothstep(0.038, 0.930, s) */
  const u = Math.min(1, Math.max(0, (s - 0.038)/(0.930 - 0.038)));
  return u*u*(3 - 2*u);
}
