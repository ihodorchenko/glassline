# Cross-browser evidence

## Real Safari — manual test (2026-11-19)

- Safari **27.2**, macOS **27.2.1**.
- URL: `http://127.0.0.1:4173/`
- Action: selected **Training**.
- Result: **PASS — no crash**, level entered.

This supersedes the Playwright WebKit result: the
`rawcolliderset_createCollider` trap is a headless Playwright artifact, not a
real Safari failure. Full-route/audio/performance verification in Safari is
still pending.

## Chromium

Production build, full menu/gameplay and automated runs pass.

## Firefox

Playwright Firefox 135 is blocked by the host sandbox (`sandbox_init`); an older
WebDriver Marionette run reached the menu but gameplay/WebGL was not exercised.
