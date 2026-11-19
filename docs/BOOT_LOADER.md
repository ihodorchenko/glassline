# Boot / level loading presentation

## Initial boot

`index.html` contains an inline paper/ink loader (`#boot-loader`) so the first
paint is styled even while the JS bundle and WASM are loading. It shows:

- `GLASSLINE / RUNNER NETWORK` masthead + red rule;
- staged label/progress (e.g. `GENERATING MATERIALS`, `BUILDING COLLISION`);
- percent, detail line, `Prologue / Rooftop Run`, build version;
- error state if initialization fails.

`ApplicationConfig.onBootStage` drives the stages from `Application.initialize`.
`BootLoader.complete()` keeps it visible for at least 900 ms and fades it out.

## Level generation

`UIManager.showLoading()` uses the same paper/ink language: wordmark, red rule,
`Preparing Run`, localized mode, sweeping progress rail, and a generation detail
line. It is shown before `SessionManager.startSession()`.

## Accessibility

- `role="status"` / `aria-live="polite"` and a progressbar with `aria-valuenow`.
- Reduced motion disables mark/sweep animation and transitions.
- The inline loader blocks pointer input until the menu is ready.

## Verification

- Production build captured at ~180 ms: [boot.jpg](evidence/visual/loader/boot.jpg).
- Build/loader visually verified in Edge headless; menu loads after the fade.
