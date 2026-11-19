# Round 71 — beveled level geometry

| File | View |
|---|---|
| `start-beveled.jpg` | Start frame with chamfered box edges |
| `close-beveled.jpg` | Close floor/props with rounded highlights |
| `metrics.json` | Start metrics |

## What changed

- Static level boxes now use cached `RoundedBoxGeometry` per unique size
  (2 segments, bevel clamped to 4–35 mm).
- Colliders stay exact cuboids; bevel is visual only.
- Edge highlights catch soft sun/sky light, removing the razor-sharp low-poly
  silhouette on parapets, steps, beams and props.
- Start **13/13**, 60.2 fps, 280 tests.
