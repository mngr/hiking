# Hiking Creek

A small Three.js stepping-stone game set in an infinite, curvy creek with procedural terrain, trees, and rocks.

## Run locally

Use a local static server to avoid browser module/CORS issues.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser.

## Controls

- Click or tap on a stone within jump range to step forward.
- Missing a stone or jumping too far ends the run.

## Notes

- Environment and stones are generated continuously as you move forward.
- Visuals are tuned for mobile-friendly performance.

## Assets

See `CREDITS.md` for texture sources and licenses.
