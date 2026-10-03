#!/usr/bin/env node
// Renders trailer/index.html to MP4 (plus a README teaser GIF) with no npm dependencies:
// local headless Chrome is driven over the DevTools Protocol, each frame is
// produced by calling window.seek(t), and FFmpeg encodes the PNG sequence.
//
// Usage:
//   node trailer/render.mjs [--chrome /path/to/chrome] [--scale 2]
//   node trailer/render.mjs --stills 4.2,9,14 --out /tmp/stills   # spot-check frames
// Requires Node 22+ (global WebSocket), Google Chrome with WebGL2, and ffmpeg on PATH.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'assets');
const WIDTH = 1280;
const HEIGHT = 720;
const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
}[process.platform];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const SCALE = Number(arg('scale', '2'));
// README teaser: the showpiece span only; a full-length GIF of shader footage is far too heavy.
const TEASER = { start: 8.4, duration: 9.6, width: 720, fps: 10 };

// Chrome picks a free port (--remote-debugging-port=0) and writes it to
// DevToolsActivePort inside the profile, so concurrent Chromes never collide.
async function waitForTarget(profileDir) {
  const portFile = join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 300; attempt++) {
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const page = (await res.json()).find((t) => t.type === 'page' && t.url === 'about:blank');
        if (page) return page.webSocketDebuggerUrl;
      } catch {
        // Port written before the HTTP endpoint is ready.
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Headless Chrome did not start within 30s');
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;
  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : resolve(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      listeners.get(msg.method)(msg.params);
      listeners.delete(msg.method);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => listeners.set(method, resolve));
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error(`Cannot connect to ${url}`)));
  });
  return opened.then(() => ({ send, once, close: () => ws.close() }));
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(`Page error: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
  return result.value;
}

async function screenshot(cdp, path, clip) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, ...(clip && { clip }) });
  writeFileSync(path, Buffer.from(data, 'base64'));
}

async function captureStills(cdp, times, outDir) {
  for (const t of times) {
    await evaluate(cdp, `window.seek(${t})`);
    await screenshot(cdp, join(outDir, `still-${t}.png`));
  }
}

async function captureFrames(cdp, framesDir) {
  const { fps, duration } = await evaluate(cdp, 'window.TRAILER');
  const total = Math.round(fps * duration);
  for (let f = 0; f < total; f++) {
    await evaluate(cdp, `window.seek(${f / fps})`);
    await screenshot(cdp, join(framesDir, `f${String(f).padStart(4, '0')}.png`));
    if (f % fps === 0) process.stdout.write(`\rframe ${f}/${total}`);
  }
  process.stdout.write(`\rframe ${total}/${total}\n`);
  return fps;
}

// GitHub social preview: 1280x640, final title card without the footnote.
async function captureSocialPreview(cdp, framesDir) {
  await evaluate(cdp, `window.seek(window.TRAILER.duration); document.getElementById('footnote').style.visibility = 'hidden'`);
  const raw = join(framesDir, 'social.png');
  await screenshot(cdp, raw, { x: 0, y: 48, width: WIDTH, height: 640, scale: 1 });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', `scale=${WIDTH}:640:flags=lanczos`,
    join(OUT_DIR, 'social-preview.png')], { stdio: 'inherit' });
}

function encode(framesDir, fps) {
  const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(framesDir, 'f%04d.png')];
  execFileSync('ffmpeg', [...input, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', '24', '-movflags', '+faststart', join(OUT_DIR, 'trailer.mp4')], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(TEASER.start), '-t', String(TEASER.duration),
    '-i', join(OUT_DIR, 'trailer.mp4'), '-vf',
    `fps=${TEASER.fps},scale=${TEASER.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle`,
    '-loop', '0', join(OUT_DIR, 'trailer-teaser.gif')], { stdio: 'inherit' });
}

async function main() {
  const framesDir = mkdtempSync(join(tmpdir(), 'trailer-frames-'));
  const profileDir = mkdtempSync(join(tmpdir(), 'trailer-chrome-'));
  const chrome = spawn(arg('chrome', DEFAULT_CHROME), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`,
    `--window-size=${WIDTH},${HEIGHT}`, '--hide-scrollbars', '--enable-gpu', '--ignore-gpu-blocklist',
    ...(process.platform === 'darwin' ? ['--use-angle=metal'] : []),
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    const cdp = await connect(await waitForTarget(profileDir));
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: false });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `${pathToFileURL(join(HERE, 'index.html')).href}?t=0` });
    await loaded;
    await evaluate(cdp, 'document.fonts.ready.then(() => true)');
    const stills = arg('stills');
    if (stills) {
      await captureStills(cdp, stills.split(',').map(Number), arg('out', framesDir));
      cdp.close();
      return;
    }
    const fps = await captureFrames(cdp, framesDir);
    await captureSocialPreview(cdp, framesDir);
    cdp.close();
    encode(framesDir, fps);
    console.log(`Wrote ${join(OUT_DIR, 'trailer.mp4')}, trailer-teaser.gif, and social-preview.png`);
  } finally {
    const exited = new Promise((resolve) => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
    rmSync(framesDir, { recursive: true, force: true });
    rmSync(profileDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
