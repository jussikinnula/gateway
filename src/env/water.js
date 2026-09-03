import * as THREE from 'three';
import { NOISE, GERSTNER, EXTINCT } from '../core/glsl.js';

/* The membrane — the surface of the water, seen from underneath.
 *
 * The whole film rests on this shot reading as a gateway rather than as a
 * swimming pool, and the thing that does that is Snell's window: from below the
 * surface, everything above the water is compressed into a cone about 48.6°
 * wide, and outside that cone the surface is a mirror of the dark water. So a
 * swimmer looking up does not see a bright ceiling — they see one bright circle
 * in an otherwise black one. That is a portal, and it is free, because it is
 * what water actually does.
 *
 * The waves move the normal, so the edge of the window ripples on its own. No
 * animation is authored on it; it is the Gerstner field showing through.
 *
 * Second pass at this. The first one drew the window with a smoothstep — a
 * hand-picked width around a hand-picked critical-angle constant, dimmed
 * toward the rim by a second hand-picked curve — and every one of those was a
 * knob that had to be found by looking at a render and guessing. The width
 * knob in particular was fighting the actual physics the whole time: it was
 * standing in for what a real dielectric boundary does on its own, which is
 * Fresnel reflectance, and Fresnel reflectance already contains a rim that
 * gets more reflective toward the critical angle and hits exactly 1.0 there
 * — for free, from the real refractive indices, not from a constant. So the
 * window's shape is not drawn any more. It is what is left over after asking,
 * at every pixel, how much of the light actually gets through a water/air
 * boundary at that angle — the same question a real photograph is an answer
 * to. The things that were genuinely earned in the first pass — the pixel-
 * footprint antialiasing, the S4 rings gate, the microfacet roughness feed —
 * are real fixes for real aliasing and they stay; it is the shape of the
 * window itself, and what the mirror outside it shows, that are rebuilt.
 */
export function buildMembrane(){
  const geo = new THREE.PlaneGeometry(3200, 3200, 380, 380);
  geo.rotateX(-Math.PI/2);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime:  { value: 0 },
      uCam:   { value: new THREE.Vector3() },
      uSky:   { value: new THREE.Color(0.55, 0.92, 1.0) },  // what is on the other side
      uOpen:  { value: 0.0 },   // 0 = the window is just a window, 1 = it is open
      uFade:  { value: 1.0 },
      uScale: { value: 1.0 },
      /* Where the plane fades to hide its own edge. Authored for S1/S4: the
         membrane there sits tens to a couple hundred units from camera, and
         900-1450 is real physical range — the water beyond it, not the
         plane. A scene that holds this same geometry much farther out (the
         desert's flickers, at thousands of units, genuinely far away on
         purpose rather than close and softened) needs that cutoff moved out
         with it, or the plane is fully transparent, alpha zero, before it is
         ever close enough to draw — not dim, gone. Defaults reproduce the
         old hardcoded 900/1450 exactly, so S1 and S4 are unaffected. */
      uFadeNear: { value: 900.0 },
      uFadeFar:  { value: 1450.0 },
      /* How much water is in the way, per unit.
         Snell's window is angular: it is a 97-degree cone whatever the depth,
         so from six hundred units down the geometry says you should still see
         it exactly as large as you would from one. What actually hides it is
         the water — and that is the whole first minute of this film. So the
         surface resolving out of the dark is not an authored fade, it is this
         number and the camera getting closer to the surface. S4 sets it to
         nothing once it is through. */
      uMurk:  { value: 0.0 },
      /* The water's own colour, pre-extinction — the SAME number the murk dome
         and the seabed are given, not a colour picked to match them by eye.
         It does three jobs now: it is what the mirror outside the window
         reflects, it is what the whole surface fades toward at range, and it
         is what a scene that never touches this uniform gets by default,
         which is nothing visible — extinctVoid() of this default is a few
         thousandths, i.e. black, exactly like the old zero uRefl. */
      uMurkCol: { value: new THREE.Color(0.004, 0.020, 0.031) },
      /* How bright that colour reads as a reflection. Zero by default — S4
         never sets this and must not grow a mirror it never asked for; S1
         sets it every frame from the same "how much light gets down" number
         that brightens the water dome. */
      uAmb:   { value: 0.0 },
      /* 0 = whatever is on the other side is a flat colour (S4: it is a tunnel,
         and a tunnel has no horizon). 1 = it is a sky, and you can see into it.
         Default off so the passage is untouched. */
      uSkyMix: { value: 0.0 },
      uSkyTop: { value: new THREE.Color(0.10, 0.34, 0.90) },
      uSkyLow: { value: new THREE.Color(0.55, 0.86, 0.96) },
      uCloud:  { value: 0.75 },
      uDebug:  { value: 0 },
      uRings:  { value: 0.0 },
      /* How much of the sun's own glow and halo reach the window, separate
         from uOpen. 1 by default, so a scene that never sets it — S4 — is
         unaffected. S1 sets it every frame from whether there is actually a
         gap in the clouds aboveWater() is drawing, so a hot spot cannot
         appear in the window while the ceiling it sits on shows unbroken
         cloud: a shaft needs a gap to be shining through, or it is a beam
         with no source. */
      uSunVis: { value: 1.0 },
      /* Where the light is, in world space, above the surface. It moves, so
         the bright part of the window moves with it and the shafts swing. */
      uSun:   { value: new THREE.Vector3(0, 1400, 0) },
      /* 0 = an open water surface: gerstner() owns the vertex's position,
         full stop, computed from world XZ alone with world Y discarded —
         correct for S1/S4, where this mesh IS the sea.
         1 = a rigid plane: the object's own transform decides where a vertex
         lands, the way every other mesh in this engine works. Added for the
         desert's flicker, which reuses this shader for its fragment-side
         'gateway' look — the Fresnel window, the refracted sun, the rings —
         while asking for a flat membrane held at an altitude and angle of
         its own choosing, not a patch of sea. Checked directly why 'stood
         on end' first did nothing at all, not even dimly: gerstner(wp.xz,..)
         reads only the world X and Z of a vertex and RETURNS its own Y from
         the wave sum, discarding whatever the object's rotation and
         translation had put there — so a membrane rotated upright and lifted
         to y=150 was, after this line, silently flattened back down near
         y=0 every frame, sitting inside or under the opaque dune terrain,
         which is a rigid mesh and was never being fooled by any of it. */
      uUpright: { value: 0.0 }
    },
    vertexShader: /* glsl */`
      ${NOISE}
      ${GERSTNER}
      uniform float uTime, uScale, uUpright;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vJac;
      varying vec2 vLocalXY;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        if (uUpright > 0.5){
          vWorld = wp.xyz;
          vNrm = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
          vJac = 0.0;
          vLocalXY = position.xy;
          gl_Position = projectionMatrix * viewMatrix * wp;
        } else {
          vLocalXY = vec2(0.0);
          WaveOut w = gerstner(wp.xz, uTime, 0.42, uScale);
          vec3 p = vec3(w.pos.x, w.pos.y, w.pos.z);
          vWorld = p; vNrm = w.nrm; vJac = w.jac;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${NOISE}
      ${EXTINCT}
      ${GERSTNER}
      uniform vec3 uCam, uSky, uMurkCol, uSun, uSkyTop, uSkyLow;
      uniform float uTime, uOpen, uFade, uMurk, uScale, uSkyMix, uCloud, uDebug, uRings, uAmb, uSunVis;
      uniform float uFadeNear, uFadeFar, uUpright;
      varying vec2 vLocalXY;

      /* What is above the water, looked up in the direction the view ray leaves
         in. The surface is not a lid with a light behind it — it is a window,
         and a window shows you what is out there. Snell compresses the entire
         sky into a 97-degree cone, so the whole of it is in the window at once:
         the blue overhead near the middle, the pale horizon squeezed into the
         rim, and the clouds bent in with it. Getting the CONTENT of the window
         right is worth more than any amount of work on its edge.

         No sun in here on purpose — the source is handled outside, once, so it
         cannot be drawn twice and disagree with the shafts. */
      vec3 aboveWater(vec3 dir, float time){
        float up = clamp(dir.y, 0.0, 1.0);
        vec3 c = mix(uSkyLow, uSkyTop, pow(up, 0.42));
        /* Clouds on a plane. Projected along the ray, so they stretch toward
           the rim of the window exactly as the sky does. */
        float t = 1.0/max(up, 0.055);
        vec2 q = dir.xz*t*1.05 + vec2(time*0.010, time*0.006);
        float n = fbm(q*0.85);
        float m = fbm(q*2.4 + 17.0);
        float cl = smoothstep(0.38, 0.84, n*0.70 + m*0.38)*smoothstep(0.02, 0.30, up);
        return mix(c, vec3(1.06, 1.07, 1.10), cl*uCloud);
      }
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vJac;

      /* Fresnel reflectance for an unpolarised ray crossing a water/air
         boundary, water side. eta is n_water/n_air for this colour channel —
         water is very slightly more refractive to blue than to red, which is
         the dispersion that fringes the window's rim in a real photograph.
         Beyond the critical angle sin2t saturates past 1 and this returns
         1.0 on its own: total internal reflection is not a case that has to
         be detected and branched around separately, it falls out of the
         formula the way it falls out of the water. */
      float fresnelWA(float cosI, float eta){
        /* cosI is the cosine of a physical angle of incidence and has no
           business being outside [0, 1] — but the caller below is a
           three-tap supersample centred on c0 and offset by e, and e is
           whatever the mesh's own screen-space derivative says it needs to
           be. At a genuinely grazing facet, spread across a coarse wave
           crest, c0-e can be pushed past zero into negative territory even
           though c0 itself never was. Feed this formula a negative cosI and
           eta*cosI and the sqrt-derived cosT can land almost exactly on top
           of each other with opposite sign, so rs's denominator crosses
           zero instead of just getting small — not a NaN, which the bloom
           chain already scrubs, but a genuine finite blow-up that sails
           straight through it and lights up a wave-crest's worth of pixels,
           which is exactly the shape a bloom blur turns into a soft dancing
           disc. Clamping to the range this angle was always meant to be in
           costs nothing on every ordinary sample and removes the one that
           was not. */
        cosI = clamp(cosI, 0.0, 1.0);
        float sin2t = eta*eta*(1.0 - cosI*cosI);
        if (sin2t >= 1.0) return 1.0;
        float cosT = sqrt(1.0 - sin2t);
        float rs = (eta*cosI - cosT)/(eta*cosI + cosT);
        float rp = (cosI - eta*cosT)/(cosI + eta*cosT);
        return 0.5*(rs*rs + rp*rp);
      }
      /* Antialiased the way the old window() was, but the thing being
         softened is different. The old edge was an authored constant width;
         this one supersamples the real formula three times across the
         pixel's own angular footprint and averages, so a genuinely sharp
         physical curve stays sharp wherever the surface can resolve it and
         only softens where the surface actually cannot — e is unchanged from
         before: dN, the mesh-derivative footprint, plus sigma, the fed-back
         roughness of the chop the mesh could not hold. */
      float fresnelAA(float c0, float e, float eta){
        return (fresnelWA(c0 - e, eta) + fresnelWA(c0, eta) + fresnelWA(c0 + e, eta))/3.0;
      }

      void main(){
        vec3 V = normalize(vWorld - uCam);
        /* The fine end of the spectrum, added here rather than in the mesh —
           see the note on WAVE_SPLIT. This is what the window's edge actually
           ripples on, and it is the same waves, not a texture standing in for
           them. */
        float px = max(fwidth(vWorld.x), fwidth(vWorld.z));
        vec4 rp = ripple(vWorld.xz, uTime, 0.42, uScale, px);
        vec3 N = normalize(vNrm + vec3(rp.x, 0.0, rp.y));
        float jac = vJac + rp.z;
        /* The roughness of everything too fine to draw. This is the number that
           stops the ceiling looking like plasma. */
        float sigma = rp.w;
        /* Which side of the surface the ray arrives on, generalised from the
           old V.y<0.0 check. That version compared the ray to world-up
           directly, which is only ever the right axis to compare against
           because N (the water's own normal) is itself always nearly
           vertical — for the desert's upright flicker N is horizontal
           instead, and V.y told it nothing: the two vertical halves of the
           plane, above and below the camera's own eye-line, disagreed about
           which side they thought they were on and the render showed a hard
           seam exactly at that line, one shade above and another below.
           Comparing against N itself is the same check for water (N≈up, so
           dot(V,N)≈V.y) and the correct one for any other orientation. */
        if (dot(V, N) < 0.0) { V = -V; }

        float c0 = dot(V, N);
        /* How wide the window's edge has to be drawn — dN is the angle's own
           screen-space derivative, the geometry the mesh does hold; sigma is
           the RMS slope of what it does not. Feeding the dropped components'
           variance back in as a blur width is the standard microfacet
           argument: you may throw away the geometry, but you must keep what
           it would have varied by. */
        float dN = fwidth(c0);
        float e  = max(0.030, dN*1.2 + sigma*1.6);

        /* The window, as reflectance rather than as a drawn shape — see the
           note above fresnelAA. win is how much of the light bounces at this
           angle, one value per channel so the rim disperses on its own;
           trans is what is left to transmit. A real Snell's window photograph
           is evenly bright across nearly the whole disc and only dims hard in
           its last few degrees, because that is the shape Fresnel actually
           has — flat and low until close to the critical angle, then a sharp
           climb to 1.0 exactly there. Nothing here is drawing that shape; it
           is just what crossing the boundary costs at each angle. */
        vec3 win = vec3(fresnelAA(c0, e, 1.343),
                         fresnelAA(c0, e, 1.333),
                         fresnelAA(c0, e, 1.323));
        vec3 trans = 1.0 - win;

        /* The tunnel's rings, seen through the window — S4's, and S4's only.
         *
         * Forty-six cycles in the ANGLE from the normal. On a flat surface that
         * is a set of concentric bands, which is what it was written for. On a
         * rippled one the angle changes by tens of degrees inside a single
         * pixel, so it completes several cycles per pixel and comes out as pure
         * moire: a dense repeating white-edged mesh over the whole ceiling.
         *
         * It is off unless a scene asks for it, and it is faded out by its own
         * pixel footprint when it is on, so it cannot do this in S4 either. */
        float ang = acos(clamp(c0, -1.0, 1.0));
        float ringVis = uRings*(1.0 - smoothstep(0.020, 0.075, fwidth(ang)*46.0));
        float rings = pow(0.5 + 0.5*sin(ang*46.0 - uTime*2.1), 3.0)*ringVis;
        /* Where the light actually comes from, done properly rather than as a
           brightness in the middle of the window.

           Refract the view ray THROUGH the surface — Snell, water to air, and
           the same 1.333 that gives the window its 48.6 degrees — and ask what
           direction it leaves in. If it points at the source, this facet is
           delivering the source to the eye and it is very bright; if it points
           anywhere else it delivers the sky, which is dim. That one dot product
           replaces an even ceiling with what the photographs show: dark mottled
           water everywhere, and light concentrated where the source is.

           refract() returns zero under total internal reflection, which is
           exactly outside the window.

           There used to be a third term here, tighter still — individual
           sparks from an exponent up to 240, meant to be a field of dense
           sun-glitter. On the geometric part of the spectrum, which is only
           a handful of large facets per frame, "dense field" is not what an
           exponent that sharp actually draws: it is a handful of isolated
           facets each hitting the alignment exactly, each one a near-point
           source, and bloom turns each of those into its own soft white
           disc — a chain of separate blown highlights instead of a sparkle.
           A true glitter path needs many independent micro-facets per pixel
           to average over, which is what sigma is FOR elsewhere in this
           shader, but a single extra specular lobe fed by sigma only widens
           one highlight, it does not multiply it into a field. Cheaper and
           truer to what is actually being resolved here to leave the sparkle
           to the mini-bubbles catching the light in the water below, and let
           this surface show only the two scales it can draw honestly. */
        vec3 toSun = normalize(uSun - vWorld);
        /* GLSL's refract(I, N, eta) needs N facing BACK toward where I came
           from — dot(N, I) negative — or the formula silently returns the
           wrong vector instead of failing loudly. Check it at normal
           incidence, where there is no bending to get wrong: I=N=(0,1,0)
           gives T=(0,-1,0), flipped through the surface instead of
           continuing straight on. That was exactly this call before this
           fix — V and N here both point up, the same way, because that is
           the convenient convention for every OTHER use of N in this file.
           So T came out roughly mirrored through the surface plane on every
           pixel: mostly pointing back down into the water instead of up
           into the sky, which is why al = dot(Td, toSun) was reading close
           to zero across the entire window in every render checked, not
           because the sun rarely crosses into frame — that reading is what
           sent the wrong diagnosis to the water column's own trajectory.
           Negating N here satisfies the convention this ONE call needs
           without touching what N means everywhere else. eta is n1/n2 for
           the medium the ray is IN over the medium it is ENTERING — water
           over air, 1.333, not its reciprocal; the reciprocal is the right
           number for a ray arriving FROM air, which is not this ray. */
        vec3 T = refract(V, -N, 1.333);
        /* refract() on two genuinely unit vectors returns an exact unit
           vector when it returns anything at all — that is what Snell's law
           IS, length-preserving by construction — and the exact zero vector
           under total internal reflection. So tl is mathematically never
           more than 1: what it does here is ride refract()'s own smooth
           approach to zero right at the critical angle as a free antialias
           on the glow/halo cutoff, not act as a brightness dial. But V and N
           reaching here have both been through their own normalize(), and a
           normalize() fed a near-zero vector — N can get arbitrarily close
           to one at a wave facet where the mesh normal and the sub-pixel
           ripple slope happen to cancel — is undefined by the GLSL spec and
           returns whatever the driver feels like on that pixel, including a
           huge or infinite one. That is a single isolated fragment, not a
           region, so it never showed up in a term-isolation render: this is
           what actually produced the dancing white blobs, driven through
           pow(al,7.0) and then Gaussian-blurred by bloom into a soft
           disc. Clamping tl to the range the mathematics actually promises
           costs nothing on every ordinary pixel and removes the one that
           was not ordinary. */
        float tl = clamp(length(T), 0.0, 1.0);
        vec3 Td = tl > 1e-4 ? T/tl : vec3(0.0, 1.0, 0.0);
        float al = clamp(dot(Td, toSun), -1.0, 1.0);
        float glow = pow(max(0.0, al), 6.0)*tl;     // the hot core
        /* Two scales of the same source, not interchangeable: a broad halo
           so the beams have something to hang from, and a tighter core.
           Widened from 1.6 to 1.15 and rebalanced against the flat term
           below — the ceiling used to carry most of its brightness as an
           even wash that did not care where the sun was, so a shaft could
           read as strong while the patch it supposedly falls from stayed
           unremarkable. The window should be a dim, translucent thing that
           only really lights up where a ray actually gets through it. */
        float halo = pow(max(0.0, al), 1.15)*tl;
        /* The window's content — multiplied by trans.g, the real transmitted
           fraction, rather than by a hand-tuned "how central is this pixel"
           weight. Multiplied by uSkyMix too, so a scene that leaves it at
           zero gets exactly the flat colour it always did. uSunVis gates only
           the source terms, not the window itself: a cloud dims the sun, it
           does not turn the sky black, so the window still shows whatever
           flat daylight aboveWater() is drawing underneath it.

           The flat term is deliberately small now — it used to be the same
           order of magnitude as the sun terms, which is what made the whole
           window read as evenly lit regardless of where the light actually
           came from. It still needs to be nonzero, or the sky is pure black
           the instant a cloud crosses the sun and the window vanishes
           entirely rather than just dimming, which no photograph does. */
        vec3 above = mix(vec3(1.0), aboveWater(Td, uTime), uSkyMix);
        vec3 sky = uSky * above * trans.g
                        * (0.16 + 0.20*uOpen
                          + uSunVis*((2.6 + 3.3*uOpen)*halo
                                   + (7.5 + 9.5*uOpen)*glow)
                          + (0.30 + 0.75*uOpen)*rings*smoothstep(0.68, 0.95, c0));

        /* Outside the window the surface is a mirror, and a mirror shows you
           what it is pointed at — which from under six hundred units of lit
           water is not black. Neither ingredient here is a colour invented
           for this shader: uMurkCol is the water's own colour, the same
           number the murk dome and the seabed are given, brightened by uAmb
           — the same "how much light gets down" scalar that brightens them —
           so the reflection cannot drift out of sync with the water it is
           supposed to be a reflection of. Shaped brighter toward the
           horizontal for the same reason a real one is: a reflection aimed
           nearly level is looking edge-on through far more lit water than one
           aimed straight down. */
        vec3 R = reflect(V, N);
        float horiz = 1.0 - clamp(-R.y, 0.0, 1.0);
        vec3 mirror = uMurkCol*uAmb*(1.0 + 3.4*pow(horiz, 1.6));

        /* And it is not featureless: the wave jacobian focuses the window's
           own light into a caustic net on the underside — crests focus,
           troughs do not — plus a slow drifting field so the net is not a
           grid. */
        float caustic = pow(max(0.0, -jac), 2.2) * 1.6*(1.0 - 0.7*smoothstep(0.0, 0.09, sigma))
                      + 0.30*fbm(vWorld.xz*0.075 + uTime*0.10)
                      + 0.42*pow(max(0.0, fbm(vWorld.xz*0.028 - uTime*0.06)), 2.0);
        vec3 deep = mirror + uSky*caustic*0.045;

        vec3 col = mix(deep, sky, trans.g);

        /* Term isolation. Guessing at which of six things makes a pattern is
           how three rounds got spent on the wrong one. */
        if (uDebug > 0.5){
          vec3 dbg = vec3(0.0);
          if (uDebug < 1.5)      dbg = trans;
          else if (uDebug < 2.5) dbg = vec3(caustic);
          else if (uDebug < 3.5) dbg = vec3(rings);
          else if (uDebug < 4.5) dbg = vec3(halo);
          else if (uDebug < 5.5) dbg = vec3(glow);
          else if (uDebug < 6.5) dbg = mirror*3.0;
          else if (uDebug < 7.5) dbg = above*0.5;
          else if (uDebug < 8.5) dbg = vec3(sigma*20.0);
          /* col itself, on a 0-50 heatmap, pre-extinction. Every term above
             read as ordinary on its own; if none of them is the bug, the bug
             must be in how they combine — this shows the sum directly rather
             than guessing at a seventh term. */
          else if (uDebug < 9.5) dbg = min(col, vec3(50.0))/50.0;
          /* al: raw refracted-view-to-sun alignment, 0..1, before either
             power curve. Answers "does this frame's window ever point at
             the sun at all", separate from how the glow/halo curves shape
             whatever al it gets. */
          else if (uDebug < 10.5) dbg = vec3(max(0.0, al));
          else                   dbg = vec3(trans.g, c0, min(e, 1.0));
          gl_FragColor = vec4(dbg, 1.0);
          return;
        }

        /* There is no additive rim here, and there should not be. Fresnel
           reflectance already climbs steeply just inside the critical angle
           on its own — the bright rim in a photograph IS the top of that
           climb, not a separate mark laid over it. Anything added on top
           would be a second copy of an edge that already draws itself. */

        /* Fade with distance so the plane never shows its edge. */
        float d = length(vWorld.xz - uCam.xz);
        float far = 1.0 - smoothstep(uFadeNear, uFadeFar, d);

        /* The water in between, and this is the transparency the whole
           surface is meant to lose with distance: real straight-line
           distance, not horizontal, because from directly underneath the
           horizontal distance to the window is zero and what dims it is the
           depth. It is what makes the ceiling read as a dome resolving out of
           the murk near its crown and being swallowed by it toward the rim,
           rather than as a flat picture pasted overhead.

           Capped, and the cap is not a fudge: this is a FLAT plane standing
           in for a surface that is actually rippled everywhere, and at
           grazing incidence that idealisation breaks — the ray's true
           intersection with the real, wavy sea is close by, but its
           intersection with the flat mesh is wherever the mesh happens to
           still be nearly parallel to it, which can be a very long way off.
           An uncapped distance there does not compute "more water in the
           way", it computes an artefact of the flattening, and it was
           quietly crushing the whole mirror zone to uMurkCol regardless of
           anything shaded above. Capped at the same order as the murk dome's
           own working distance, the fade still does its job near the crown
           and still darkens the rim — it just does it from a distance that
           is actually physical. */
        float dm = min(length(vWorld - uCam), 380.0);
        float m = 1.0 - exp(-dm*uMurk);
        col = mix(col, uMurkCol, m);

        /* A soft edge for the upright case only — the desert's flicker,
           checked directly against a first pass, read as a hard-edged
           coloured box sitting in the sky rather than a hazy apparition,
           because a flat rectangle's own silhouette IS a hard edge with
           nothing here to soften it (S1/S4 never show this plane's actual
           boundary — the far-distance fade above hides it first). Radial
           falloff in the plane's own local space, not world space, so it
           holds the same shape regardless of distance or orientation. */
        float edgeFade = 1.0;
        if (uUpright > 0.5){
          float r = length(vLocalXY)/1600.0;
          /* Widened core (0.42-0.95 -> 0.60-1.0): against the desert's own
             pale sky the fully-transparent taper was eating so much of the
             plane that the flicker read as barely-there even at its own
             pulse peak. Still soft at the rim, just less of the shape spent
             fading before it ever reaches full strength. */
          edgeFade = 1.0 - smoothstep(0.60, 1.0, r);
        }

        gl_FragColor = vec4(extinctVoid(col), uFade*far*edgeFade);
      }`
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

/* Marine snow: what the light from the window falls through on the way down,
   and the reason the shafts are visible at all.
 *
 * A shaft of light in clear water is invisible. What you see is not the light,
 * it is the light SCATTERED off the things floating in it toward your eye, and
 * marine particles scatter forward, hard — most of what they redirect carries
 * on within twenty degrees of where it was already going. So a particle between
 * you and the source is bright and the identical particle behind you is not,
 * which is why a shaft has a side you can see it from. That is one dot product
 * and it is most of this shader.
 *
 * Positions are a pure function of the index and the time, so every render
 * agrees frame for frame.
 */
/* Marine snow.
 *
 * The count and the mote size are both arguments now, and the reason is a
 * measurement: soloed in S1 at t = 25 with everything else muted, nine thousand
 * motes at the old size produced EIGHTEEN pixels brighter than half again the
 * background, out of nine hundred thousand. That is not subtle particulate,
 * that is none — and it is the middle of that shot that pays, because motes
 * passing the lens are the only parallax open water has. There is nothing else
 * out there at a known distance.
 *
 * Two causes, both counted rather than guessed. The field is thirty-seven units
 * between motes, so a sixty-degree cone out to the range where they are still
 * bright holds a couple of hundred of them; and at 0.12 a mote is under a pixel
 * until it is seventy-five units from the lens, so those two hundred are two
 * hundred single pixels. Density and size are the two numbers that fix it and
 * they are now visible from the call site.
 *
 * The old constant is kept as the default so S4 — which watches this field from
 * outside, moving fast, with a tunnel to look at — is not touched by S1's
 * problem. And the ceiling on the size stays where it is: this is the field
 * that once, with a constant chosen for an outside view, drew a mote six
 * thousand pixels across at four units and filled the frame with what looked
 * like an atmosphere. */
export function buildWaterColumn(count = 9000, { mote = 0.12 } = {}){
  const pos = new Float32Array(count*3);
  const siz = new Float32Array(count);
  for (let i = 0; i < count; i++){
    const a = i*2.39996323;                       // golden angle
    /* The field is a column two hundred units across, not four hundred.
       Radius is where the density goes: at 394 most of the motes were out
       beyond the range where a mote is still a mote, and the shell that
       actually crosses the lens — say 25 to 80 units — held about forty of
       them. Halving the radius quadruples what is near enough to streak,
       for the same count and the same cost. The column is still nine hundred
       units tall, which is the axis this camera actually looks along. */
    const r = 12 + (i % 613)*0.31;
    pos[i*3]   = Math.cos(a)*r;
    pos[i*3+1] = -((i*97) % 900) - 2;
    pos[i*3+2] = Math.sin(a)*r;
    /* A wide spread of sizes, biased small. Marine snow is mostly specks with
       a few flakes in it; an even spread reads as dust on the lens. */
    siz[i] = 0.35 + Math.pow(((i*37) % 101)/101, 3.0)*3.4;
  }

  /* Quads rather than points, and the reason is the streak.
   *
   * 'Vesipartikkelit voisivat näkyä ruudulla poimuajon tyyppisenä efektinä —
   * tai vaihtoehtoisesti vesimassoista tulee motion blur tyyppinen efekti.'
   * Those are the same effect, and the second one is the honest way to get the
   * first: a mote seen through a real shutter while the camera moves is not a
   * dot, it is a line, and its LENGTH IS THE SPEED. So nothing here is a speed
   * effect switched on at the top of the climb; it is one exposure, and the
   * shot accelerates through it. Round specks at the bottom and long streaks at
   * the break come out of the same three lines, which is also why they can
   * never disagree with how fast the camera is actually going.
   *
   * gl_PointSize cannot do it — a point sprite is square to the screen and has
   * no direction — so the field is instanced quads built in VIEW SPACE, which
   * is the billboard idiom this project has had to relearn four times.
   */
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5,-0.5,0,  0.5,-0.5,0,  0.5,0.5,0,  -0.5,0.5,0
  ]), 3));
  geo.setIndex([0,1,2, 0,2,3]);
  geo.setAttribute('aPos',  new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(siz, 1));
  geo.instanceCount = count;

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
      uTint: { value: new THREE.Color(0.45, 0.80, 0.95) }, uFade: { value: 1 },
      uPx:   { value: 1 }, uMurk: { value: 0.0 }, uMote: { value: mote },
      uSrc:  { value: new THREE.Vector3(0, 1400, 0) },
      uBeam: { value: 1.0 },       // how much of the lighting is the shafts
      /* The camera's own velocity, in world units per second, and the shutter
         it is smeared over. The product is a length, and that length is the
         streak — zero when the camera is still, so a scene that never sets
         these draws exactly the round motes it always did. */
      uVel:  { value: new THREE.Vector3() },
      uShut: { value: 0.0 }
    },
    vertexShader: /* glsl */`
      ${NOISE}
      attribute vec3 aPos;
      attribute float aSize;
      uniform float uTime, uPx, uMurk, uBeam, uMote, uShut;
      uniform vec3 uCam, uSrc, uVel;
      varying float vA;
      varying vec2 vQ;
      varying float vLong;
      void main(){
        /* drift: a pure function of position and time, never accumulated */
        vec3 p = aPos;
        p.x += sin(uTime*0.21 + p.y*0.05)*1.6;
        p.z += cos(uTime*0.17 + p.y*0.043)*1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;

        vec3 wp = (modelMatrix*vec4(p, 1.0)).xyz;
        /* Forward scattering. g = 0.86 is about right for marine particulate:
           strongly peaked, so the field is nearly dark off-axis and flares when
           the source is behind it. Henyey-Greenstein, normalised so the
           off-axis value is 1 rather than something tiny. */
        vec3 toEye = normalize(uCam - wp);
        vec3 fromSrc = normalize(wp - uSrc);
        float ct = clamp(dot(fromSrc, toEye), -1.0, 1.0);
        const float g = 0.86;
        float hg = (1.0 - g*g)/pow(1.0 + g*g - 2.0*g*ct, 1.5);
        float scat = 0.30 + 0.85*clamp(hg*0.12, 0.0, 6.0);

        /* And whether this particle is standing in a shaft at all. Trace the
           ray from the source through it back to where it crossed the surface
           and ask what the water was doing there — the same caustic net that
           made the shaft, sampled at the point that made THIS shaft. */
        vec3 ray = wp - uSrc;
        float tHit = ray.y < -1e-3 ? (-uSrc.y)/ray.y : 0.0;
        vec2 hit = uSrc.xz + ray.xz*tHit;
        float band = fbm(hit*0.055 + vec2(uTime*0.05, -uTime*0.035));
        band = 0.35 + 1.75*pow(clamp(smoothstep(0.42, 0.86, band), 0.0, 1.0), 1.7);
        scat *= mix(1.0, band, uBeam);

        /* Sized as a real object, and cut off near the lens.
           The old constant was chosen for a camera watching this field from
           outside it. S1 sits INSIDE it for twenty-five bars, and at four units
           away a mote was six thousand pixels across — three of them filled the
           frame with a soft blue gradient and looked exactly like an
           atmosphere, which is why it took a while to notice they were motes.
           A mote is about a tenth of a unit; that is all this says now. */
        float dd = length(mv.xyz);
        vA = smoothstep(900.0, 120.0, d)*smoothstep(5.0, 24.0, dd)*exp(-dd*uMurk)*scat;

        /* Half-width in world units, with a floor in PIXELS so a distant mote
           does not fall through the raster the way a sub-pixel quad does and a
           sub-pixel POINT did not.
           The floor is in pixels and the size is not, and that distinction is
           what lets the mote be genuinely small. It had been inflated to a unit
           and a quarter purely so it would register at all as a dot — and a
           dot a quarter as wide as its own smear is not a streak, it is a
           blob: measured, the first streaking pass came out at an aspect of
           1.25 and read exactly like the round motes it replaced. Real marine
           snow is far finer than the smear it draws; making it fine again is
           undoing an earlier compensation, not adding an effect. */
        float w = max(aSize*uMote, dd/max(uPx, 1.0)*1.6)*0.5;

        /* WHERE THIS MOTE WAS, one shutter ago, in view space.
           The mote is (very nearly) fixed in the world and the CAMERA moves, so
           its image smears by exactly the camera's displacement seen from the
           new position: view' = R*(world - (cam - vel*shut)) = view + R*vel*shut.
           One matrix multiply, no history, still a pure function of t. */
        vec3 shift = mat3(viewMatrix)*(uVel*uShut);

        vec2 dir = shift.xy;
        float len = length(dir);
        vec2 u = len > 1e-5 ? dir/len : vec2(1.0, 0.0);
        vec2 n = vec2(-u.y, u.x);
        /* Slide along the smear, then out across it, then round the two ends
           off by the half-width so the streak is a capsule and not a plank. */
        vec3 q = mv.xyz + shift*(position.x + 0.5);
        q.xy += u*position.x*(w*2.0) + n*position.y*(w*2.0);

        /* And it gets FAINTER as it gets longer, because the same light is
           being spread over more pixels. Without this, fast would simply mean
           bright, which is the tell of an effect rather than an exposure.

           Softened by an exponent rather than taken at full strength, and this
           is a choice worth admitting to. Strict conservation is right for a
           fixed amount of light, but a mote's brightness in this shader was
           never a measured quantity — it is whatever makes marine snow read.
           At full strength a streak five times its own width came out at a
           fifth the density and vanished into water this dark, which trades
           one invisible field for another. The exponent keeps the direction of
           the law — longer is always dimmer, so speed can never buy
           brightness — without letting it undo the thing it is drawing. */
        vA *= pow((w*2.0)/(w*2.0 + len), 0.35);

        vQ = position.xy*2.0;               // -1..1 across and along
        /* The smear's length in HALF-WIDTHS, which is the unit the fragment
           stage measures its capsule in — w is already a half-width, so this is
           len/w and not len/2w. It was the latter, which meant the capsule the
           fragment drew was half the length of the quad the vertex built: the
           outer half of every streak fell outside the shape and was discarded,
           and the whole field came back looking like the round motes it had
           replaced however long the exposure was made. Two expressions for one
           length, disagreeing by a factor of two — the same fault as a table
           filled in one frame and read in another, in miniature. */
        vLong = len/max(w, 1e-4);
        gl_Position = projectionMatrix*vec4(q, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${EXTINCT}
      uniform vec3 uTint; uniform float uFade;
      varying float vA;
      varying vec2 vQ;
      varying float vLong;
      void main(){
        /* A capsule: the distance to the segment running down the middle of the
           quad, measured in half-widths. The quad's own half-extent along the
           smear is vLong/2 + 1 of them — the segment plus a round cap at each
           end — so that is what vQ.x spans. At zero length this collapses to
           exactly the round dot the point sprite drew. */
        float hl = vLong*0.5;
        float sAlong = vQ.x*(hl + 1.0);
        float seg = clamp(sAlong, -hl, hl);
        float r = length(vec2(sAlong - seg, vQ.y));
        float m = 1.0 - smoothstep(0.36, 1.0, r);
        if (m*vA < 0.0008) discard;
        gl_FragColor = vec4(extinctVoid(uTint), m*vA*uFade*0.55);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

/* Bubbles.
 *
 * Every earlier version of this drew a single bubble large enough to be seen
 * as an object — a ring, a lens, a shell — and every one of them read as
 * wrong at that scale no matter how the shading was fixed, because that is
 * not what a bubble stream looks like. In every reference photo, nothing is
 * resolved: it is a dense field of points of light, brightest where it
 * crosses a shaft, that only reads as "bubbles" in aggregate, the same way a
 * field of stars reads as a sky without any one star being drawn specially.
 *
 * So there is no shell here, no lens, no shape to get wrong — just thousands
 * of tiny sparkling points using the same forward-scattering flare the water
 * column already uses, so they light up inside the beams and go dark between
 * them. What makes them read as bubbles rather than dust is entirely in the
 * motion: they rise at real bubble speed instead of drifting, small ones
 * lagging big ones, with a fast per-point twinkle standing in for a tumbling
 * ball catching and losing the light — and they stop dead at the surface,
 * because the field is fixed in the world with its top just under the
 * membrane and recycles a long way down where the water is opaque.
 */
export function buildBubbles(count = 9000, { span = 210, height = 1300, top = -1.0 } = {}){
  const seed = new Float32Array(count*4);
  const RND = (i, salt) => {
    let x = (i*2654435761 + salt*40503) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0)/4294967296;
  };
  const PLUMES = 26;
  for (let i = 0; i < count; i++){
    const cl = i % PLUMES;
    const ca = RND(cl, 7)*Math.PI*2, cr = span*Math.pow(RND(cl, 8), 0.55);
    const wide = 3.0 + 14.0*RND(cl, 9);
    seed[i*4]   = Math.cos(ca)*cr + (RND(i, 1)*2 - 1)*wide;
    seed[i*4+1] = Math.sin(ca)*cr + (RND(i, 2)*2 - 1)*wide;
    seed[i*4+2] = RND(i, 3);
    seed[i*4+3] = Math.pow(RND(i, 4), 4.5);   // hard bias to tiny — this is the whole population now
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count*3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
      uSrc:  { value: new THREE.Vector3(0, 1400, 0) },
      uPx:   { value: 1 }, uAmt: { value: 1 }, uMurk: { value: 0.0 },
      uH:    { value: height }, uTop: { value: top },
      uTint: { value: new THREE.Color(0.65, 0.90, 1.00) }
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime, uPx, uMurk, uH, uTop;
      uniform vec3 uCam, uSrc;
      varying float vA; varying float vTwinkle;
      void main(){
        float w  = aSeed.w;
        /* Terminal velocity as the square root of the radius, same as before
           — small ones lag, big ones overtake — just all of it scaled down to
           mini-bubble range. */
        float v  = 6.0 + 30.0*sqrt(w + 0.03);
        float below = mod(aSeed.z*uH - uTime*v, uH);   // uH at the bottom, 0 at the surface
        float y = uTop - below;
        float grow = pow((below + 95.0)/95.0, -0.3333);
        float sz = (0.10 + 1.05*w)*grow;
        float wob = (0.20 + 1.4*w);
        float rate = 5.0/(0.5 + 3.0*w);
        vec3 p = vec3(aSeed.x + sin(uTime*rate + aSeed.z*41.0)*wob,
                      y,
                      aSeed.y + cos(uTime*rate*0.87 + aSeed.z*23.0)*wob);

        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        float dd = length(mv.xyz);

        /* Forward scattering — the same phase function the water column
           uses on its motes. A bubble this small is nearly invisible off
           axis and flares hard when it sits between the camera and the
           source, which is what puts the brightest sparkle inside the shafts
           and almost nothing between them, exactly like the reference. */
        vec3 wp = (modelMatrix*vec4(p, 1.0)).xyz;
        vec3 toEye = normalize(uCam - wp);
        vec3 fromSrc = normalize(wp - uSrc);
        float ct = clamp(dot(fromSrc, toEye), -1.0, 1.0);
        const float g = 0.90;
        float hg = (1.0 - g*g)/pow(1.0 + g*g - 2.0*g*ct, 1.5);
        float scat = 0.30 + clamp(hg*0.14, 0.0, 2.2);

        /* Sparkle: a bubble this size is a tiny mirrored ball tumbling on its
           way up, so it catches the light in flashes rather than glowing
           steadily. Fast, per-particle, and it only ever brightens on top of
           the phase function above — it never has the only say in whether a
           point is lit. */
        float tw = sin(uTime*(9.0 + 14.0*w) + aSeed.z*97.0)*0.5 + 0.5;
        vTwinkle = 0.45 + 0.9*pow(tw, 3.0);

        float burst = smoothstep(0.0, 5.0, below);
        vA = smoothstep(1.0, 5.0, dd)*(1.0 - smoothstep(260.0, 560.0, dd))
           * exp(-dd*uMurk)*burst*scat;

        /* Sized as real motes, not clamped up to stay round — a soft round
           glow is round at any size down to one pixel, so there is nothing
           here that needs the "never smaller than three pixels" rule the old
           lens version needed. Fainter as it runs out of pixels to draw into,
           same as everything else in this scene. */
        float want = sz*uPx*0.55/max(dd, 1.0);
        float pxs  = clamp(want, 1.0, 8.0);
        vA *= min(1.0, want/max(pxs, 0.6));
        gl_PointSize = pxs;
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uTint; uniform float uAmt;
      varying float vA; varying float vTwinkle;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c)*2.0;
        if (r > 1.0) discard;
        /* A soft glow with a small bright core — a point of light, not a
           disc with an edge. There is no shell, no rim, no shape left to get
           wrong: this is the same primitive the water column's motes use,
           just brighter and faster-moving.

           Unlike the water column's motes, these are not meant to be read as
           haze accumulated over hundreds of units of water — they are meant
           to be seen individually, the way the reference photographs show
           them, so the colour is not run through the water's own long-range
           extinction the way the motes' is. That constant was tuned for a
           population meant to disappear into a soft glow at range; put on a
           population meant to sparkle, it just made every one of them a
           twenty-seventh as bright and the whole field vanished. */
        float glow = exp(-r*r*3.4);
        float hot  = 1.0 - smoothstep(0.0, 0.4, r);
        float m = glow*0.6 + hot*0.8;
        /* Colour is the tint alone, not the tint times the brightness — with
           additive blending the alpha channel already carries the brightness
           once. Multiplying it into the colour too was squaring a number
           under one, which is why the field all but disappeared: a
           middling point at b = 0.3 came out at 0.09, not 0.3. */
        float b = clamp(m*vA*vTwinkle*uAmt, 0.0, 1.0);
        gl_FragColor = vec4(uTint, b);
      }`
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  return pts;
}

/* The body of water itself: what every other surface's distance term resolves
   to, and for the first four bars of the film the only thing on screen.
 *
 * Deep water is not black and it is not one colour. Looking down it is black,
 * because there is nothing under you and no light gets back; looking up it is a
 * few percent above black, because six hundred units of water above you are
 * being lit from one side. That gradient is shot 1's floor — and on its own it
 * is too clean: real water a hundred metres down is never one smooth value at
 * a given altitude, it is layers of slightly different clarity drifting past
 * each other, with the odd brighter thread where the light finds a clearer
 * path. So the gradient carries two fbm fields on top of it — one slow and
 * broad, reading as depth rather than pattern, biased dark so it is the layers
 * the water was missing rather than a net brightening; one faster and finer,
 * gated to the lit half of the room, reading as a suggestion that the light
 * overhead is not perfectly still. Both are multiplicative or additive around
 * the same uUp/uDown values that were already tuned right — the sphere reads
 * differently, but the colours the membrane's mirror zone and the seabed
 * borrow from it are untouched.
 */
export function buildMurk(){
  const geo = new THREE.SphereGeometry(1400, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uDown: { value: new THREE.Color(0.0006, 0.0016, 0.0026) },
      uUp:   { value: new THREE.Color(0.010, 0.043, 0.062) },
      uGlow: { value: new THREE.Color(0.10, 0.34, 0.46) },
      uLift: { value: 1.0 },       // how much of the surface's light gets down
      uTime: { value: 0.0 }
    },
    vertexShader: `varying vec3 vD;
      void main(){ vD = normalize(position);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${EXTINCT}
      uniform vec3 uDown, uUp, uGlow; uniform float uLift, uTime;
      varying vec3 vD;
      void main(){
        /* Steep, but not so steep that the transition is a line. A sphere
           centred on the camera is a room, and the one thing that gives a room
           away is a join between its floor and its walls — so the gradient runs
           smoothly from well below the horizontal to well above it, and there
           is no altitude anywhere in it where the value changes quickly. */
        float up = smoothstep(-0.45, 1.0, vD.y);
        vec3 col = mix(uDown, uUp, up*up);

        /* Layered darkness. Two fields, different scales and drift rates and
           axes, so what reads is depth sliding past at more than one rate --
           not a single ring of banding sweeping the room. Biased down (mean
           multiplier under 1) because the water was too bright to begin with,
           not because it needed more light in it. */
        float layers = 0.5*fbm(vD.xz*1.1 + vec2(0.0, uTime*0.012))
                     + 0.5*fbm(vD.zx*2.3 - vec2(uTime*0.017, 0.0));
        col *= 0.74 + 0.32*layers;

        /* Shimmer. Finer, faster, and only in the lit half of the room -- the
           water column and the seabed have their own light; this is the
           dome's own suggestion of movement in what is lighting it. */
        float shim = fbm(vD.xz*7.0 + vD.y*3.0 + vec2(uTime*0.42, -uTime*0.31));
        col += uGlow*pow(max(0.0, shim - 0.5), 2.0)*1.5*up*up*uLift;

        /* And a lobe straight up, because the light has one source and it is
           overhead. This is what resolves into the window. */
        col += uGlow*pow(up, 9.0)*uLift;
        gl_FragColor = vec4(extinctVoid(col), 1.0);
      }`
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

/* Shafts of light coming down through the surface.
 *
 * Light entering water from one source above spreads from a point, so the
 * shafts are not parallel — they diverge, and from underneath they run outward
 * from the window like spokes. That divergence is the whole reason the shot
 * reads as "up there": parallel shafts say nothing about where the surface is,
 * radiating ones point straight at it.
 *
 * Each shaft is a quad that contains its own axis and turns about it to face
 * the camera, built entirely in the vertex shader from three instanced
 * attributes — no CPU work per frame and no dependence on frame order.
 */
export function buildShafts(count = 150, { spread = 620, length = 900 } = {}){
  const anc = new Float32Array(count*3);   // where the shaft crosses the surface
  const kk  = new Float32Array(count);     // per-shaft constant: width, brightness, phase
  const wid = new Float32Array(count);
  const RND = (i, salt) => {
    let x = (i*2654435761 + salt*40503) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0)/4294967296;
  };
  for (let i = 0; i < count; i++){
    /* Radius biased outward: a shaft directly overhead is edge-on from the axis
       and contributes nothing but cost. */
    const r = spread*Math.pow(RND(i, 1), 0.55);
    const a = RND(i, 2)*Math.PI*2;
    anc[i*3] = Math.cos(a)*r; anc[i*3+1] = 0; anc[i*3+2] = Math.sin(a)*r;
    wid[i] = 18 + 80*RND(i, 3)*(0.35 + r/spread);
    kk[i]  = RND(i, 4);
  }
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(anc, 3));
  geo.setAttribute('aWidth',  new THREE.InstancedBufferAttribute(wid, 1));
  geo.setAttribute('aK',      new THREE.InstancedBufferAttribute(kk, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
      uCol:  { value: new THREE.Color(0.42, 0.80, 0.98) },
      uAmt:  { value: 1 }, uMurk: { value: 0.0 },
      /* A point in the world, not a height: move it sideways and the whole fan
         swings, which is the only thing that says the light is somewhere
         rather than everywhere. */
      uSrc:  { value: new THREE.Vector3(0, 1400, 0) }, uLen: { value: length }
    },
    vertexShader: /* glsl */`
      attribute vec3 aAnchor; attribute float aWidth; attribute float aK;
      uniform vec3 uCam, uSrc; uniform float uTime, uLen;
      varying vec2 vUv; varying float vK; varying float vD;
      void main(){
        vUv = uv; vK = aK;
        /* The source is a point above the surface, so the shaft's direction is
           simply the line from it through where the shaft breaks the water. */
        vec3 dir = normalize(aAnchor - uSrc);
        vec3 p0  = aAnchor;
        vec3 p   = p0 + dir*(uv.y*uLen);
        /* Turn about that axis to face the camera: a shaft is a volume, and the
           cheapest honest stand-in for a volume is a card that never shows you
           its edge. */
        vec3 toCam = uCam - p;
        vec3 right = cross(dir, toCam);
        float rl = length(right);
        right = rl > 1e-4 ? right/rl : vec3(1.0, 0.0, 0.0);
        /* Wider as it goes down, because it is diverging. */
        /* Wide, and widening. In every photograph these are broad soft
           wedges, not rays — the light has been scattered on its way down and a
           thin bright line is a laser, not a sunbeam. */
        p += right*((uv.x - 0.5)*aWidth*(1.0 + uv.y*2.3));
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        vD = length(mv.xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`precision highp float;
      ${NOISE}
      ${EXTINCT}
      uniform vec3 uCol; uniform float uAmt, uTime, uMurk;
      varying vec2 vUv; varying float vK; varying float vD;
      void main(){
        float w = 1.0 - abs(vUv.x*2.0 - 1.0); w = w*w*(3.0 - 2.0*w);
        /* Bright where it leaves the surface and gone long before it reaches
           the bottom: the light is being absorbed the whole way down, which is
           the same reason the water is dark at all. */
        float down = 1.0 - vUv.y;
        float fall = down*down*(0.25 + 0.75*down);
        /* And a short ramp at the top.

           A shaft begins at the surface, which for one directly overhead is off
           the top of the frame — but the fan spreads a thousand units out, and
           a shaft anchored that far to the side breaks the water near the
           surface's own vanishing line, in the middle of the picture. Starting
           it at full strength put a hard horizontal cut across the top of every
           one of those: a row of bright rectangles hanging in open water. Light
           does not begin anywhere. */
        fall *= smoothstep(0.0, 0.085, vUv.y);
        /* Caustics move along the shaft, not across it — the pattern on the
           surface is what is being projected, so it travels with the light. */
        float band = 0.55 + 0.45*sin(vUv.y*7.0 - uTime*0.55 + vK*41.0);
        band *= 0.7 + 0.6*fbm(vec2(vK*97.0, vUv.y*4.0 - uTime*0.22));
        vec3 c = extinctVoid(uCol)*w*fall*band*uAmt*exp(-vD*uMurk);
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}

/* The bottom, a long way down.
 *
 * Not for its own sake — it is barely visible and it is meant to be. The frame
 * had no depth in it: a dome centred on the camera is a room, and a room is
 * what it read as, because nothing in the picture ever got further away. One
 * surface that recedes into the murk fixes that, and boulders on it fix the
 * other half, which is scale — without something of a known size on it a floor
 * is just a darker patch.
 *
 * Everything here resolves to the same murk colour the rest of the scene fogs
 * to, so it never has an edge and there is no moment where the floor "starts".
 */
export function buildSeabed({ y = -1500, size = 4600, boulders = 260 } = {}){
  const g = new THREE.Group();
  const RND = (i, salt) => {
    let x = (i*2654435761 + salt*40503) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
    x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
    return ((x ^ (x >>> 16)) >>> 0)/4294967296;
  };

  const U = () => ({
    uTime:   { value: 0 },
    uCam:    { value: new THREE.Vector3() },
    uSrc:    { value: new THREE.Vector3(0, 1400, 0) },
    uCol:    { value: new THREE.Color(0.030, 0.062, 0.070) },
    uMurk:   { value: 0.0 },
    uMurkCol:{ value: new THREE.Color(0.004, 0.020, 0.031) },
    uAmt:    { value: 1 }
  });

  const FOG = /* glsl */`
    vec3 drown(vec3 col, vec3 wp, vec3 cam, float murk, vec3 murkCol){
      float d = length(wp - cam);
      return mix(col, murkCol, 1.0 - exp(-d*murk));
    }`;

  /* ---- the floor ---- */
  const fg = new THREE.PlaneGeometry(size, size, 128, 128);
  fg.rotateX(-Math.PI/2);
  const floor = new THREE.Mesh(fg, new THREE.ShaderMaterial({
    uniforms: U(),
    vertexShader: /* glsl */`
      ${NOISE}
      varying vec3 vW;
      void main(){
        vec3 p = position;
        /* Long, low dunes. Nothing sharp: at nine hundred units nothing sharp
           would survive the water anyway, and a floor with detail you cannot
           quite resolve is worse than a floor with none. */
        p.y += (fbm(p.xz*0.0022) - 0.5)*130.0
             + (fbm(p.xz*0.0081 + 31.0) - 0.5)*34.0;
        vec4 w = modelMatrix*vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${NOISE}
      ${EXTINCT}
      ${FOG}
      uniform vec3 uCam, uCol, uMurkCol, uSrc; uniform float uMurk, uAmt, uTime;
      varying vec3 vW;
      void main(){
        float n = fbm(vW.xz*0.011 + 7.0);
        vec3 col = uCol*(0.55 + 0.9*n)*uAmt;
        /* What little light reaches the bottom arrives from one place, so the
           floor is not evenly lit either. */
        float lit = clamp(1.0 - length(vW.xz - uSrc.xz)/2600.0, 0.0, 1.0);
        col *= 0.55 + 1.05*lit*lit;
        gl_FragColor = vec4(extinctVoid(drown(col, vW, uCam, uMurk, uMurkCol)), 1.0);
      }`
  }));
  floor.position.y = y;
  floor.frustumCulled = false;
  g.add(floor);

  /* ---- boulders, for scale ---- */
  const bg = new THREE.IcosahedronGeometry(1, 1);
  const rock = new THREE.InstancedMesh(bg, new THREE.ShaderMaterial({
    uniforms: U(),
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN;
      void main(){
        vec4 w = modelMatrix*instanceMatrix*vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(instanceMatrix)*normal);
        gl_Position = projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${EXTINCT}
      ${FOG}
      uniform vec3 uCam, uCol, uMurkCol; uniform float uMurk, uAmt;
      varying vec3 vW; varying vec3 vN;
      void main(){
        float up = clamp(normalize(vN).y*0.5 + 0.5, 0.0, 1.0);
        vec3 col = uCol*(0.30 + 1.05*up*up)*uAmt;
        gl_FragColor = vec4(extinctVoid(drown(col, vW, uCam, uMurk, uMurkCol)), 1.0);
      }`
  }), boulders);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(),
        pv = new THREE.Vector3(), sv = new THREE.Vector3(),
        ax = new THREE.Vector3();
  for (let i = 0; i < boulders; i++){
    const r = size*0.46*Math.sqrt(RND(i, 1));
    const a = RND(i, 2)*Math.PI*2;
    const sz = 7 + 46*Math.pow(RND(i, 3), 2.0);
    pv.set(Math.cos(a)*r, y + sz*0.35, Math.sin(a)*r);
    ax.set(RND(i,4)*2-1, RND(i,5)*2-1, RND(i,6)*2-1).normalize();
    q.setFromAxisAngle(ax, RND(i, 7)*6.283);
    sv.set(sz*(0.7 + 0.6*RND(i,8)), sz*(0.4 + 0.4*RND(i,9)), sz*(0.7 + 0.6*RND(i,10)));
    rock.setMatrixAt(i, m.compose(pv, q, sv));
  }
  rock.frustumCulled = false;
  g.add(rock);

  g.userData.mats = [floor.material, rock.material];
  return g;
}
