// WebGL2 deep-space view: a temperature-colored starfield, the Milky Way with dust lanes,
// emission nebulae, and bright foreground stars drifting past the camera.
// Every uniform is derived from t, so a frame depends only on the time it is seeked to.
// uStage (0..4) switches on the layers the code panel types out:
//   1 stars · 2 milky way · 3 nebulae · 4 depth (bright stars, spikes, drift).
(function () {
  const FRAG = `#version 300 es
precision highp float;
uniform vec4 uRect;   // visible rect in device px: x, y (bottom-left origin), w, h
uniform float uT, uStage, uFade;
out vec4 outColor;

const vec3 GAL = normalize(vec3(.42, 1., .18));      // galactic plane normal: band crosses the frame diagonally
const vec3 CORE = normalize(vec3(.15, -.2, -1.));    // direction of the galactic core
const vec3 H_ALPHA = vec3(1., .4, .2);
const vec3 OIII = vec3(.18, .72, .84);
vec3 camRt, camUp;
float pixAng;  // angle covered by one device pixel

float stage(float n) { return clamp(uStage - n, 0., 1.); }

float hash13(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec3 hash32(vec2 p) { return hash33(vec3(p, 17.31)); }
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
                 mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
                 mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = .5, s = 0.;
  for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; }
  return s;
}

// Blackbody-ish tint: blue-white hot stars through white and yellow to orange.
vec3 temp(float h) {
  vec3 c = mix(vec3(.66, .78, 1.), vec3(1., .98, .95), smoothstep(.0, .35, h));
  c = mix(c, vec3(1., .88, .66), smoothstep(.45, .75, h));
  return mix(c, vec3(1., .7, .45), smoothstep(.82, 1., h));
}

// Gaussian star whose width never drops below a pixel, so stars do not shimmer.
float star(float r2, float scale, float base) {
  float s = max(base, 1.1 * pixAng * scale);
  return exp(-r2 / (s * s)) * (base * base) / (s * s);
}

// 1 · stars: hashed points on the sky sphere, colored by temperature.
vec3 stars(vec3 d) {
  vec3 c = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float sc = 90. + float(i) * 110.;
    vec3 p = d * sc;
    vec3 h = hash33(floor(p) + float(i) * 17.);
    vec3 f = fract(p) - .5 - (h - .5) * .6;
    float on = step(.62, h.y) * (.35 + 3.4 * pow(h.z, 5.));
    float twinkle = .82 + .18 * sin(uT * 2.3 + h.x * 50.);
    c += temp(h.x) * on * twinkle * star(dot(f, f), sc, .045);
  }
  return c;
}

// 2 · milky way: a noise band with a bright core, unresolved star haze, and dark dust lanes.
vec3 milkyWay(vec3 d) {
  float h = dot(d, GAL);
  float band = exp(-55. * h * h);
  float core = pow(max(dot(d, CORE), 0.), 3.);
  float haze = fbm(d * 3.2) * (.55 + .45 * fbm(d * 40.));
  vec3 glow = mix(vec3(.42, .5, .68) * .16, vec3(1., .84, .6) * .42, core);
  float lanes = smoothstep(.42, .72, fbm(d * 6. + vec3(fbm(d * 3.), 0., 0.))) * exp(-200. * h * h);
  vec3 c = glow * band * haze * (1. + 1.6 * core) * (1. - .88 * lanes);
  return c + temp(.4) * pow(fbm(d * 120.), 6.) * band * 1.2;   // resolved micro-stars inside the band
}

// 3 · nebulae: domain-warped fractal noise in a few patches of sky.
vec3 nebulae(vec3 d) {
  float q = fbm(d * 2.5);
  float r = fbm(d * 2.5 + 4. * vec3(q, q * .7, -q));
  float mask = smoothstep(.55, .95, dot(d, normalize(vec3(-.55, .3, -.8))))
             + smoothstep(.7, .97, dot(d, normalize(vec3(.75, -.25, -.6)))) * .8;
  vec3 tint = mix(OIII, H_ALPHA, smoothstep(.35, .65, fbm(d * 5. + 7.)));
  tint = mix(tint, vec3(1., .8, .45), pow(r, 4.) * 1.5);
  return tint * pow(r, 2.6) * mask * 1.3;
}

// 4a · bright stars with a halo and four-point diffraction spikes (checks neighbouring cells).
vec3 brightStars(vec3 d) {
  vec3 c = vec3(0.);
  float sc = 7.;
  vec3 base = floor(d * sc);
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 cell = base + vec3(x, y, z);
    vec3 h = hash33(cell + 91.7);
    if (h.y < .86) continue;
    vec3 sd = normalize(cell + .2 + .6 * h);
    if (dot(sd, d) < .9) continue;
    vec3 v = d - sd;
    float dx = dot(v, camRt), dy = dot(v, camUp);
    float r = length(vec2(dx, dy));
    float w = max(pixAng * .9, .00025);
    float spikes = exp(-abs(dx) * 120.) * exp(-abs(dy) / w) + exp(-abs(dy) * 120.) * exp(-abs(dx) / w);
    float glow = exp(-r * r / (w * w * 4.)) * 6. + exp(-r * 140.) * .5;
    c += temp(h.x) * (glow + spikes * .7) * (.5 + 1.2 * h.z);
  }
  return c;
}

// 4b · near stars streaming past the camera: screen-space layers that zoom with t.
vec3 drift(vec2 uv) {
  vec3 c = vec3(0.);
  for (int i = 0; i < 5; i++) {
    float z = fract(float(i) / 5. + uT * .035);
    float scale = mix(22., .6, z);
    vec2 p = uv * scale + float(i) * 7.3;
    vec3 h = hash32(floor(p));
    vec2 f = fract(p) - .5 - (h.xy - .5) * .7;
    float fade = smoothstep(0., .35, z) * smoothstep(1., .8, z);
    float on = step(.72, h.z);
    c += temp(h.x) * on * fade * star(dot(f, f), scale * 1.2, .035) * .8;
  }
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - uRect.xy - .5 * uRect.zw) / uRect.z;
  pixAng = 1. / (uRect.z * 1.3);
  float yaw = .55 + uT * .016;
  float pitch = .1 + .05 * sin(uT * .07);
  vec3 fw = normalize(vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch)));
  camRt = normalize(cross(fw, vec3(0., 1., 0.)));
  camUp = cross(camRt, fw);
  vec3 d = normalize(uv.x * camRt + uv.y * camUp + 1.3 * fw);

  vec3 col = stars(d) * stage(0.)
           + milkyWay(d) * stage(1.)
           + nebulae(d) * stage(2.)
           + (brightStars(d) + drift(uv)) * stage(3.);

  col *= .85;
  col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);   // ACES fit
  vec2 vq = (frag - uRect.xy) / uRect.zw;
  col *= mix(.65, 1., pow(16. * vq.x * vq.y * (1. - vq.x) * (1. - vq.y), .2));
  col = pow(clamp(col, 0., 1.), vec3(.4545));
  // Static ordered dither (not per-frame grain) prevents banding while keeping frames compressible.
  col += (fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.;
  outColor = vec4(col * uFade, 1.);
}`;

  const VERT = `#version 300 es
in vec2 pos;
void main() { gl_Position = vec4(pos, 0., 1.); }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
    return sh;
  }

  window.createUniverse = function createUniverse(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name) => gl.getUniformLocation(prog, name);
    const uniforms = { rect: u('uRect'), t: u('uT'), stage: u('uStage'), fade: u('uFade') };

    // rect is in CSS px with a top-left origin; converted to device px, bottom-left origin.
    return function draw({ t, stage, fade, rect }) {
      const s = canvas.width / canvas.clientWidth;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(uniforms.rect, rect.x * s, canvas.height - (rect.y + rect.h) * s, rect.w * s, rect.h * s);
      gl.uniform1f(uniforms.t, t);
      gl.uniform1f(uniforms.stage, stage);
      gl.uniform1f(uniforms.fade, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    };
  };
})();
