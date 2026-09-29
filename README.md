# Neon Particle Heart

An interactive WebGL particle field built around two parametric shapes — a
five-pointed star and a heart. Built with Three.js, it combines a sweeping
assembly wave, brief disintegration, neon bloom post-processing and three
auto-cycling colour themes.

Created by **Saklin Ali**.

## Features

- 10,000 particles driven by additive-blended spark sprites
- Two parametric shapes — a five-pointed star and a heart — sharing one particle field
- Assembles into the heart in a slow sweeping wave, holds its shape, then breaks apart briefly and reassembles on a continuous loop (the same cycle drives the star once transformed)
- Smooth heart to star morph, toggleable at any time with the Transform control
- Three colour themes: Inferno, Aurora and Jade — the theme steps through all three, one by one, as the shape forms
- Orbit camera with damping (drag to rotate, scroll to zoom)
- Frame-rate independent motion — identical timing on 60 Hz and 120 Hz displays
- Responsive control bar with frosted-glass styling

## Tech stack

- [Three.js](https://threejs.org/) r162 (ES modules, loaded from jsDelivr)
- UnrealBloomPass for the neon glow
- Vanilla JavaScript — no build step, no bundler

## Getting started

The page uses ES modules and loads Three.js from a CDN, so it must be served
over HTTP — opening `index.html` directly from the file system will not work.

**Option A — VS Code Live Server**

Right-click `index.html` and choose *Open with Live Server*.

**Option B — any static server**

```bash
npx serve .
```

Then open the URL printed in the terminal.

## Controls

| Control | Action |
| --- | --- |
| Transform (⇄) | Morph the field between star and heart |
| Motion (⏸/▶) | Pause and resume all motion |
| Mouse drag | Orbit the camera |
| Scroll | Zoom in and out |

## Project structure

```
├── index.html      # Entry point, import map, canvas container
├── style.css       # UI styling, themes as CSS variables
├── main.js         # Bootstrap: renderer, camera, bloom, UI, render loop
├── particles.js    # ParticleField class — geometry and per-frame logic
├── geometry.js     # Parametric star and heart curve samplers
└── config.js       # Particle count, themes, motion and bloom tuning
```

## Customisation

Everything worth tuning lives in `config.js`:

- `PARTICLE_COUNT` — density of the field
- `MOTION` — morph speed, cycle timing, shimmer frequencies
- `THEMES` — add a theme by appending an entry (palette + bloom values) and
  a matching `body[data-theme='...']` block in `style.css`

The shapes themselves are defined as parametric curves in `geometry.js`.

## Performance

Per-particle positions, colours and sizes are updated on the CPU each frame
and uploaded as buffer attributes. On weaker devices, lowering
`PARTICLE_COUNT` to `5000` keeps the animation smooth.

## License

MIT — © 2026 Saklin Ali