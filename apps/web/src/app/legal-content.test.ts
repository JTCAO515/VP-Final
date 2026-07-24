import { describe, expect, it } from "vitest";
import { LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS, LEGAL_EFFECTIVE_DATE } from "./legal-content";

const publicCopy = JSON.stringify(LEGAL_DOCUMENTS);

describe("public legal content", () => {
  it("publishes the five accepted trust documents with the approved operator baseline", () => {
    expect(Object.keys(LEGAL_DOCUMENTS)).toEqual([
      "privacy",
      "terms",
      "affiliate",
      "human-help",
      "emergency",
    ]);
    expect(LEGAL_EFFECTIVE_DATE).toBe("July 24, 2026");
    expect(LEGAL_CONTACT_EMAIL).toBe("admin@go2china.space");
    expect(publicCopy).toContain("广州创竞科技有限公司");
    expect(publicCopy).toContain("aged 16 or older");
  });

  it("records the approved access and deletion process without inventing self-service controls", () => {
    const privacy = JSON.stringify(LEGAL_DOCUMENTS.privacy);

    expect(privacy).toContain("VisePanda Data Deletion Request");
    expect(privacy).toContain("within 7 calendar days");
    expect(privacy).toContain("within 30 calendar days");
    expect(privacy).toContain("minimum additional information needed to verify identity");
  });

  it("names only the approved current processors", () => {
    for (const processor of [
      "Vercel",
      "Supabase",
      "Upstash",
      "DashScope/Qwen",
      "DeepSeek",
      "Moonshot/Kimi",
      "Zhipu/GLM",
    ]) {
      expect(publicCopy).toContain(processor);
    }
  });

  it("keeps the controlled-preview Human Help limits exact", () => {
    const humanHelp = JSON.stringify(LEGAL_DOCUMENTS["human-help"]);

    expect(humanHelp).toContain("Shanghai requests only");
    expect(humanHelp).toContain("English traveler requests");
    expect(humanHelp).toContain("09:00–21:00 China Standard Time");
    expect(humanHelp).toContain("at most five new requests");
    expect(humanHelp).toContain("best-effort review");
    expect(humanHelp).toContain("no guaranteed response or service-level agreement");
    expect(humanHelp).toContain("controlled preview has no payment");
    expect(humanHelp).toContain("not emergency");
  });

  it("publishes the verified mainland emergency numbers and official source", () => {
    const emergency = JSON.stringify(LEGAL_DOCUMENTS.emergency);

    expect(emergency).toContain("Police: 110");
    expect(emergency).toContain("Fire: 119");
    expect(emergency).toContain("Medical emergency: 120");
    expect(emergency).toContain("Traffic accident police: 122");
    expect(emergency).toContain("english.shanghai.gov.cn/en-EmergencyNumbers");
  });

  it("does not publish unverified retention, jurisdiction, payment, or fulfillment promises", () => {
    for (const forbiddenClaim of [
      "400 days",
      "self-service deletion",
      "exclusive jurisdiction",
      "guaranteed response time",
      "we accept payment",
      "refunds are",
    ]) {
      expect(publicCopy.toLowerCase()).not.toContain(forbiddenClaim);
    }
  });
});
