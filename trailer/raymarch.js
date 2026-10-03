// WebGL2 raymarcher: iridescent metaballs, an orbiting ring, and a reflective floor.
// Every uniform is derived from t, so a frame depends only on the time it is seeked to.
// uStage (0..4) switches on the layers the code panel types out:
//   1 SDF shapes · 2 smooth union · 3 iridescent lighting · 4 reflections, ring, glow.
(function () {
  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec4 uRect;   // visible rect in device px: x, y (bottom-left origin), w, h
uniform float uT, uStage, uFade;
out vec4 outColor;

const vec3 AMBER = vec3(.984, .749, .141);
const vec3 ROSE = vec3(.984, .443, .522);
const vec3 VIOLET = vec3(.655, .545, .980);

vec3 pal(float x) {
  x = fract(x) * 3.;
  return x < 1. ? mix(AMBER, ROSE, x) : x < 2. ? mix(ROSE, VIOLET, x - 1.) : mix(VIOLET, AMBER, x - 2.);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float smin(float a, float b, float k) {
  float h = clamp(.5 + .5 * (b - a) / k, 0., 1.);
  return mix(b, a, h) - k * h * (1. - h);
}
float stage(float n) { return clamp(uStage - n, 0., 1.); }

vec3 blobCenter(int i) {
  float f = float(i);
  float spread = mix(1.25, .95, stage(1.));
  return vec3(sin(uT * .7 + f * 1.9) * 1.15, sin(uT * .9 + f * 2.7) * .5 + .05, cos(uT * .6 + f * 1.3) * .8) * spread;
}
float blobs(vec3 p) {
  float k = mix(.0001, .7, stage(1.));
  float d = 1e5;
  for (int i = 0; i < 5; i++) {
    float r = .4 + .1 * sin(uT * 1.3 + float(i) * 2.1);
    d = smin(d, length(p - blobCenter(i)) - r, k);
  }
  return d;
}
float ring(vec3 p) {
  float tube = .05 * stage(3.);
  if (tube < .002) return 1e5;
  p.xy *= rot(.45 + .15 * sin(uT * .4));
  p.yz *= rot(uT * .45);
  vec2 q = vec2(length(p.xz) - 1.7, p.y);
  return length(q) - tube;
}
float floorD(vec3 p) { return p.y + 1.3; }

// x: distance, y: material (1 blob, 2 ring, 3 floor)
vec2 map(vec3 p) {
  vec2 r = vec2(blobs(p), 1.);
  float g = ring(p);
  if (g < r.x) r = vec2(g, 2.);
  float f = floorD(p);
  if (f < r.x) r = vec2(f, 3.);
  return r;
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(.0015, 0.);
  return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x,
                        map(p + e.yxy).x - map(p - e.yxy).x,
                        map(p + e.yyx).x - map(p - e.yyx).x));
}
vec2 march(vec3 ro, vec3 rd, int steps, out float glow) {
  float t = 0.;
  glow = 0.;
  for (int i = 0; i < 160; i++) {
    if (i >= steps) break;
    vec2 h = map(ro + rd * t);
    if (h.y < 2.5) glow += exp(-h.x * 9.) * .018;
    if (h.x < .0007 * t) return vec2(t, h.y);
    t += h.x * .9;
    if (t > 30.) break;
  }
  return vec2(-1., 0.);
}

vec3 studio(vec3 rd) {
  vec3 c = mix(vec3(.008, .01, .024), vec3(.03, .028, .065), rd.y * .5 + .5);
  c += vec3(1., .86, .66) * smoothstep(.9, .975, dot(rd, normalize(vec3(.6, .65, -.45)))) * 2.6;
  c += vec3(.7, .62, 1.) * smoothstep(.92, .99, dot(rd, normalize(vec3(-.75, .4, -.25)))) * 2.2;
  c += ROSE * exp(-pow((rd.y - .1) * 16., 2.)) * .16;
  return c;
}

vec3 surface(vec3 p, vec3 rd, float mat, vec3 n) {
  float ndv = clamp(dot(n, -rd), 0., 1.);
  vec3 L = normalize(vec3(.6, .8, -.4));
  float diff = clamp(dot(n, L), 0., 1.);
  float spec = pow(clamp(dot(reflect(-L, n), -rd), 0., 1.), 48.);
  float fres = pow(1. - ndv, 3.);
  if (mat > 2.5) {
    vec2 g = abs(fract(p.xz * .75) - .5) / fwidth(p.xz * .75);
    float line = 1. - min(min(g.x, g.y), 1.);
    float fadeOut = exp(-length(p.xz) * .22);
    return vec3(.02, .024, .045) + VIOLET * line * .28 * fadeOut * stage(2.);
  }
  vec3 flat_ = mix(ROSE, VIOLET, .35);
  vec3 film = pal(1.35 * ndv + .3 * p.y + uT * .06 + (mat > 1.5 ? .45 : 0.));
  vec3 lit = film * (.05 + .7 * diff) + film * spec * .9 + fres * pal(1.35 * ndv + uT * .06 + .5) * .7;
  vec3 c = mix(flat_ * .8, lit, stage(2.));
  // Iridescent metal: environment reflections are tinted by the thin-film colour.
  vec3 env = studio(reflect(rd, n));
  c = mix(c, film * env * 1.6 + film * .04 + env * fres * .35, stage(3.) * .85);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - uRect.xy - .5 * uRect.zw) / uRect.z;
  float a = .25 + uT * .2;
  vec3 ro = vec3(sin(a) * 6.6, .7 + .35 * sin(uT * .3), cos(a) * 6.6);
  vec3 ta = vec3(0., -.1, 0.);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(fw, vec3(0., 1., 0.))), up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.25 * fw);

  float glow;
  vec2 hit = march(ro, rd, 140, glow);
  vec3 col = mix(vec3(.012, .015, .032), studio(rd) * .8, stage(3.));
  if (hit.x > 0.) {
    vec3 p = ro + rd * hit.x;
    vec3 n = normalAt(p);
    col = surface(p, rd, hit.y, n);
    if (hit.y > 2.5 && stage(3.) > 0.) {
      // Floor mirrors the scene: one secondary march.
      vec3 rr = reflect(rd, n);
      float g2;
      vec2 h2 = march(p + n * .01, rr, 80, g2);
      vec3 refl = studio(rr) * .3;
      if (h2.x > 0. && h2.y < 2.5) {
        vec3 q = p + n * .01 + rr * h2.x;
        refl = surface(q, rr, h2.y, normalAt(q));
      }
      col += refl * .45 * stage(3.) * exp(-length(p.xz) * .12);
    }
  }
  col = mix(vec3(.012, .015, .032), col, clamp(uStage, 0., 1.));   // nothing exists until the first SDF is typed
  col += pal(uT * .07) * glow * stage(3.) * .75;
  col *= .9;

  col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);     // ACES fit
  vec2 vq = (frag - uRect.xy) / uRect.zw;
  col *= mix(.55, 1., pow(16. * vq.x * vq.y * (1. - vq.x) * (1. - vq.y), .18));
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

  window.createRaymarcher = function createRaymarcher(canvas) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name) => gl.getUniformLocation(prog, name);
    const uniforms = { res: u('uRes'), rect: u('uRect'), t: u('uT'), stage: u('uStage'), fade: u('uFade') };

    // rect is in CSS px with a top-left origin; converted to device px, bottom-left origin.
    return function draw({ t, stage, fade, rect }) {
      const s = canvas.width / canvas.clientWidth;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.res, canvas.width, canvas.height);
      gl.uniform4f(uniforms.rect, rect.x * s, canvas.height - (rect.y + rect.h) * s, rect.w * s, rect.h * s);
      gl.uniform1f(uniforms.t, t);
      gl.uniform1f(uniforms.stage, stage);
      gl.uniform1f(uniforms.fade, fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    };
  };
})();
