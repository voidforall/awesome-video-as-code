#!/usr/bin/env node
// Renders every decision-tree spec in diagrams/specs/ to hand-drawn Excalidraw
// SVGs in assets/diagrams/, in English and Chinese, light and dark.
//
//   cd diagrams && npm install && npm run render            # all specs
//   npm run render -- frameworks                             # one spec
//
// Set PLAYWRIGHT_MODULE to a Playwright entry file if `playwright` is not
// installed next to this script (for example, a preinstalled global copy).

import { build } from "esbuild";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const specDir = path.join(here, "specs");
const sceneDir = path.join(here, "scenes");
const outDir = path.join(repo, "assets", "diagrams");
const buildDir = path.join(here, ".build");
const fontDir = path.join(here, "node_modules/@excalidraw/excalidraw/dist/prod");

const LANGS = ["en", "zh"];
const FONT_SIZE = 20;
const LINE_HEIGHT = 25;
const PAD_X = 22;
const PAD_Y = 16;
const MIN_W = 150;
const H_GAP = 36;
const V_GAP = 150;
const BUS = 30; // distance from a question box down to its horizontal bus

// Fill colours follow the README's labels; questions are always yellow.
const KIND = {
  question: { bg: "#ffec99" },
  code: { bg: "#b2f2bb", en: "Code-rendered", zh: "代码渲染" },
  hybrid: { bg: "#ffd8a8", en: "Hybrid", zh: "混合管线" },
  pipeline: { bg: "#a5d8ff", en: "Pipeline", zh: "基础设施" },
};

const pick = (text, lang) => (typeof text === "string" ? text : text?.[lang] ?? text?.en ?? "");

// Rough width of Excalifont/Xiaolai text: CJK glyphs are about one em wide.
function textWidth(line) {
  let w = 0;
  for (const ch of line) w += /[⺀-鿿＀-￯]/.test(ch) ? FONT_SIZE : FONT_SIZE * 0.56;
  return w;
}

function boxFor(text) {
  const lines = text.split("\n");
  return {
    width: Math.max(MIN_W, Math.ceil(Math.max(...lines.map(textWidth)) + PAD_X * 2)),
    height: lines.length * LINE_HEIGHT + PAD_Y * 2,
  };
}

function nodeText(node, lang) {
  if (node.q) return pick(node.q, lang);
  const lines = [...node.tools];
  if (node.note) lines.push(`(${pick(node.note, lang)})`);
  return lines.join("\n");
}

// Measures each subtree, then places nodes top-down with parents centred
// over their children.
function layout(node, lang) {
  node.text = nodeText(node, lang);
  Object.assign(node, boxFor(node.text));
  const kids = node.children ?? [];
  kids.forEach((c) => {
    layout(c.node, lang);
    // Leave room for the answer label that sits on this child's arrow.
    const label = c.edge ? Math.max(...pick(c.edge, lang).split("\n").map(textWidth)) + 24 : 0;
    c.node.span = Math.max(c.node.span, label);
  });
  const kidsWidth = kids.reduce((s, c) => s + c.node.span, 0) + H_GAP * Math.max(0, kids.length - 1);
  node.span = Math.max(node.width, kidsWidth);
  return node;
}

function place(node, left, top) {
  node.x = left + (node.span - node.width) / 2;
  node.y = top;
  const kids = node.children ?? [];
  const kidsWidth = kids.reduce((s, c) => s + c.node.span, 0) + H_GAP * Math.max(0, kids.length - 1);
  let cursor = left + (node.span - kidsWidth) / 2;
  const rowHeight = Math.max(0, ...kids.map((c) => c.node.height));
  for (const c of kids) {
    place(c.node, cursor, top + node.height + V_GAP + (rowHeight - c.node.height) / 2);
    cursor += c.node.span + H_GAP;
  }
}

// Stable ids and seeds keep re-renders byte-identical, so diffs stay small.
function toSkeleton(spec, lang) {
  const tree = layout(structuredClone(spec.root), lang);
  place(tree, 0, 0);
  const out = [];
  const kinds = new Set();
  let n = 0;
  const walk = (node) => {
    const id = `n${n++}`;
    const kind = node.q ? "question" : node.kind ?? "code";
    if (!node.q) kinds.add(kind);
    out.push({
      type: "rectangle", id, seed: 1000 + n, x: node.x, y: node.y, width: node.width, height: node.height,
      backgroundColor: KIND[kind].bg, fillStyle: "solid", strokeColor: "#1e1e1e", roundness: { type: 3 },
      label: { text: node.text, fontSize: FONT_SIZE, fontFamily: 5 },
    });
    // Org-chart routing: a trunk down from the question, a horizontal bus, and
    // one vertical arrow per answer, so each answer label sits on its own drop.
    const kids = node.children ?? [];
    if (kids.length) {
      const sx = node.x + node.width / 2;
      const sy = node.y + node.height;
      const busY = sy + BUS;
      const centers = kids.map((c) => c.node.x + c.node.width / 2);
      const line = (lid, x, y, dx, dy) => out.push({
        type: "line", id: lid, seed: 7000 + n + lid.length, x, y, width: dx, height: dy,
        points: [[0, 0], [dx, dy]], strokeColor: "#1e1e1e",
      });
      line(`${id}-trunk`, sx, sy, 0, BUS);
      const minX = Math.min(sx, ...centers);
      const maxX = Math.max(sx, ...centers);
      if (maxX > minX) line(`${id}-bus`, minX, busY, maxX - minX, 0);
      kids.forEach((c, i) => {
        const childId = walk(c.node);
        const ex = centers[i];
        out.push({
          type: "arrow", id: `${id}-${childId}`, seed: 5000 + n, x: ex, y: busY, width: 0, height: c.node.y - busY,
          points: [[0, 0], [0, c.node.y - busY]], strokeColor: "#1e1e1e", end: { id: childId },
          ...(c.edge ? { label: { text: pick(c.edge, lang), fontSize: 18, fontFamily: 5 } } : {}),
        });
      });
    }
    return id;
  };
  walk(tree);

  // A small legend for the tool labels that appear in this tree.
  const bottom = Math.max(...out.filter((e) => e.type === "rectangle").map((e) => e.y + e.height)) + 56;
  let lx = 0;
  for (const k of ["code", "hybrid", "pipeline"].filter((k) => kinds.has(k))) {
    const text = KIND[k][lang];
    out.push({
      type: "rectangle", id: `legend-${k}`, seed: 9000 + lx, x: lx, y: bottom, width: 26, height: 26,
      backgroundColor: KIND[k].bg, fillStyle: "solid", strokeColor: "#1e1e1e", roundness: { type: 3 },
    });
    out.push({
      type: "text", id: `legend-${k}-text`, seed: 9500 + lx, x: lx + 36, y: bottom + 1,
      text, fontSize: 18, fontFamily: 5, strokeColor: "#1e1e1e",
    });
    lx += 36 + textWidth(text) + 40;
  }
  return out;
}

function serve() {
  const types = { ".js": "text/javascript", ".html": "text/html", ".woff2": "font/woff2", ".ttf": "font/ttf" };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const file = url.startsWith("/fonts/") ? path.join(fontDir, url) : path.join(buildDir, url === "/" ? "index.html" : url);
    if (!file.startsWith(fontDir) && !file.startsWith(buildDir)) return res.writeHead(403).end();
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  const only = process.argv.slice(2);
  const specs = fs.readdirSync(specDir).filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, "")).filter((id) => !only.length || only.includes(id));
  if (!specs.length) throw new Error(`No specs found in ${specDir}${only.length ? ` matching ${only.join(", ")}` : ""}`);

  fs.mkdirSync(buildDir, { recursive: true });
  await build({
    entryPoints: [path.join(here, "entry.js")], bundle: true, format: "esm", outfile: path.join(buildDir, "bundle.js"),
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
  });
  fs.writeFileSync(path.join(buildDir, "index.html"),
    '<!doctype html><meta charset="utf-8"><script>window.EXCALIDRAW_ASSET_PATH="/";</script><script type="module" src="/bundle.js"></script>');

  const pwEntry = process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright";
  const { chromium } = await import(pwEntry);
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("page error:", e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.diagramReady);
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(sceneDir, { recursive: true });

    for (const id of specs) {
      const spec = JSON.parse(fs.readFileSync(path.join(specDir, `${id}.json`), "utf8"));
      for (const lang of LANGS) {
        const skeleton = toSkeleton(spec, lang);
        for (const dark of [false, true]) {
          const { svg, elements } = await page.evaluate(([s, d]) => window.renderDiagram(s, { dark: d }), [skeleton, dark]);
          const name = `${id}.${lang}${dark ? ".dark" : ""}.svg`;
          fs.writeFileSync(path.join(outDir, name), svg + "\n");
          if (!dark) {
            // Editable copy for excalidraw.com. The JSON spec stays the source of truth.
            const scene = { type: "excalidraw", version: 2, source: "awesome-video-as-code", elements, appState: { viewBackgroundColor: "#ffffff" }, files: {} };
            fs.writeFileSync(path.join(sceneDir, `${id}.${lang}.excalidraw`), JSON.stringify(scene, null, 2) + "\n");
          }
          console.log(`wrote assets/diagrams/${name}`);
        }
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
