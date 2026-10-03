# Trailer

The README trailer is plain HTML, CSS, and a GLSL black-hole shader. Every visual is a pure function of time, exposed as `window.seek(t)`.

| File | Role |
| --- | --- |
| `index.html` | Layout and styles for the five shots |
| `timeline.js` | `seek(t)`: typing, layer reveals, camera rect, HUD, title |
| `universe.js` | WebGL2 fragment shader: starfield, nebula, accretion disk, and per-pixel gravitational lensing around a black hole |
| `particles.js` | 14,000 particles that spin off the accretion disk and land on the title's exact glyphs |
| `render.mjs` | Drives headless Chrome over the DevTools Protocol and encodes with FFmpeg |

Render `assets/trailer.mp4` (2560×1440, 60 fps), `assets/trailer-teaser.gif`, and `assets/social-preview.png`:

```sh
node trailer/render.mjs                                  # Node 22+, Google Chrome with WebGL2, ffmpeg on PATH
node trailer/render.mjs --scale 1                        # 1280×720
node trailer/render.mjs --stills 5,10,14 --out /tmp/s    # spot-check frames
```

Open `trailer/index.html` in a browser to preview it in real time, or `index.html?t=10` to freeze a frame.
