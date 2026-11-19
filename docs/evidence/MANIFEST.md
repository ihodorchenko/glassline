# Evidence manifest

Хэши ключевых артефактов на раунде 57. Проверка:

```bash
shasum -a 256 -c docs/evidence/MANIFEST.sha256
```

| Артефакт | Назначение |
|---|---|
| `verification/start.jpg` | Стартовый кадр (13/13) |
| `verification/metrics.json` | Метрики старта |
| `verification/prologue-24s.wav` | 24-секундный Пролог (5/5) |
| `verification/audio.json` | Аудио-метрики |
| `review/finish-results-run-review.mp4` | Нормализованный реальный финиш + Results |
| `review/finish-results-run-review.wav` | Аудио review-копии (−26 LUFS) |
| `review/contact-sheet.jpg` | Контактный лист |
| `video/round-53/finish-results-run.mp4` | Исходный физический финиш + Results |
| `video/round-53/real-results.png` | Экран результатов (15.594 s) |
| `visual/round-27/training.jpg` | Training |

Машиночитаемый список: [`MANIFEST.sha256`](MANIFEST.sha256).
