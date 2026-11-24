# Jarvis Russian Audio Evaluation Corpus v1
Date: 2026-11-22
Target: OGAM / Jarvis on OPPO Find X6 Pro PGEM10, Snapdragon 8 Gen 2 / SM8550
Purpose: reproducible Russian-first evaluation for ASR, TTS, VAD, wake word and voice turn-taking.
Status: text-only test corpus and protocol. No audio recordings are included or collected by this document.

## Rules

1. Use the same text and order for every TTS candidate. Preserve exact punctuation and capitalization.
2. Record only volunteer/test speaker audio with explicit consent. Do not use contact lists, private messages, or personal recordings.
3. Do not commit raw voice recordings, voice-clone samples, or private hotword audio to Git. Store test WAV files locally, hash them, and delete on request.
4. Model weights and output audio are separate artifacts: record model SHA-256, model card/license, runtime revision, ABI, sample rate and inference provider.
5. Never call a voice model real-time from a README claim. Measure first-audio latency and total RTF on PGEM10.
6. For TTS quality, score the generated sound by listeners. For ASR, calculate WER/CER against the reference text and retain punctuation/digit normalization rules.
7. Keep KWS positive and negative speech sets separate from TTS quality. A model must not activate on ordinary conversation or the phone's own synthesized voice.

## A. Russian stress, homographs and pronunciation

These sentences are designed to expose stress, homograph and phrasing errors. The intended sense is in the note, not as a phonetic hint to the TTS engine.

| ID | Test text | Check |
|---|---|---|
| RU-ST-01 | На стене висит старинный замок, а ключ от замка лежит в ящике. | castle: за́мок; door lock: замо́к |
| RU-ST-02 | На столе лежит мука, а мастер говорит, что его мучит мука совести. | flour: мука́; torment: му́ка |
| RU-ST-03 | На картине изображён атлас, а на полке лежит школьный атлас. | fabric: атла́с; map book: а́тлас |
| RU-ST-04 | Я плачу за покупку, а ребёнок плачет от обиды. | to pay: плачу́; to cry: пла́чет |
| RU-ST-05 | Белки в лесу запасают орехи, а белки крови измеряют в лаборатории. | squirrels: бе́лки; proteins: белки́ |
| RU-ST-06 | В аэропорту он сел на самолёт, а в театре сел в первый ряд. | stress and sentence rhythm |
| RU-ST-07 | Всё, что нужно, — это ёлка, тёплый шарф и хорошая музыка. | ё / е and natural pause |
| RU-ST-08 | Позвони́ мне, когда закончишь работу, и не забудь выключить свет. | imperative stress |
| RU-ST-09 | Договор подписан обеими сторонами; условия договора вступают в силу завтра. | noun stress |
| RU-ST-10 | Средства на счёте закончились, но новые средства защиты уже доставлены. | polysemy and stress |


## B. Numbers, dates, units and abbreviations

| ID | Test text | Check |
|---|---|---|
| RU-NUM-01 | Сегодня 22 ноября 2026 года, воскресенье. | Date inflection |
| RU-NUM-02 | Обновление установлено 1 августа 2026 года. | Date inflection |
| RU-NUM-03 | В памяти доступно 3,75 гигабайта, а размер модели — 884 мегабайта. | Decimal, units |
| RU-NUM-04 | Запись выполняется с частотой 16 килогерц, а синтез — 24 килогерца. | Unit inflection |
| RU-NUM-05 | Температура процессора достигла 47 градусов, затем снизилась до 39. | Number agreement |
| RU-NUM-06 | Версия прошивки — PGEM10, сборка 16.0.5.1201, пакет C20P01. | Alphanumeric reading |
| RU-NUM-07 | Цена составила 1 299 евро 90 центов, скидка — 12 процентов. | Currency and percent |
| RU-NUM-08 | Задача номер 1042 завершена за 0,8 секунды. | Decimal and ordinal |
| RU-NUM-09 | Телефон поддерживает Wi‑Fi 7, Bluetooth 5.3 и USB Type‑C. | Tech abbreviations |
| RU-NUM-10 | В 08:05 началась проверка, а в 18:40 завершилось обновление. | Clock time |

## C. Technical Russian and foreign acronyms

| ID | Test text | Check |
|---|---|---|
| RU-TECH-01 | Jarvis работает на Snapdragon 8 Gen 2 и проверяет доступность Qualcomm QNN. | Brand/acronym pronunciation |
| RU-TECH-02 | Модели GGUF загружаются через llama.cpp, а аудио распознаётся при помощи Qwen3-ASR. | Mixed Latin/Russian |
| RU-TECH-03 | Kotlin передаёт данные в C++ через JNI, а ONNX Runtime запускает локальную нейросеть. | Acronyms |
| RU-TECH-04 | VoiceInteractionService получает системный вызов, но не означает, что включено постоянное прослушивание. | Long technical name |
| RU-TECH-05 | ColorOS 16 использует собственные сервисы OPPO, однако Jarvis должен сохранять автономность. | Brand pronunciation |
| RU-TECH-06 | Binder и AIDL обеспечивают взаимодействие между Android-процессами с проверкой разрешений. | Technical terms |
| RU-TECH-07 | SHA‑256 проверяет целостность файла до его импорта в библиотеку моделей. | Hash acronym |
| RU-TECH-08 | VAD определяет активность речи, ASR преобразует голос в текст, а TTS озвучивает ответ. | Acronyms and pauses |

## D. Jarvis dialogue and expressive speech

| ID | Test text | Check |
|---|---|---|
| RU-DLG-01 | Добрый вечер. Я Джарвис. Слушаю вас. | Calm assistant persona |
| RU-DLG-02 | Я нашёл три подходящих варианта. Первый — самый быстрый, второй — экономичный, третий — наиболее точный. | Natural list cadence |
| RU-DLG-03 | Подтвердите, пожалуйста: отправить сообщение сейчас? | Question intonation |
| RU-DLG-04 | Готово. Файл сохранён локально. Никакие данные не отправлялись в облако. | Short status phrases |
| RU-DLG-05 | Я не уверен в распознанном имени. Повторите его, пожалуйста. | Clear uncertainty |
| RU-DLG-06 | Внимание: команда изменит системные настройки. Выполнить её после вашего подтверждения? | Warning tone |
| RU-DLG-07 | План на сегодня: проверить обновления, загрузить модель и протестировать голосовой ввод. | Longer prosody |
| RU-DLG-08 | Я остановил воспроизведение и освободил аудиофокус. Можете продолжать. | Technical status |

## E. Wake-word positive and hard-negative text set

For the acoustic test, record only with consenting volunteers and vary distance, noise and speaking style. The table defines scenarios, not permission for hidden recording.

| ID | Utterance/scenario | Expected KWS result |
|---|---|---|
| KWS-P-01 | «Джарвис» spoken clearly, quiet room, near microphone | Detect |
| KWS-P-02 | «Джарвис, включи фонарик» | Detect once |
| KWS-P-03 | «Джарвис» spoken at normal volume from 2 metres | Measure recall |
| KWS-P-04 | «Джарвис» spoken softly | Measure recall; no guaranteed detection |
| KWS-P-05 | «Джарвис» spoken by another consenting speaker | Measure speaker independence |
| KWS-N-01 | «Жарить картошку» | Do not detect |
| KWS-N-02 | «Жаркий вечер» | Do not detect |
| KWS-N-03 | «Скажи, пожалуйста, Марии» | Do not detect |
| KWS-N-04 | TV dialogue containing similar syllables | Do not detect |
| KWS-N-05 | The phone's own TTS says «Джарвис» | Suppress/reject during playback |
| KWS-N-06 | Ordinary conversation mentioning Jarvis in a longer sentence | Measure false activation |
| KWS-N-07 | Silence, room noise, fan, keyboard or road noise | Do not detect |

For each KWS condition report true accepts, false rejects, false accepts per hour, detection latency and CPU/battery cost. Use at least 30 positive utterances per speaker/condition and a longer negative background sample; small samples are only a smoke test.

## F. Microphone echo/AEC scenarios

The AEC test is a controlled local experiment, not an always-listening test:
1. Play the fixed TTS sentences RU-DLG-01, RU-DLG-04 and RU-TECH-02 at a fixed, safe volume.
2. Record near-end test phrases while playback is active, using a consenting speaker.
3. Compare capture with and without a confirmed AcousticEchoCanceler attached to the actual AudioRecord session.
4. Repeat on speaker, earpiece and Bluetooth route.
5. Score remaining echo, near-end speech clarity, clipped words, false VAD activations and AEC state transitions.
6. Do not mark AEC as enabled based only on isAvailable(); record create(sessionId), descriptor and actual enabled/control state.
7. If AEC is unavailable or the signal is not suppressed, keep half-duplex turn-taking.

## G. Measurement protocol for PGEM10

### Device preparation
- Record Android build, app version, model/runtime revision and SHA-256.
- Start at a repeatable battery range and a cool thermal state; log ambient conditions.
- Download models before offline tests; enable airplane mode for local-only claims.
- Close other large local models before the TTS test. Test co-residency separately after baseline.
- Run CPU baseline first. Enable NNAPI/QNN/Vulkan only as separate experiments and record backend selection evidence.

### TTS measures
- Cold model load (ms), warm model load (ms), first non-silent PCM delivery (TTFA ms), total wall time (ms), output duration (ms), sample rate, peak RSS and model file size.
- Real-time factor: RTF = synthesis wall time / generated-audio duration; less than 1 is faster than real time.
- Number of callbacks/chunks and their duration; record whether callback is incremental model output, sentence/batch output, or only output after full synthesis.
- CPU/GPU/NPU backend, thread count, thermal status, battery delta per 10 minutes, and OOM/model-load failures.
- Listener scores (1–5): intelligibility, naturalness, Russian stress, names/technical terms, rhythm, emotional appropriateness and voice consistency.

### ASR measures
- WER/CER under fixed text normalization policy; number/dates/abbreviations score separately.
- First partial result latency, final latency, RTF, CPU/RAM/thermal/battery and offline operation.
- Keep raw audio local; delete after scoring unless a participant explicitly agrees to retention.

### VAD / endpoint measures
- Missed quiet speech, false speech on noise/music, end-of-turn latency, truncation count and overlong-tail count.
- Compare current RMS endpoint to Silero VAD using the same PCM corpus.

### Repetition and reporting
- Three cold and five warm synthesis runs per model for the initial smoke test.
- Publish medians and p95, not only the best run.
- Do not declare a production winner from one speaker, one room, or one short utterance.
- Record every failed run. Do not silently discard errors or outliers.

## H. Not yet done

- No audio corpus has been recorded.
- No model has been downloaded for this benchmark.
- No TTS/ASR/KWS/AEC timings have been measured on PGEM10.
- This document does not imply that any voice engine is selected or production-ready.
