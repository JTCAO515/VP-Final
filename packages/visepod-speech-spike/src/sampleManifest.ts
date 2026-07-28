import type { SpeechBenchmarkSample } from "./types.js";

export const speechBenchmarkSamples: readonly SpeechBenchmarkSample[] = [
  {
    id: "en-first-timer-01",
    locale: "en",
    category: "first_timer",
    expectedText: "Where is the nearest metro station?",
    audioFile: "en-first-timer-01.wav",
  },
  {
    id: "en-payment-01",
    locale: "en",
    category: "payment",
    expectedText: "Can I pay with an international Visa card?",
    audioFile: "en-payment-01.wav",
  },
  {
    id: "en-transport-01",
    locale: "en",
    category: "transport",
    expectedText: "Please take me to Shanghai Hongqiao Railway Station.",
    audioFile: "en-transport-01.wav",
  },
  {
    id: "en-transport-02",
    locale: "en",
    category: "transport",
    expectedText: "I need a taxi to Pudong Airport Terminal 2.",
    audioFile: "en-transport-02.wav",
  },
  {
    id: "en-place-01",
    locale: "en",
    category: "place_name",
    expectedText: "How do I get from Yu Garden to the Bund?",
    audioFile: "en-place-01.wav",
  },
  {
    id: "en-place-02",
    locale: "en",
    category: "place_name",
    expectedText: "Is the Forbidden City open on Monday?",
    audioFile: "en-place-02.wav",
  },
  {
    id: "en-numbers-01",
    locale: "en",
    category: "numbers",
    expectedText: "My train is G1234 at 3:50 p.m.",
    audioFile: "en-numbers-01.wav",
  },
  {
    id: "en-recovery-01",
    locale: "en",
    category: "recovery",
    expectedText: "The payment failed. What should I try next?",
    audioFile: "en-recovery-01.wav",
  },
  {
    id: "zh-transport-01",
    locale: "zh",
    category: "transport",
    expectedText: "请带我去上海虹桥火车站。",
    audioFile: "zh-transport-01.wav",
  },
  {
    id: "zh-food-01",
    locale: "zh",
    category: "food_safety",
    expectedText: "这道菜里面有花生吗？",
    audioFile: "zh-food-01.wav",
  },
  {
    id: "zh-payment-01",
    locale: "zh",
    category: "payment",
    expectedText: "这里可以刷外国信用卡吗？",
    audioFile: "zh-payment-01.wav",
  },
  {
    id: "zh-place-01",
    locale: "zh",
    category: "place_name",
    expectedText: "我想去成都武侯祠。",
    audioFile: "zh-place-01.wav",
  },
  {
    id: "zh-place-02",
    locale: "zh",
    category: "place_name",
    expectedText: "请问兵马俑怎么走？",
    audioFile: "zh-place-02.wav",
  },
  {
    id: "zh-numbers-01",
    locale: "zh",
    category: "numbers",
    expectedText: "我的预约时间是下午三点半。",
    audioFile: "zh-numbers-01.wav",
  },
  {
    id: "mixed-transport-01",
    locale: "mixed",
    category: "transport",
    expectedText: "Please take me to 北京南站。",
    audioFile: "mixed-transport-01.wav",
  },
  {
    id: "mixed-hotel-01",
    locale: "mixed",
    category: "hotel_name",
    expectedText: "I am staying at 上海外滩华尔道夫酒店。",
    audioFile: "mixed-hotel-01.wav",
  },
  {
    id: "mixed-food-01",
    locale: "mixed",
    category: "food_safety",
    expectedText: "I cannot eat peanuts，请不要放花生。",
    audioFile: "mixed-food-01.wav",
  },
  {
    id: "mixed-payment-01",
    locale: "mixed",
    category: "payment",
    expectedText: "My Alipay says payment failed，可以用现金吗？",
    audioFile: "mixed-payment-01.wav",
  },
  {
    id: "mixed-place-01",
    locale: "mixed",
    category: "place_name",
    expectedText: "Is 西安城墙 near the metro?",
    audioFile: "mixed-place-01.wav",
  },
  {
    id: "mixed-recovery-01",
    locale: "mixed",
    category: "recovery",
    expectedText: "The Wi-Fi is not working，请帮我连接网络。",
    audioFile: "mixed-recovery-01.wav",
  },
];

export function validateSpeechBenchmarkSamples(samples: readonly SpeechBenchmarkSample[]): void {
  if (samples.length < 20) {
    throw new Error("The speech spike requires at least 20 fixed samples.");
  }

  const ids = new Set<string>();
  const files = new Set<string>();
  for (const sample of samples) {
    if (!sample.id || !sample.expectedText.trim() || !sample.audioFile.endsWith(".wav")) {
      throw new Error(`Invalid speech sample: ${sample.id || "<missing id>"}`);
    }
    if (ids.has(sample.id)) {
      throw new Error(`Duplicate speech sample id: ${sample.id}`);
    }
    if (files.has(sample.audioFile)) {
      throw new Error(`Duplicate speech fixture path: ${sample.audioFile}`);
    }
    ids.add(sample.id);
    files.add(sample.audioFile);
  }
}
