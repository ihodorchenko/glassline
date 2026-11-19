# Safari testing

## Status

Safari **27.2** / macOS **27.2.1**: production Training, Prologue and a full
**0-respawn Prologue run** passed via `safaridriver --mcp`
(Results 00:33.542). See `docs/evidence/cross-browser/safari/`.

## Automated real-Safari smoke

`tools/capture/safari-smoke.mjs` drives real Safari through
`safaridriver --mcp` (not Playwright WebKit).

One-time setup in Safari:

1. **Settings → Advanced → Show features for web developers**.
2. **Develop → Allow Remote Automation**.

Then:

```bash
node tools/capture/safari-smoke.mjs \
  --url http://127.0.0.1:4173/ \
  --out-dir /tmp/glassline-safari
```

It writes `menu.png`, `training.png`, and `report.json`.

Without the setting, Safari responds:

```
You must enable 'Allow remote automation' in the Developer section of Safari Settings
```

That is a browser permission, not an app failure.
