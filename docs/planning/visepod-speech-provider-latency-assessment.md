# VisePod Speech Provider and Wi-Fi Latency Assessment

Date: 2026-07-27
Status: draft

## Question and decision boundary

Issue #280 asks whether a three-to-five-unit VisePod investor prototype can deliver an honest
push-to-talk loop over public or venue Wi-Fi: PCM upload, bilingual transcription, Copilot, speech
synthesis, and audible playback. This document evaluates only the speech-provider and network edges.
It does not freeze the production provider, Device Protocol, Device Gateway, firmware, or a public
hardware commitment.

The purchased Waveshare ESP32-S3-Touch-AMOLED-1.8 has Wi-Fi/BLE and no cellular modem. Cat.1 evidence
is therefore invalid for this prototype. The controlled baseline is 2.4 GHz Wi-Fi behind NAT, with
weak signal, packet loss, disconnect, timeout, and reconnect observations.

## Sources and research limitations

Primary documentation reviewed on 2026-07-27:

- [Alibaba Cloud Paraformer WebSocket API](https://help.aliyun.com/en/model-studio/websocket-for-paraformer-real-time-service)
  documents Bearer-authenticated WebSocket tasks, binary mono audio, task lifecycle events, and the
  Beijing workspace endpoint.
- [Alibaba Cloud CosyVoice WebSocket API](https://www.alibabacloud.com/help/en/model-studio/cosyvoice-websocket-api)
  documents duplex task messages, binary streaming audio, and character usage.
- [Alibaba Cloud model pricing](https://help.aliyun.com/en/model-studio/model-pricing) lists the
  observed China-region snapshots used by the experimental calculator: Paraformer realtime v2 at
  CNY 0.00024 per audio second and CosyVoice v3.5 Flash at CNY 0.8 per 10,000 characters.
- [Tencent Cloud real-time speech recognition](https://cloud.tencent.com/document/product/1093/35686)
  is retained as a China-hosted exit candidate; account activation, exact model, region, price, and
  data handling must be captured at test time.
- [Azure Speech regions](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions)
  and [text-to-speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech)
  are retained as an international exit candidate; the selected resource region and China-network
  behavior require real observation.

Documentation proves protocol and published price claims, not recognition quality, end-to-end
latency, service availability from the demo venue, or actual billing. No provider credential is
available in the local implementation environment, so this revision contains **zero real provider
runs**. It must not be presented as a completed feasibility result.

## Candidate matrix

| Candidate                        | Evidence available now                                                                     | Strength for the prototype                                                  | Unverified risk                                                                        | Current role                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| DashScope Paraformer + CosyVoice | Official WebSocket protocol and China pricing; experimental client and deterministic tests | Native PCM streaming, Beijing endpoint, one provider account for both edges | Real bilingual quality, first audio latency, venue reachability, account data settings | P01 measurement candidate, not frozen             |
| Tencent Cloud ASR/TTS            | Official service documentation only                                                        | China-hosted operational exit path                                          | No account, no fixed sample results, no normalized price snapshot                      | Exit candidate; test only after operator approval |
| Azure Speech                     | Official region and TTS documentation only                                                 | International vendor diversity and regional resource controls               | Mainland venue latency/reachability, account region, price, bilingual quality          | Exit candidate; test only after operator approval |

No winner exists until one primary and at least one exit candidate complete the same sanitized sample
subset. Provider popularity, model output, and documentation examples are not substitutes for this
comparison.

## Reproducible experiment

The isolated package `packages/visepod-speech-spike` provides the experiment boundary. It is not
imported by Web, Server, Ops, Domain, or future firmware.

### Fixed fixture contract

- Exactly 20 versioned transcript cases cover English, Chinese, mixed speech, payment, transport,
  food safety, place/hotel names, numbers, and recovery prompts.
- WAV input must be PCM S16LE, 16 kHz, mono. Twenty milliseconds equals 640 bytes.
- Audio files stay in an operator-controlled local directory excluded from Git. Use synthetic or
  explicitly consented voices with no traveler identity, phone, document, booking, or address data.
- The report stores sample IDs, expected and recognized fixed script text, metrics, and sanitized
  failure codes. It never stores audio bytes, provider keys, cookies, signatures, or headers.

### Minimum evidence run

1. Run all 20 samples against the P01 candidate under `wifi_good` with `buffer_on_commit`.
2. Run the same 20 with `upstream_streaming`; compare STT completion and total-round p50/p95.
3. Run at least eight representative samples under `wifi_public` and `wifi_weak` for each retained
   mode. The harness adds deterministic delay, jitter, and loss; label this evidence
   `network_simulation`, never real venue evidence.
4. Run the disconnect profile and invalid-audio case. They must fail with bounded, sanitized errors.
5. Run the fixed eight-sample comparison subset against at least one exit candidate using an
   equivalent meter and report schema before freezing a provider.
6. Repeat the chosen path on the actual demo network before #281/#283 can consume the result.

### Commands after OA-016 is configured

```bash
pnpm --filter @visepanda/visepod-speech-spike benchmark -- \
  --fixtures-dir /private/path/to/consented-wav-fixtures \
  --network wifi_good \
  --upload-mode buffer_on_commit \
  --report /private/path/to/sanitized-report.json
```

The output path should remain outside the repository until a reviewer confirms it contains only the
allowlisted report schema. A missing key, model, voice, endpoint, fixture, timeout, empty transcript,
empty audio, or simulated disconnect is a failed observation. The CLI never emits mock success.
`VISEPOD_SPEECH_REGION` must match an exact registered price snapshot; the initial registry contains
only `cn-beijing`. A different endpoint/region fails closed until its own price source is recorded.

## Metrics and provisional thresholds

| Observation          | Computation                                           | Prototype interpretation                                       |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| STT completion       | audio send start to final `task-finished`             | Report p50/p95 and failures by locale/category                 |
| TTS first audio      | TTS socket start to first binary frame                | Report p50/p95; do not substitute total completion             |
| Total speech round   | local STT start through complete TTS response         | Speech-edge value only; Copilot latency is added later         |
| Character error rate | normalized Levenshtein distance / expected characters | Preserve place-name and mixed-language failures separately     |
| Cost snapshot        | metered seconds/characters × retrieved provider price | Experimental estimate in source currency, not a finance ledger |

Issue #279's investor prototype target is end-to-first-audio below five seconds median for the full
STT→Copilot→TTS path. #280 cannot prove that full target because it excludes Copilot. Its report must
leave enough latency budget for the one-model Copilot call and must publish p95 as well as median.

## Current observations

- The code-level contract validates the 20-case manifest, WAV format, 640-byte frames, deterministic
  Wi-Fi profiles, transcript error rate, p50/p95 aggregation, fixed-point experimental prices, and
  credential redaction.
- DashScope request builders cover `run-task`, binary PCM, `continue-task`, `finish-task`, final
  transcript collection, streamed binary TTS, timeout, empty result, and disconnect behavior.
- Price snapshots are registered by exact provider/model. An unknown model is rejected rather than
  silently assigned a stale price.
- Local provider environment names are absent. No STT response, TTS audio, real latency, recognition
  quality, or billable usage has been observed.

These are structural and simulation facts. They are not proof that DashScope, Tencent, or Azure is
usable for the investor demo.

## Synthesis, dissent, and confidence

**Provisional recommendation:** measure DashScope first because the documented PCM/WebSocket shape
matches the device audio contract and one account can cover both edges. Keep Tencent as the preferred
China-hosted exit candidate and Azure as the international diversity candidate. Confidence is low
until OA-016 produces comparative real runs.

**Unresolved transport choice:** `buffer_on_commit` minimizes connection duration and makes PTT
cancellation simpler; `upstream_streaming` may reduce post-release latency but exposes weak-Wi-Fi
disconnect and partial-audio complexity. The architecture must not select either by intuition. #281
may consume only the measured delta and demo-network observation.

## Deviation classification

- D1: the original Cat.1 assumption was replaced by the verified Wi-Fi-only hardware fact.
- D2: speech audio crosses an external processor and real credentials/billing are required.
- D3: freezing a production provider, data region, or public hardware claim requires architecture and
  operator acceptance after the real evidence set.

## Recommended control actions

1. Complete OA-016 without placing credentials or audio in the repository.
2. Run and sanitize the P01 matrix; attach only the allowlisted report and summary to Issue #280.
3. Repeat the fixed subset against one exit candidate.
4. Ask the architecture reviewer to decide provider, upload mode, and exit rule from measured results.
5. Only then unlock #281 and #283. Production adapters remain owned by #287.

## Unknowns and review date

- Demo city, venue Wi-Fi, provider data region, account retention settings, and consented speakers.
- Real bilingual/place-name quality and provider-side audio retention behavior.
- Full-path latency after the Copilot call and sentence-segmented TTS required by #283.
- Whether the chosen provider exposes enough usage metadata for the future #298 multi-meter ledger.

Review immediately after the first real 20-sample report or by 2026-08-03, whichever comes first.
