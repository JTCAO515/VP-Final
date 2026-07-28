const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /bearer\s+[a-z0-9._~-]+/giu,
  /\bsk-[a-z0-9._-]+\b/giu,
  /\bsb_secret_[a-z0-9_-]+\b/giu,
  /(?:api[-_ ]?key|cookie|signature|password)\s*[:=]\s*[^\s,;]+/giu,
  /(?:\/Users\/|\/home\/)[^\s'"`]+/gu,
  /[a-z]:\\Users\\[^\s'"`]+/giu,
];

export class SpeechSpikeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(sanitizeDiagnostic(message));
    this.name = "SpeechSpikeError";
  }
}

export function sanitizeDiagnostic(value: unknown, secrets: readonly string[] = []): string {
  let message = value instanceof Error ? value.message : String(value);
  for (const secret of secrets.filter(Boolean)) {
    message = message.replaceAll(secret, "[REDACTED]");
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, "[REDACTED]");
  }
  return message.slice(0, 500);
}

export interface DashScopeExperimentConfig {
  apiKey: string;
  websocketUrl: string;
  region: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
}

export function loadDashScopeExperimentConfig(
  env: NodeJS.ProcessEnv = process.env,
): DashScopeExperimentConfig {
  const apiKey = env.DASHSCOPE_API_KEY?.trim();
  const websocketUrl = env.VISEPOD_DASHSCOPE_WEBSOCKET_URL?.trim();
  const region = env.VISEPOD_SPEECH_REGION?.trim();
  const sttModel = env.VISEPOD_STT_MODEL?.trim();
  const ttsModel = env.VISEPOD_TTS_MODEL?.trim();
  const ttsVoice = env.VISEPOD_TTS_VOICE?.trim();

  const missing = [
    ["DASHSCOPE_API_KEY", apiKey],
    ["VISEPOD_DASHSCOPE_WEBSOCKET_URL", websocketUrl],
    ["VISEPOD_SPEECH_REGION", region],
    ["VISEPOD_STT_MODEL", sttModel],
    ["VISEPOD_TTS_MODEL", ttsModel],
    ["VISEPOD_TTS_VOICE", ttsVoice],
  ]
    .filter((entry) => !entry[1])
    .map((entry) => entry[0]);

  if (missing.length > 0) {
    throw new SpeechSpikeError(
      "SPEECH_PROVIDER_NOT_CONFIGURED",
      `Missing required environment names: ${missing.join(", ")}`,
    );
  }

  return {
    apiKey: apiKey!,
    websocketUrl: websocketUrl!,
    region: region!,
    sttModel: sttModel!,
    ttsModel: ttsModel!,
    ttsVoice: ttsVoice!,
  };
}
