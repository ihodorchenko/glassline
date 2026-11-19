# Cross-browser audit — round 61

Цель: проверить игру в Chromium, Firefox и Safari. Ниже — фактический результат,
без заявления о полной кросс-браузерности.

## ОБНОВЛЕНИЕ: реальный Safari (2026-11-19)

В **Safari 27.2 / macOS 27.2.1** Training запускался вручную, затем через
`safaridriver --mcp` проверены Production Training, Prologue и **полный
Problue-забег**: **0 респавнов, Results 00:33.542**, консоль без ошибок.
Ошибка `rawcolliderset_createCollider` в Playwright WebKit не воспроизвелась —
это артефакт headless-Playwright, а не Safari.

## Матрица

| Движок | Загрузчик/меню | Gameplay | Статус |
|---|---|---|---|
| Chromium (Edge, production) | PASS | PASS | рабочий браузер |
| **Safari 27.2 (реальный, MCP + вручную)** | PASS | **PASS (Training + полный Prologue)** | 0 респавнов, Results 33.542 s |
| WebKit 18.4 (Playwright) | PASS | FAIL | **не представитель Safari**; см. ниже |
| Firefox 135 (Playwright/geckodriver) | не проверено | не проверено | Firefox падает с SIG11/`marionette decode` под sandbox; evidence: `firefox/geckodriver.log` |

## Playwright WebKit: ложное срабатывание

В headless Playwright WebKit 18.4 меню и загрузчик рендерятся, но при старте
Training/Prologue:

```
RuntimeError: Out of bounds memory access
(evaluating '...rawcolliderset_createCollider(...)')
[Glassline] Session start failed
```

Минимальная репродукция: второй `createCollider`, привязанный к
`RigidBody`, падает в WebKit; один коллайдер работает.

Проверенные версии Rapier:

| Версия | Создание 300 коллайдеров в WebKit |
|---|---|
| 0.21.0 (текущая) | FAIL |
| 0.20.0 | FAIL |
| 0.18.0 | FAIL |
| 0.16.0 | FAIL |
| 0.15.0 | PASS |
| 0.14.0 | PASS |

Причина, вероятно, в изменении WASM-обвязки Rapier после 0.15 / баге WebKit
WASM. Это не ошибка уровня или геометрии: падение воспроизводится на
минимальной странице без Three.js.

## Почему этот результат не относится к Safari

Реальный Safari 27.2 Training запускает; следовательно, трап воспроизводится
только в WebKit-сборке Playwright (её WASM/JS-окружение), а не в Safari.
Откат на Rapier 0.15 не нужен.

0.15 проходит создание коллайдеров, но меняет character-controller:

- слайд не проходит низкий тоннель (`player-traversal` падает);
- меняется тайминг catwalk (263 кадра вместо >300);
- API `computedMovement()` возвращает вектор вместо записи в аргумент.

Откат требует переработки движения/слайда и повторного тюнинга. Пока оставлена
0.21.0; это осознанный компромисс в пользу рабочего Chromium-геймплея.

## Firefox

Ни Playwright Firefox, ни системный Firefox через geckodriver не стартуют в
этом окружении (SIG11, `Failed to decode response from marionette`,
`NS_ERROR_FILE_ACCESS_DENIED` для Crash Reports). Это ограничение sandbox, не
приложения.

```
Sandbox error: sandbox_init() failed with error "Operation not permitted"
Can't find profile directory
```

Это ограничение sandbox, не приложения. Проверка Firefox остаётся открытой.

## Следующие шаги

1. Safari Remote Automation уже включён; smoke и полный забег пройдены
   (`tools/capture/safari-smoke.mjs`, `tools/capture/safari-route.mjs`).
   Визуал старта прошёл **13/13** метрик; rAF-FPS в Safari через safaridriver
недостоверен (троттлинг автоматизации), поэтому производительность Safari
не заявляется. Safari Web Audio: контекст `running`, 44.1 kHz, ~2.9 ms base latency; это
техническая проверка, человеческое прослушивание ещё не проводилось.
2. Firefox: запуск вне sandbox или через реальный профиль.
3. Playwright WebKit оставить только как известный false-positive, не как
   блокер Safari.

## Evidence

- [`evidence/cross-browser/safari/README.md`](evidence/cross-browser/safari/README.md) — real Safari Training + full run PASS.

## Воспроизведение

```bash
# production build
npm run build && npm run preview -- --port 4173

# WebKit smoke (Playwright browser cache)
PLAYWRIGHT_BROWSERS_PATH="$PWD/.npm-cache/ms-playwright" \
  npx playwright@1.51.1 screenshot --browser=webkit \
  --viewport-size="1280,720" --wait-for-timeout=6000 \
  http://127.0.0.1:4173/ /tmp/webkit-menu.png
```

Меню рендерится; клик Training даёт ошибку выше.
