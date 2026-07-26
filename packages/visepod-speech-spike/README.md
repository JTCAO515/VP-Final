# VisePod Speech Spike

Private experiment harness for Issue #280. It is not a production speech package and no application
imports it.

## What it measures

- PCM S16LE 16 kHz mono input split into 20 ms / 640-byte frames
- 20 fixed English, Chinese, and mixed-language scripts
- STT completion, TTS first audio, TTS completion, and total speech-round latency
- character error rate, p50/p95, and exact provider/model/region price snapshots
- deterministic client-side Wi-Fi delay, jitter, loss, and disconnect profiles

## Run boundary

Configure only the environment names registered in OA-016. Never put values in this README, Git,
shell history, screenshots, or Issue comments. WAV fixtures and reports belong outside the repository.

```bash
pnpm --filter @visepanda/visepod-speech-spike benchmark -- \
  --fixtures-dir /private/path/to/fixtures \
  --network wifi_good \
  --upload-mode buffer_on_commit \
  --report /private/path/to/report.json
```

Missing configuration, invalid audio, timeout, provider failure, empty transcript/audio, missing usage,
or simulated disconnect returns a failed observation. There is no mock-success mode.

See
[`docs/planning/visepod-speech-provider-latency-assessment.md`](../../docs/planning/visepod-speech-provider-latency-assessment.md)
for evidence labels, sample matrix, sources, decision gates, and the current blocker.
