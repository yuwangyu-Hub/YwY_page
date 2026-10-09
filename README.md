# Spritely — Video / Image to Sprite Sheet Converter

An offline, browser-based tool that turns AI-generated animation clips (or image sequences) into game-ready sprite sheets.

Everything runs locally with Canvas — **no upload, no login, no token, no payment**.

## Features

1. **Import** — load a video (MP4 / WebM / MOV) and sample frames by start/end time and FPS, or load multiple images directly.
2. **Chroma key** — pick the background color straight from the canvas with a tolerance slider; removes green screen or any solid backdrop.
3. **Auto-crop & resize** — computes a bounding box across all frames so every sprite stays aligned; canvas presets from 24 to 1024, custom size, and anchor positioning.
4. **De-halo** — erodes the alpha channel to strip edge fringing left over from keying.
5. **Export** — sprite sheet PNG (auto grid layout), per-frame ZIP bundle, multi-select frames, and an animated preview.

## Run locally

```bash
cd spritely_local
python3 -m http.server 8765
```

Then open `http://127.0.0.1:8765`. Or simply double-click `index.html`.

To share it on your local network:

```bash
python3 -m http.server 8765 --bind $(ipconfig getifaddr en0)
```

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and UI |
| `style.css` | Dark theme styling |
| `app.js` | Frame extraction, chroma key, crop, halo removal, preview, export |
| `jszip.min.js` | JSZip (vendored) — powers offline ZIP export |
| `test_logic.js` | Unit tests for the core image algorithms |

Run the algorithm tests with Node:

```bash
node test_logic.js
```

## Notes

- Frames are downscaled to a max edge of 512 px and capped at 600 frames to keep memory usage sane. Adjust `MAX_DIM` in `app.js` if you need higher resolution.
- This is a local reconstruction of the original online Spritely tool; the Supabase auth and PayPal paywall from the original are intentionally not implemented.
