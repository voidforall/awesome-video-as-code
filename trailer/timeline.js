// Deterministic timeline: every visual is a pure function of t (seconds).
// The renderer calls window.seek(t) once per frame; nothing depends on wall-clock time.
(function () {
  const FPS = 60;
  const DURATION = 18;
  window.TRAILER = { fps: FPS, duration: DURATION };

  const BRIEF = 'show what an agent can render with nothing but code';
  const AGENT_STEPS = ['planning 4 shots…', 'writing raymarcher.glsl…', 'scheduling 1080 frames…'];

  // The code panel types the same techniques raymarch.js uses, one layer per chunk.
  const CHUNKS = [
    ['// 1 · shapes are signed distance fields',
      'float blob(vec3 p, vec3 c, float r) {',
      '  return length(p - c) - r;',
      '}'],
    ['// 2 · smooth-min melts them together',
      'float smin(float a, float b, float k) {',
      '  float h = clamp(.5 + .5*(b-a)/k, 0., 1.);',
      '  return mix(b, a, h) - k*h*(1.-h);',
      '}'],
    ['// 3 · thin-film iridescence + fresnel',
      'vec3 c = pal(.65*dot(n, -rd) + t*.05);',
      'c *= .18 + .82*diff;',
      'c += pow(1. - ndv, 3.) * rim;'],
    ['// 4 · reflections, orbit ring, glow',
      'vec3 r = reflect(rd, n);',
      'c += studio(r) * fresnel;',
      'c += march(p + n*.01, r) + glow;'],
  ].map((lines) => lines.join('\n'));
  const LAYERS = ['SDF shapes', 'smooth union', 'iridescent light', 'reflections · ring · glow'];
  const CODE_START = 3.35;
  const CHUNK_LEN = 1.05;
  const PREVIEW = { x: 624, y: 128, w: 592, h: 333 };
  const FULL = { x: 0, y: 0, w: 1280, h: 720 };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (x) => { const c = clamp(x); return c < .5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  // Fade in over [a, a+f], hold, fade out over [b-f, b].
  const visible = (t, a, b, f = .4) => Math.min(ease(span(t, a, a + f)), 1 - ease(span(t, b - f, b)));
  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const TOKEN = /(\/\/[^\n]*)|\b(float|vec3|return)\b|\b(\d*\.\d*|\d+)\b|([A-Za-z_]\w*)(?=\()/g;
  function highlight(src) {
    let out = '', last = 0;
    for (const m of src.matchAll(TOKEN)) {
      out += escapeHtml(src.slice(last, m.index));
      const cls = m[1] ? 'c' : m[2] ? 'k' : m[3] ? 'n' : 'f';
      out += `<span class="tok-${cls}">${escapeHtml(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + escapeHtml(src.slice(last));
  }

  const chunkWindow = (i) => [CODE_START + i * CHUNK_LEN, CODE_START + (i + 1) * CHUNK_LEN - .2];
  const stageAt = (t) => CHUNKS.reduce((s, _, i) => s + ease(span(t, chunkWindow(i)[1], chunkWindow(i)[1] + .45)), 0);

  const draw = window.createRaymarcher($('gl'));
  const drawParticles = window.createParticles($('fx'), $('title'));

  function sizeCanvases() {
    const dpr = window.devicePixelRatio || 1;
    for (const c of [$('gl'), $('fx')]) {
      c.width = Math.round(1280 * dpr);
      c.height = Math.round(720 * dpr);
    }
  }

  function sceneBrief(t) {
    const s = $('s1');
    s.style.opacity = visible(t, 0, 3.3, .35);
    s.style.transform = `translateY(${(1 - ease(span(t, 0, .5))) * 24}px)`;
    const n = Math.floor(BRIEF.length * span(t, .35, 1.9));
    $('typed').textContent = BRIEF.slice(0, n);
    $('caret').style.opacity = (Math.floor(t * 2.5) % 2 === 0 || n < BRIEF.length) ? 1 : 0;
    const step = Math.min(AGENT_STEPS.length - 1, Math.floor(span(t, 2.0, 3.1) * AGENT_STEPS.length));
    $('agentLine').innerHTML = t < 2.0 ? '' : `<span style="color:var(--green)">agent</span> &nbsp;${AGENT_STEPS[step]}`;
  }

  function sceneCode(t) {
    $('s2').style.opacity = visible(t, 3.1, 8.5, .45);
    let typing = -1;
    const shown = CHUNKS.map((chunk, i) => {
      const [a, b] = chunkWindow(i);
      if (t >= a && t < b) typing = i;
      return chunk.slice(0, Math.floor(chunk.length * span(t, a, b)));
    }).filter(Boolean);
    $('code').innerHTML = highlight(shown.join('\n\n')) + (typing >= 0 ? '<span class="cur"></span>' : '');
    $('layers').innerHTML = LAYERS.map((name, i) => {
      const state = t >= chunkWindow(i)[1] ? 'done' : typing === i ? 'active' : '';
      const mark = state === 'done' ? '✓' : state === 'active' ? '●' : '○';
      return `<li class="${state}"><span class="mark">${mark}</span><span>${i + 1}</span><span>${name}</span></li>`;
    }).join('');
  }

  function sceneRaymarch(t) {
    const gl = $('gl');
    gl.style.opacity = ease(span(t, 3.2, 3.7));
    const e = ease(span(t, 7.9, 8.85));
    const rect = {
      x: lerp(PREVIEW.x, FULL.x, e), y: lerp(PREVIEW.y, FULL.y, e),
      w: lerp(PREVIEW.w, FULL.w, e), h: lerp(PREVIEW.h, FULL.h, e),
    };
    const r = 18 * (1 - e);
    gl.style.clipPath = `inset(${rect.y}px ${1280 - rect.x - rect.w}px ${720 - rect.y - rect.h}px ${rect.x}px round ${r}px)`;
    const fade = lerp(1, .2, ease(span(t, 12.3, 13.6)));
    draw({ t, stage: stageAt(t), fade, rect });

    const hud = $('hud');
    hud.style.opacity = visible(t, 8.6, 12.5, .45);
    $('recDot').style.opacity = Math.floor(t * 2) % 2 === 0 ? 1 : .25;
    $('hudFrame').textContent = `frame ${String(Math.round(t * FPS)).padStart(4, '0')} / ${FPS * DURATION}`;
    const lt = $('lowerThird');
    lt.style.opacity = visible(t, 9.3, 12.2, .5);
    lt.style.transform = `translateY(${(1 - ease(span(t, 9.3, 9.9))) * 16}px)`;
  }

  function sceneTitle(t) {
    $('s5').style.opacity = 1;
    $('rail').style.opacity = 1 - visible(t, 7.9, 15.2, .6);
    $('title').style.opacity = ease(span(t, 14.75, 15.4));
    const rise = (a) => `translateY(${(1 - ease(span(t, a, a + .7))) * 26}px)`;
    [['pipe', 15.4], ['tagline', 15.8], ['url', 16.2], ['footnote', 16.6]].forEach(([id, a]) => {
      $(id).style.opacity = ease(span(t, a, a + .7));
      $(id).style.transform = rise(a);
    });
    $('signalLine').style.transform = `scaleX(${ease(span(t, 15.0, 17.6))})`;
  }

  window.seek = function seek(t) {
    sceneBrief(t);
    sceneCode(t);
    sceneRaymarch(t);
    sceneTitle(t);
    drawParticles(t, { t0: 12.35, t1: 14.85 });
  };

  sizeCanvases();
  // Manual preview: ?t=12 freezes a frame; otherwise play in real time. The renderer passes ?t=0.
  const fixed = new URLSearchParams(location.search).get('t');
  if (fixed !== null) {
    window.seek(Number(fixed));
  } else {
    const t0 = performance.now();
    const loop = () => { window.seek(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
