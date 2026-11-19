# Round 40 settings evidence — motion intensity coherence

`camera.motion_intensity` now scales the landing camera lift/roll and the menu
presentation drift, matching its existing effect on bob/FOV. `reduced_motion`
still forces both to zero. The new camera test proves normal vs muted landing
roll; the menu drift uses the same clamped multiplier.

No visual assets changed; see [`motion.json`](motion.json).
