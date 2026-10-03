// WebGL2 universe: a starfield, a nebula, and a black hole whose gravity bends every light ray.
// Every uniform is derived from t, so a frame depends only on the time it is seeked to.
// uStage (0..4) switches on the layers the code panel types out:
//   1 starfield · 2 nebula · 3 accretion disk · 4 gravitational lensing.
(function () {
  const FRAG = `#version 300 es
precision highp float;
uniform vec4 uRect;   // visible rect in device px: x, y (bottom-left origin), w, h
uniform float uT, uStage, uFade, uDist;
out vec4 outColor;

const float DISK_IN = 2.6;
const float DISK_OUT = 11.;
vec3 camPos;

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
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; }
  return s;
}

// 1 · stars: hashed points on the sky sphere, three depth layers.
vec3 stars(vec3 d) {
  vec3 c = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float sc = 70. + float(i) * 85.;
    vec3 p = d * sc;
    vec3 h = hash33(floor(p) + float(i) * 17.);
    vec3 f = fract(p) - .5 - (h - .5) * .6;
    float r2 = dot(f, f);
    float on = step(.7, h.y) * (.35 + 4. * pow(h.z, 6.));
    float twinkle = .8 + .2 * sin(uT * 3. + h.x * 40.);
    vec3 tint = mix(vec3(1., .82, .62), vec3(.72, .85, 1.), h.x);
    c += tint * on * twinkle * (exp(-r2 * 900.) + exp(-r2 * 90.) * .06);
  }
  return c;
}

// 2 · nebula: fractal noise along a galactic band, teal gas and warm dust.
vec3 nebula(vec3 d) {
  float band = exp(-pow(d.y * 2.4 + .35 * sin(d.x * 2.1 + d.z), 2.));
  float n = fbm(d * 2.2 + vec3(0., 0., uT * .01));
  float m = fbm(d * 4.6 + n * 1.6);
  vec3 gas = mix(vec3(.03, .16, .24), vec3(.5, .3, .14), smoothstep(.45, .78, m));
  return gas * pow(n, 2.2) * band * 1.4 + vec3(.55, .78, 1.) * pow(m, 7.) * band * .5;
}

vec3 sky(vec3 d) {
  return stars(d) * stage(0.) + nebula(d) * stage(1.);
}

// 3 · accretion disk: Keplerian shear, temperature falloff, doppler beaming.
vec4 disk(vec3 p) {
  float r = length(p.xz);
  float w = 1.6 / pow(r, 1.5);
  float a = -uT * w * 2.2;
  vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
  float n = fbm(vec3(q * 1.1, r * .35));
  float streak = fbm(vec3(q * .35, r * 2.6));
  float k = clamp((r - DISK_IN) / (DISK_OUT - DISK_IN), 0., 1.);
  vec3 heat = mix(vec3(1., .93, .8) * 1.5, vec3(1., .58, .18) * .95, smoothstep(0., .3, k));
  heat = mix(heat, vec3(.72, .24, .06) * .6, smoothstep(.35, 1., k));
  vec3 orbit = normalize(vec3(-p.z, 0., p.x));
  float doppler = clamp(1. + .5 * dot(orbit, normalize(camPos - p)), .4, 1.6);
  float density = smoothstep(DISK_IN, DISK_IN + .5, r) * smoothstep(DISK_OUT, DISK_OUT - 4., r)
                * (.3 + 1.1 * pow(n, 1.6)) * (.6 + .8 * streak);
  float alpha = clamp(density * 1.1, 0., 1.);
  return vec4(heat * density * pow(doppler, 2.5), alpha);
}

// 4 · gravity bends every light ray: integrate the photon path around the hole.
vec3 trace(vec3 ro, vec3 rd) {
  float lens = stage(3.);
  float hasHole = stage(2.);
  vec3 pos = ro, vel = rd;
  vec3 h = cross(pos, vel);
  float h2 = dot(h, h);
  vec3 col = vec3(0.);
  float alpha = 0.;
  for (int i = 0; i < 320; i++) {
    float r = length(pos);
    if (r < 1. && hasHole > 0.) return col + (1. - alpha) * sky(normalize(vel)) * (1. - hasHole);
    float dt = clamp(.07 * r, .03, 1.2);
    vec3 next = pos + vel * dt;
    vel += -1.5 * h2 * pos / pow(r, 5.) * dt * lens;
    if (hasHole > 0. && pos.y * next.y < 0.) {
      vec3 x = mix(pos, next, pos.y / (pos.y - next.y));
      float rr = length(x.xz);
      if (rr > DISK_IN && rr < DISK_OUT) {
        vec4 dc = disk(x) * hasHole;
        col += (1. - alpha) * dc.rgb * dc.a;
        alpha += (1. - alpha) * dc.a;
      }
    }
    pos = next;
    if (r > 60. && dot(pos, vel) > 0.) break;
  }
  return col + (1. - alpha) * sky(normalize(vel));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - uRect.xy - .5 * uRect.zw) / uRect.z;
  float az = .35 + uT * .025;
  float el = .085 + .03 * sin(uT * .21);
  camPos = uDist * vec3(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  vec3 fw = normalize(-camPos), rt = normalize(cross(fw, vec3(.12, 1., 0.))), up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.55 * fw);

  vec3 col = trace(camPos, rd);
  col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);   // ACES fit
  vec2 vq = (frag - uRect.xy) / uRect.zw;
  col *= mix(.6, 1., pow(16. * vq.x * vq.y * (1. - vq.x) * (1. - vq.y), .2));
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
    const uniforms = { rect: u('uRect'), t: u('uT'), stage: u('uStage'), fade: u('uFade'), dist: u('uDist') };

    // rect is in CSS px with a top-left origin; converted to device px, bottom-left origin.
    return function draw({ t, stage, fade, rect, dist }) {
      const s = canvas.width / canvas.clientWidth;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(uniforms.rect, rect.x * s, canvas.height - (rect.y + rect.h) * s, rect.w * s, rect.h * s);
      gl.uniform1f(uniforms.t, t);
      gl.uniform1f(uniforms.stage, stage);
      gl.uniform1f(uniforms.fade, fade);
      gl.uniform1f(uniforms.dist, dist);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    };
  };
})();
