# Glassline 0.1.0 — final candidate

Дата среза: 2026-11-19, раунд 96. Это **reference-inspired vertical slice**, не
фотореалистичная AAA-игра.

## Как открыть

```bash
npm run dev        # http://127.0.0.1:5173
npm run build
npm run preview    # http://127.0.0.1:4173
```

Готовый архив: `glassline-final-build.zip`.

## Управление

| Действие | Клавиша |
|---|---|
| Движение | WASD |
| Прыжок | Space |
| Спринт | X |
| Присед / слайд | Shift (слайд — Shift на бегу) |
| Вольт / взаимодействие | E |
| Рестарт | R |
| Пауза | Esc |

Меню: стрелки/мышь, Enter. В Settings → Display → Quality доступны low /
medium / high.

## Что входит

- Пролог ~220 м: 5 секций, training, drop, слайд-тоннель, gap, лестница,
  skybridge, финальный подъём и FINISH.
- Стилевой бумажный загрузчик, HDR-пост, GTAO/bloom/ACES, PCF 4096-тени,
  двухмасштабные процедурные материалы, фаски, износ, лужи, ремонтные
  заплатки, красные перила.
- Процедурный звук с surface-aware шагами, эмбиентом и музыкой.
- Training и Prologue, результаты, настройки, локальные рекорды.
- Chromium и реальный Safari проходят полный автоматический забег.

## Ключевые числа

- **282 теста в 38 файлах**.
- Старт **13/13** метрик; звук Пролога **5/5**.
- **352 draw calls / 2,67M triangles** после merge и кэша теней.
- Полный забег: **4×0 респавнов**, 21,8–23,1 с (in-page autopilot).
- Safari: 0 респавнов, финальный регресс **27,0 с** (ранее 33,5 с), 13/13 стартовых метрик, Web Audio running.

## Известные ограничения

- Нет человеческой перцептивной приёмки визуала/звука.
- Арт стилизованный low-poly; 13/13 ≠ фотореализм.
- Полный забег записан автопилотом, не человеком-speedrunner'ом.
- Firefox и assistive-технологии не проверены (sandbox).
- Safari FPS не измерен достоверно: safaridriver троттлит rAF.
- Живой микс громче prologue-целей; review-копия нормализована.

## Что смотреть в первую очередь

- [Нормализованный полный забег](evidence/review/full-run-review.mp4).
- [Контактный лист](evidence/review/contact-sheet.jpg).
- [Safari Results](evidence/cross-browser/safari/full-run-results.png).
- [VERIFICATION.md](VERIFICATION.md).

## Решение

A — принять с ограничениями; B — продолжить новым потолком; C — техническое
закрытие. Рекомендация: **A или C**. Полный статус:
[`DECISION_AT_100.md`](DECISION_AT_100.md).
