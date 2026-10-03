# Trailer

The README trailer is a single HTML page whose every visual is a pure function of time, exposed as `window.seek(t)`.

Render it to `assets/trailer.mp4`, `assets/trailer.gif`, and `assets/social-preview.png`:

```sh
node trailer/render.mjs            # Node 22+, Google Chrome, and ffmpeg on PATH
node trailer/render.mjs --chrome /path/to/chrome
```

Open `trailer/index.html` in a browser to preview it in real time, or `index.html?t=12` to freeze a frame.
