# Glassline — итоговая верификация

Снимок состояния на раунде 56 (2026-11-19). Все команды воспроизводимы из корня
репозитория.

## 1. Код и тесты

```bash
npm run validate   # typecheck + Biome + tests + production build
```

Результат последнего прогона:

- **279 тестов в 37 файлах — все прошли**;
- typecheck — без ошибок;
- Biome — без ошибок (есть предупреждения о допустимых `as`/non-null в тестах);
- `vite build` — успешно.

## 2. Стартовый кадр

```bash
npm run dev
node tools/capture/capture.mjs --launch \
  --out docs/evidence/verification/start.jpg --pos 0,0.93,6 --yaw 0 --pitch 0
npm run metrics -- --candidate docs/evidence/verification/start.jpg \
  --json docs/evidence/verification/metrics.json
```

**13/13 метрик в допуске**:

| metric | value | reference |
|---|---:|---:|
| luma | 0.6082 | 0.6152 |
| std | 0.2770 | 0.2946 |
| p25 | 0.3549 | 0.3710 |
| p95 | 0.9840 | 0.9806 |
| near-white | 20.71% | 34.49% |
| deep-shadow | 1.83% | 0.68% |
| saturation | 0.329 | 0.300 |
| local contrast | 0.265 | 0.285 |
| edge | 0.0249 | 0.0193 |
| sky | 40.02% | 43.26% |
| top contrast | 0.215 | 0.243 |
| split | −17.04 | −21.81 |
| red | 3.05 | 2.39 |

## 3. Звук Пролога

```bash
node tools/capture/audio-render.mjs \
  --out docs/evidence/verification/prologue-24s.wav --seconds 24
npm run audio:metrics -- --wav docs/evidence/verification/prologue-24s.wav \
  --json docs/evidence/verification/audio.json
```

**5/5 полос**:

| metric | value | target band |
|---|---:|---|
| low share | 0.896 | 0.85–0.94 |
| high share | 0.060 | 0.03–0.08 |
| LUFS | −26.00 | −31…−26 |
| peak | −5.26 dBFS | −60…−3 |
| short-term range | 22.86 | 18–26 |

Файл: [`prologue-24s.wav`](evidence/verification/prologue-24s.wav).

### High-route профиль

```bash
node tools/capture/audio-render.mjs   --out docs/evidence/verification/high-route-20s.wav --seconds 20 --high-route
```

**5/5** целей high-route (отдельные от Пролога):

| metric | value | target band |
|---|---:|---|
| low share | 0.851 | 0.82–0.92 |
| high share | 0.041 | 0.025–0.09 |
| LUFS | −24.46 | −26…−23 |
| peak | −4.91 dBFS | −6…−3 |
| per-second range | 24.4 | 12–26 |

Файл: [`high-route-20s.wav`](evidence/verification/high-route-20s.wav),
метрики: [`high-route-audio.json`](evidence/verification/high-route-audio.json).

## 4. Производительность

```bash
node <perf harness>   # 1600×900, Prologue start
```

Последний прогон: **avg 16.64 ms, p95 16.7 ms, ~60.1 fps**.

## 5. Ссылки и доказательства

- Markdown-аудит относительных ссылок: **0 битых**.
- Все ключевые артефакты лежат в `docs/evidence/` и открываются из
  [`REFERENCE_REVIEW.md`](REFERENCE_REVIEW.md).

## 6. Что это НЕ доказывает

- человеческое восприятие графики/звука;
- реальный спидран-результат (экран результатов получен синтетически);
- Firefox/Safari и assistive-технологии;
- фотореалистичность арта: стилизация остаётся заметной.
