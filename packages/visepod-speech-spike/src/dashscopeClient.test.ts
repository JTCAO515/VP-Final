import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { type RawData, type WebSocket, WebSocketServer } from "ws";

import { runDashScopeSpeechRound } from "./dashscopeClient.js";
import { speechBenchmarkSamples } from "./sampleManifest.js";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((action) => action()));
});

function createWave(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16_000, 24);
  header.writeUInt32LE(32_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function temporaryFixture(contents: Buffer): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "visepod-speech-"));
  const fixture = path.join(directory, "fixture.wav");
  await writeFile(fixture, contents, { mode: 0o600 });
  cleanup.push(() => rm(directory, { force: true, recursive: true }));
  return fixture;
}

async function localServer(
  onConnection?: (socket: WebSocket) => void,
): Promise<{ url: string; server: WebSocketServer }> {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  if (onConnection) {
    server.on("connection", onConnection);
  }
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) {
    throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
  }
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        for (const client of server.clients) {
          client.terminate();
        }
        server.close(() => resolve());
      }),
  );
  return { url: `ws://127.0.0.1:${address.port}`, server };
}

function baseOptions(fixturePath: string, websocketUrl: string) {
  return {
    sample: speechBenchmarkSamples[0]!,
    fixturePath,
    apiKey: "test-provider-secret",
    websocketUrl,
    region: "cn-beijing",
    sttModel: "paraformer-realtime-v2",
    ttsModel: "cosyvoice-v3.5-flash",
    ttsVoice: "test-voice",
    networkProfile: {
      id: "wifi_good",
      chunkDelayMs: 0,
      jitterMs: 0,
      packetLossPercent: 0,
    },
    uploadMode: "buffer_on_commit" as const,
    timeoutMs: 30,
  };
}

describe("DashScope spike failure boundaries", () => {
  it("fails invalid audio before opening a provider connection", async () => {
    const fixturePath = await temporaryFixture(Buffer.from("not a wave"));
    const observation = await runDashScopeSpeechRound(baseOptions(fixturePath, "ws://127.0.0.1:1"));
    expect(observation).toMatchObject({
      status: "failed",
      failureCode: "SPEECH_SPIKE_FAILED",
    });
  });

  it("returns a bounded timeout without exposing the provider key", async () => {
    const fixturePath = await temporaryFixture(createWave(Buffer.alloc(640)));
    const { url } = await localServer();
    const observation = await runDashScopeSpeechRound(baseOptions(fixturePath, url));
    expect(observation).toMatchObject({
      status: "failed",
      failureCode: "SPEECH_PROVIDER_TIMEOUT",
    });
    expect(observation.failureMessage).not.toContain("test-provider-secret");
  });

  it("records a deterministic simulated network disconnect as failure", async () => {
    const fixturePath = await temporaryFixture(createWave(Buffer.alloc(1_280)));
    const { url } = await localServer((socket) => {
      socket.on("message", (data: RawData, isBinary: boolean) => {
        if (isBinary) return;
        const message = JSON.parse(data.toString()) as { header: { task_id: string } };
        socket.send(
          JSON.stringify({
            header: { task_id: message.header.task_id, event: "task-started" },
          }),
        );
      });
    });
    const options = baseOptions(fixturePath, url);
    const observation = await runDashScopeSpeechRound({
      ...options,
      // Give the CI event loop enough room to observe task-started; the
      // disconnect itself is still driven deterministically by chunk index.
      timeoutMs: 500,
      networkProfile: { ...options.networkProfile, id: "wifi_disconnect", disconnectAfterChunk: 1 },
    });
    expect(observation).toMatchObject({
      status: "failed",
      failureCode: "SIMULATED_NETWORK_DISCONNECT",
      networkEvidence: "client_simulation",
    });
  });
});
