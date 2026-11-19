# Styled boot loader

Captured from the production build (`http://127.0.0.1:4173/`) at ~180 ms after
navigation.

| File | View |
|---|---|
| `boot.jpg` | Paper/ink boot screen: GLASSLINE masthead, red rule, runner-network metadata, staged progress |

The loader is inline in `index.html` so it paints before the 5 MB game bundle.
Stage/progress updates come from `Application.initialize()` (`boot`, `storage`,
`world`, `materials`, `physics`, `level`, `audio`, `ui`, `ready`). Minimum visible
time is 900 ms; reduced-motion disables the mark animation and transitions.
