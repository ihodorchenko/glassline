# Cross-browser audit — round 61

Цель: проверить игру в Chromium, Firefox и Safari. Ниже — фактический результат,
без заявления о полной кросс-браузерности.

## ОБНОВЛЕНИЕ: реальный Safari (2026-11-19)

Пользователь вручную открыл `http://127.0.0.1:4173/` в **Safari 27.2 на
macOS 27.2.1**, выбрал Training — **игра не падает**. Значит, ошибка
`rawcolliderset_createCollider` в Playwright WebKit — артефакт headless-сборки
WebKit, а не отказ реального Safari. Код/зависимости из-за этого не менялись.

## Матрица

| Движок | Загрузчик/меню | Gameplay | Статус |
|---|---|---|---|
| Chromium (Edge, production) | PASS | PASS | рабочий браузер |
| **Safari 27.2 (реальный, вручную)** | PASS | **PASS (Training)** | пользователь подтвердил: не падает |
| WebKit 18.4 (Playwright) | PASS | FAIL | **не представитель Safari**; см. ниже |
| Firefox 135 (Playwright) | не проверено | не проверено | браузер не стартует под sandbox окружения |

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

Playwright Firefox 135 не стартует в этом окружении:

```
Sandbox error: sandbox_init() failed with error "Operation not permitted"
Can't find profile directory
```

Это ограничение sandbox, не приложения. Проверка Firefox остаётся открытой.

## Следующие шаги

1. Проверить в Safari полный маршрут/управление/звук (Training уже PASS).
2. Firefox: запуск вне sandbox или через реальный профиль.
3. Playwright WebKit оставить только как известный false-positive, не как
   блокер Safari.

## Evidence

- [`evidence/cross-browser/README.md`](evidence/cross-browser/README.md) — real Safari manual PASS.

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
