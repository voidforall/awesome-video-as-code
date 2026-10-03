// Particle morph: stars across the frame lift off and reassemble into the
// exact glyphs of the DOM title. Positions are closed-form functions of t.
(function () {
  const COUNT = 14000;
  const GOLD = [253, 230, 138], AMBER = [251, 191, 36], ORANGE = [249, 115, 22], INK = [248, 250, 252], STAR = [191, 219, 254];

  // Deterministic [0, 1) hash of an integer (and a salt), so frames never depend on Math.random.
  function hash(i, salt) {
    let h = (i * 374761393 + salt * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const mixRgb = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  function signal(x) {
    const k = Math.min(1, Math.max(0, x)) * 2;
    return k < 1 ? mixRgb(GOLD, AMBER, k) : mixRgb(AMBER, ORANGE, k - 1);
  }

  // Sample filled pixels of the title, laid out exactly like the DOM element.
  function sampleTitle(titleEl) {
    const style = getComputedStyle(titleEl);
    const rect = titleEl.getBoundingClientRect();
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const ctx = c.getContext('2d');
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.letterSpacing = style.letterSpacing;
    ctx.textAlign = 'center';
    const m = ctx.measureText('Awesome Video as Code');
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    const fontPx = parseFloat(style.fontSize);
    const baseline = rect.top + (fontPx - (asc + desc)) / 2 + asc;
    const cx = rect.left + rect.width / 2;
    ctx.fillText('Awesome Video as Code', cx, baseline);
    const splitX = cx - m.width / 2 + ctx.measureText('Awesome ').width;
    const right = cx + m.width / 2;

    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const pts = [];
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        if (data[(y * c.width + x) * 4 + 3] > 140) pts.push([x + .5, y + .5]);
      }
    }
    return { pts, splitX, right };
  }

  window.createParticles = function createParticles(canvas, titleEl) {
    const ctx = canvas.getContext('2d');
    let model = null;

    function build() {
      const { pts, splitX, right } = sampleTitle(titleEl);
      const items = [];
      for (let i = 0; i < COUNT; i++) {
        const target = pts[Math.floor(hash(i, 1) * pts.length)];
        // Start as stars scattered over the whole frame.
        const ang = hash(i, 2) * Math.PI * 2;
        const sx = hash(i, 3) * 1280;
        const sy = hash(i, 10) * 720;
        const end = target[0] < splitX ? INK : signal((target[0] - splitX) / (right - splitX));
        items.push({
          sx, sy, tx: target[0], ty: target[1],
          ang, drift: 12 + hash(i, 4) * 40, phase: hash(i, 5) * 6.283,
          start: hash(i, 6) < .18 ? STAR : signal(hash(i, 6)), end,
          delay: ((target[0] - 160) / 960) * .55 + hash(i, 7) * .2,
          size: .8 + hash(i, 8) * 1.1,
          arc: (hash(i, 9) - .5) * 60,
        });
      }
      model = items;
    }

    const clamp = (v) => Math.min(1, Math.max(0, v));
    const ease = (x) => { const c = clamp(x); return c < .5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
    const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);

    // Timeline (seconds): burst [t0, t0+1], converge [t0+.8+delay, +1.15], fade [t1, t1+.6].
    return function draw(t, { t0, t1 }) {
      const s = canvas.width / 1280;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (t < t0 || t > t1 + .6) return;
      if (!model) build();
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      const fade = 1 - clamp((t - t1) / .6);
      for (const p of model) {
        // Stars twinkle in place and drift slightly before being pulled into the glyphs.
        const b = easeOut((t - t0) / 1.0);
        const swirl = p.ang;
        const bx = p.sx + Math.cos(p.ang) * p.drift * b;
        const by = p.sy + Math.sin(p.ang) * p.drift * b;
        const k = ease((t - t0 - .8 - p.delay) / 1.15);
        const arc = Math.sin(Math.PI * k) * p.arc;
        const x = bx + (p.tx - bx) * k - arc * Math.sin(swirl);
        const y = by + (p.ty - by) * k + arc * Math.cos(swirl);
        const c = mixRgb(p.start, p.end, k);
        const born = clamp((t - t0) / .5) * (.75 + .25 * Math.sin(t * 9 + p.phase));
        const alpha = born * fade * (.55 + .45 * k);
        const size = p.size * (1 + (1 - k) * .6);
        ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha.toFixed(3)})`;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      ctx.globalCompositeOperation = 'source-over';
    };
  };
})();
