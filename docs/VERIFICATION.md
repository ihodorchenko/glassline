# Glassline — итоговая верификация

Снимок на раунде 95 (2026-11-19). Команды воспроизводимы из корня репозитория.

## 1. Код и тесты

```bash
npm run validate
```

- **282 теста в 38 файлах — все прошли**;
- typecheck / Biome / production build — зелёные.

## 2. Стартовый кадр

**13/13 метрик** в допуске.

| metric | value | reference |
|---|---:|---:|
| luma | 0.621 | 0.615 |
| std | 0.264 | 0.295 |
| p25 | 0.386 | 0.371 |
| p95 | 0.965 | 0.981 |
| near-white | 21.69% | 34.49% |
| deep-shadow | 1.05% | 0.68% |
| saturation | 0.323 | 0.300 |
| local contrast | 0.252 | 0.285 |
| edge | 0.028 | 0.019 |
| sky | 43.30% | 43.26% |
| top contrast | 0.210 | 0.243 |
| split | −23.54 | −21.81 |
| red | 3.01 | 2.39 |

Файлы: [`start.jpg`](evidence/verification/start.jpg),
[`metrics.json`](evidence/verification/metrics.json).

## 3. Звук Пролога

24-секундный offline-рендер: **5/5** целей
(LUFS −26.00, peak −5.26 dBFS, range 22.86, low 0.896, high 0.060).

Файл: [`prologue-24s.wav`](evidence/verification/prologue-24s.wav),
метрики: [`audio.json`](evidence/verification/audio.json).

## 4. Рендер и производительность

- Display quality low/medium/high работает; low отключает тени/GTAO/bloom.
- Static merge: draw calls **1040 → 448**; после кэша статических теней —
  **352 calls / 2.67M triangles**.
- Baseline до длительной Safari-автоматизации: **60.1–60.3 fps**.
- Текущий FPS-замер хоста искажён параллельной Safari/GPU-активностью, поэтому
  **не используется как финальное число**.

## 5. Полный забег

- Chromium: **4 прогона подряд, 0 респавнов, 21.8–23.1 с** (in-page autopilot,
  Round 89). CDP-polled прогоны остаются стохастическими.
- Safari 27.2: **33.542 s, 0 респавнов**, Results; стартовые метрики **13/13**.

## 6. Кросс-браузер

- **Chromium/Edge:** стабильный полный gameplay.
- **Safari 27.2:** Training, Prologue, полный забег, Web Audio `running`
  (44.1 kHz, ~2.9 ms), консоль без ошибок.
- **Playwright WebKit:** ложное срабатывание `createCollider`, не Safari.
- **Firefox:** environment-limited, gameplay не проверен.

## 7. Что это не доказывает

- человеческое восприятие графики/звука;
- фотореализм;
- Firefox/assistive-технологии;
- стабильный Safari FPS и полный аудиомикс в Safari.

## 8. Ссылки

- [REFERENCE_REVIEW.md](REFERENCE_REVIEW.md)
- [CROSS_BROWSER.md](CROSS_BROWSER.md)
- [PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md)
- [Evidence manifest](evidence/MANIFEST.md)
