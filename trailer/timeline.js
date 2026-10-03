// Deterministic timeline: every visual is a pure function of t (seconds).
// The renderer calls window.seek(t) once per frame; nothing depends on wall-clock time.
(function () {
  const FPS = 60;
  const DURATION = 21;
  window.TRAILER = { fps: FPS, duration: DURATION };

  // Shot list (seconds). The split code/render view holds for a while after typing ends.
  const SHOT = {
    briefEnd: 3.3,
    codeStart: 3.35,
    chunkLen: 1.15,
    holdEnd: 10.6,             // split view stays up until here
    expand: [10.6, 11.5],      // preview grows to full frame
    hud: [11.3, 15.2],
    lowerThird: [11.9, 14.9],
    dim: [14.9, 16.2],         // sky dims behind the title
    particles: { t0: 14.85, t1: 17.35 },
    title: 17.25,
  };

  const BRIEF = 'render a flight through deep space, with nothing but code';
  const AGENT_STEPS = ['planning 4 shots…', 'writing universe.glsl…', `rendering ${FPS * DURATION} frames…`];

  // The code panel types the same techniques universe.js uses, one layer per chunk.
  const CHUNKS = [
    ['// 1 · stars: hashed points, colored by temperature',
      'vec3 h = hash33(floor(dir * 90.));',
      'float on = step(.62, h.y);',
      'c += temp(h.x) * on * star(dot(f, f));'],
    ['// 2 · milky way: a noise band with dust lanes',
      'float band = exp(-55. * pow(dot(dir, GAL), 2.));',
      'float lanes = smoothstep(.42, .72, fbm(dir * 6.));',
      'c += glow * band * haze * (1. - .88 * lanes);'],
    ['// 3 · nebulae: domain-warped fractal noise',
      'float q = fbm(dir * 2.5);',
      'float r = fbm(dir * 2.5 + 4. * q);',
      'c += mix(OIII, H_ALPHA, fbm(dir * 5.)) * pow(r, 2.6);'],
    ['// 4 · depth: bright stars, spikes, drift',
      'c += spikes(dot(v, camRt), dot(v, camUp));',
      'float z = fract(i / 5. + t * .035);',
      'c += nearStar(uv * mix(22., .6, z)) * fade;'],
  ].map((lines) => lines.join('\n'));
  const LAYERS = ['starfield', 'milky way', 'nebulae', 'depth · spikes · drift'];
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

  const TOKEN = /(\/\/[^\n]*)|\b(float|vec2|vec3|for|int|return)\b|\b(\d*\.\d*|\d+)\b|([A-Za-z_]\w*)(?=\()/g;
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

  const chunkWindow = (i) => [SHOT.codeStart + i * SHOT.chunkLen, SHOT.codeStart + (i + 1) * SHOT.chunkLen - .2];
  const typingEnd = chunkWindow(CHUNKS.length - 1)[1] + .5;
  // During the hold, spotlight each chunk with its layer row in turn.
  const spotlightAt = (t) => {
    const slot = (SHOT.holdEnd - .3 - typingEnd) / CHUNKS.length;
    return t < typingEnd || t >= SHOT.holdEnd - .3 ? -1 : Math.floor((t - typingEnd) / slot);
  };
  const stageAt = (t) => CHUNKS.reduce((s, _, i) => s + ease(span(t, chunkWindow(i)[1], chunkWindow(i)[1] + .45)), 0);

  const draw = window.createUniverse($('gl'));
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
    $('s2').style.opacity = visible(t, 3.1, SHOT.expand[0] + .6, .45);
    let typing = -1;
    const spot = spotlightAt(t);
    const shown = CHUNKS.map((chunk, i) => {
      const [a, b] = chunkWindow(i);
      if (t >= a && t < b) typing = i;
      return chunk.slice(0, Math.floor(chunk.length * span(t, a, b)));
    }).filter(Boolean);
    $('code').innerHTML = shown
      .map((src, i) => `<span style="opacity:${spot < 0 || spot === i ? 1 : .35}">${highlight(src)}</span>`)
      .join('\n\n') + (typing >= 0 ? '<span class="cur"></span>' : '');
    $('layers').innerHTML = LAYERS.map((name, i) => {
      const state = spot === i || typing === i ? 'active' : t >= chunkWindow(i)[1] ? 'done' : '';
      const mark = state === 'done' ? '✓' : state === 'active' ? '●' : '○';
      return `<li class="${state}"><span class="mark">${mark}</span><span>${i + 1}</span><span>${name}</span></li>`;
    }).join('');
  }

  function sceneUniverse(t) {
    const gl = $('gl');
    gl.style.opacity = ease(span(t, 3.2, 3.7));
    const e = ease(span(t, SHOT.expand[0], SHOT.expand[1]));
    const rect = {
      x: lerp(PREVIEW.x, FULL.x, e), y: lerp(PREVIEW.y, FULL.y, e),
      w: lerp(PREVIEW.w, FULL.w, e), h: lerp(PREVIEW.h, FULL.h, e),
    };
    const r = 18 * (1 - e);
    gl.style.clipPath = `inset(${rect.y}px ${1280 - rect.x - rect.w}px ${720 - rect.y - rect.h}px ${rect.x}px round ${r}px)`;
    const fade = lerp(1, .38, ease(span(t, SHOT.dim[0], SHOT.dim[1])));
    draw({ t, stage: stageAt(t), fade, rect });

    const hud = $('hud');
    hud.style.opacity = visible(t, SHOT.hud[0], SHOT.hud[1], .45);
    $('recDot').style.opacity = Math.floor(t * 2) % 2 === 0 ? 1 : .25;
    $('hudFrame').textContent = `frame ${String(Math.round(t * FPS)).padStart(4, '0')} / ${FPS * DURATION}`;
    const lt = $('lowerThird');
    lt.style.opacity = visible(t, SHOT.lowerThird[0], SHOT.lowerThird[1], .5);
    lt.style.transform = `translateY(${(1 - ease(span(t, SHOT.lowerThird[0], SHOT.lowerThird[0] + .6))) * 16}px)`;
  }

  function sceneTitle(t) {
    $('s5').style.opacity = 1;
    const T = SHOT.title;
    $('rail').style.opacity = 1 - visible(t, SHOT.expand[0], T + .4, .6);
    $('title').style.opacity = ease(span(t, T - .1, T + .55));
    const rise = (a) => `translateY(${(1 - ease(span(t, a, a + .7))) * 26}px)`;
    [['pipe', T + .6], ['tagline', T + 1], ['url', T + 1.4], ['footnote', T + 1.8]].forEach(([id, a]) => {
      $(id).style.opacity = ease(span(t, a, a + .7));
      $(id).style.transform = rise(a);
    });
    $('signalLine').style.transform = `scaleX(${ease(span(t, T + .2, T + 2.8))})`;
  }

  window.seek = function seek(t) {
    sceneBrief(t);
    sceneCode(t);
    sceneUniverse(t);
    sceneTitle(t);
    drawParticles(t, SHOT.particles);
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
