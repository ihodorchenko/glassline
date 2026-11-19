# Round 35 visual evidence — two-jump line vs lower bypass

Captured 2026-11-19 with the dev build and `tools/capture/capture.mjs`.

| File | View |
|---|---|
| `barriers.jpg` | Return catwalk with two red hazard barriers (x=39 and x=34) and BYPASS sign |
| `bypass.jpg` | Lower bypass lane looking east, with steps and RUN billboard |

The direct return line now has two 0.5 m barriers. From the turn, the player can
either jump x=39 then x=34, or jump x=39, drop into the lower bypass through the
x=30–38 opening, run under x=34, and climb the steps back up. This gives the
bypass a concrete purpose: **one jump + drop/climb** instead of **two jumps**.
The traversal test now scripts both jumps; bypass test still passes.

No route length/checkpoint/audio changes; start metrics remain 13/13.
