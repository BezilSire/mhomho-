# MHOMHO — Campaign Zero motion graphics

## Overview

- **Topic**: branded motion graphics layered over the original Campaign Zero footage.
- **Hook**: "GET PAID" slams into the lower band in the first seconds.
- **Aha moment**: the crowd (particles) gathers into the word MHOMHO to close the clip.
- **Audience**: creators on the Campaign Zero screen — they need to see what to post and what it pays.
- **Length**: 6s kinetic overlay + 5s particle outro per clip.
- **Resolution**: 1920x1080 templates, composited at 1280x720 (16:9, the source framing).
- **Audio**: the original voice and music are never touched. The graphics are silent.

## Styles used (claude-motion-styles-20)

| Style | Where | Why |
|---|---|---|
| `motion-kinetic-type` | first 6s, lower band | one word per beat slams in with elastic squash and speed streaks — punchy, never static |
| `motion-particles` | last 5s (full-frame outro) | thousands of glowing dots drift, gather into "MHOMHO", hold, then burst — the crowd forming the wordmark |

Both ship as self-contained HTML canvas templates with a frame-exact Playwright
renderer (`render.py`). Local patches in `patch_templates.py`:

1. `render.py` uses the system Chrome already installed on the machine.
2. `motion-kinetic-type/template.html` gains `cx`, `cy`, `fs` and `mw` URL
   parameters so the kinetic words sit in the lower band — clear of the
   speaker's face and of the burned-in captions in the source footage.

## Color Palette (src/styles/tokens.css)

- Background: `#080706` — MHOMHO page
- Primary: `#FFCF3F` — what you earn
- Secondary: `#FF9F0A` — brand orange
- Accent: `#FF6B4A` — brand coral
- Bone: `#F7F4F0` — the alternating word

Colour meaning is fixed across the set: yellow = the offer, coral = the brand,
bone = the closing word.

## Placement rules (non-negotiable)

- The founder's face occupies the centre-left. The graphics never cross it.
- The burned-in captions sit centre-right. The graphics never cross them.
- Kinetic words live in the **lower band** (y ≈ 0.74 of frame height).
- The particle outro is a full-frame card, so it replaces the last 5 seconds
  rather than covering the captions.

## Checklist

- [x] Motion is animated on every beat — no static lower third
- [x] Nothing is placed over the burned-in captions
- [x] The logo mark and the wordmark are never stacked on top of each other
      (the wordmark is drawn from particles; no separate icon is placed over it)
- [x] Original footage, framing and sound are untouched
- [x] Deterministic renders (seeded randomness, frame-exact)
- [x] Stills checked at 10%, 40% and 80% before the final render

## Build

```powershell
.\build.ps1            # render templates, composite, copy to public/download
npm run build          # copy public/ into dist/client before deploying
```
