# UX + city-below iteration — design brief (AD, 2026-11-20)

Owner feedback after hands-on play: (1) the goal is not obvious, especially in
Training — a small red 3D pyramid should hang above the target with its apex
pointing at it, including the finish; (2) the city below is empty — the
reference either hides it in fog or draws the streets.

## 1. World-space objective marker

- **Shape:** four-sided pyramid, **apex DOWN** (square base on top); base
  0.35×0.35 m, height 0.5 m. Not an octahedron (reads as a gem, not a pointer).
  Optional surface anchor: red ring decal Ø0.6 m, 0.02 m above the surface,
  directly under the apex.
- **Height:** apex 1.5 m above the target surface, base at 2.0 m; bob ±0.08 m
  with a 2.4 s period; yaw 0.6 rad/s. **Reduced motion:** bob and rotation off,
  marker static (existing accessibility setting).
- **Colour/material:** existing red `0xD52E36`, roughness 0.45, metalness 0.
  **Emission 0.12** (cap ≤0.15, same order as signage) so it reads in shadow;
  bloom threshold 1.0 is not hit. No fresnel/glow. This is semantic in-world
  runner UI, not an architectural surface — the "no emissive additions" rule
  applied to world/metric surfaces; the exemption is recorded once in DECISIONS.
- **Visibility:** only the ACTIVE target. Training: one marker over the current
  `reach_location` step; on completion it hides and the next one spawns (no
  trail). Prologue: over the next checkpoint of the active section; in the final
  section over the finish gate/terminal; after `trigger_finish` it hides. No
  permanent finish marker from the start (spoils the route, clutters the BG).
  Distance fade: alpha 1→0 between 50 and 60 m; fade-in within 3 m (never clip the
  camera). Depth-tested, no x-ray/always-on-top.
- **Capture mode:** markers do NOT spawn with `?capture=1` (review frames and
  determinism stay as post-G5.1); gameplay Training/Prologue only; not in the
  menu vignette.
- **Enough:** a new player without HUD identifies the next goal within ≤2 s at
  the Training spawn and on entering each Prologue section; the marker is visible
  in ≥90 % of approach frames at 5–40 m; review frames byte-identical; reduced
  motion static; no bloom halo; emission ≤0.15.
- **Hack list:** x-ray/always-on-top; emission >0.15 or bloom on the marker; more
  than one marker at once; marker in capture mode; size >0.6 m as a substitute
  for route readability; replacing the route strips with the marker (strips stay).

## 2. City-below street grid (content, no look changes)

- **Grid:** block pitch 30 m = 20×20 m block + 10 m right-of-way (6 m carriageway
  + 2 m sidewalk each side). Radius x −120…+120, z −200…+40 (8×8 = 64 blocks);
  beyond the radius the existing far skyline remains. LOD: farther than 120 m
  from the route — buildings + asphalt only, no markings/cars/trees/lamps.
- **Markings:** centre dash 0.15 m, 3 m dash / 3 m gap, `#E8E8E0`; edge solid
  0.1 m `#D8D8D0`; crosswalks at intersections: 6 bars 0.5×3 m across the 6 m
  carriageway, 0.5 m pitch; stop line 0.3 m. +0.02 m above asphalt (no
  z-fighting).
- **Sidewalks/curbs:** slab +0.15 m above carriageway, `#C7C9C7`; curb face
  `#A8ADAE`.
- **Street lamps:** pole Ø0.08×5 m + 1.2 m arm + head 0.3×0.15×0.1, steel
  `0x747A7D`, every 15 m alternating sides; emissive 0 (day).
- **Cars:** box 1.8×1.4×4.2 + cabin 1.6×0.5×2.2; palette [`#8A9096`, `#B8BCC0`,
  `#5A6066`, `#2B3542`, red 1/12]; 0.5 m from the curb; ~1 car per 12 m of curb
  on 40 % of blocks → 60–80 cars.
- **Trees:** trunk Ø0.15×2 m + crown 1.6×1.8×1.6, muted `#4A5A40`; every 10 m on
  50 % of blocks → ~80.
- **Block buildings:** 1–3 boxes per block, heights 8–18 m, post-war concrete
  `#C7C9C7` with punched windows 1.5×3 m (reuse the facade generator) and some
  `glass-far` bands `#1A2530`; roof cap + 1 AC box. **Building tops ≤ y −4**
  (below the lowest deck at −3) so canyon/rooftop sightlines do not change.
- **Palette:** asphalt `#62686B`, markings `#E8E8E0`/`#D8D8D0`, sidewalk
  `#C7C9C7`, curb `#A8ADAE`; no new saturated colours.
- **Budget:** ≤ +1200 boxes through instancing/batching; draw calls ≤ +12; tris
  ≤ +250 k; perf gate headed avg ≥55 and 1 % low ≥55 (service/skybridge
  re-measure).
- **Look verdict: NO by default.** Streets + existing fog 60/380 give the
  reference language (near city readable, far city hazy). Ground haze planes /
  translucent billboards = hack (banding, fake depth), forbidden. If the guided
  A/B still shows a flat void beyond the radius: first extend the content LOD
  grid to 320 m (buildings + asphalt); only then, if still empty, one
  lead-approved look exception `fogFar 380→300` with a re-blind of the four
  canyon/rooftop frames; not by default.
- **Enough:** from skybridge/finish looking down you see ≥3 intersections with
  crosswalks, ≥10 cars, ≥10 trees; inside the 120 m radius no continuous asphalt
  plane >40×40 m; at 100 % zoom dashes/crosswalks/curbs are crisp without
  z-fighting; review frames keep the canyon/rooftop 4/4 criteria, below-parapet
  depth is not worse; determinism 6/6; perf gate.
- **Hack list:** haze planes instead of streets; neon markings; buildings above
  y −4; emissive lamps; grid only under the camera (potemkin); unauthorised fog.

## 3. Guided A/B (post-G5.1 ↔ this iteration)

Six-frame A/B plus dedicated looking-down angles (skybridge/finish/first-gap
underside): below parapets and through the glass the grid/crosswalks/cars/trees
read and there is no flat plate; above parapets and the route sightline nothing
changes (buildings ≤ y −4); no markers in the review frames (byte-identical
check for the marker); crisp markings at 100 %; no confetti density; metrics and
guardrails without a >1-band regression; perf and determinism. No blind if the
canyon/rooftop 4/4 and guardrails hold; the marker is checked by a play test
(≤2 s to target), reduced motion and capture-mode absence.

Both sections: no route/collider/trigger/sightline changes; the look layer stays
frozen except the single lead-approved exception.
