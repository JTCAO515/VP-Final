import { describe, expect, it } from "vitest";
import {
  displayHumanTaskEvidenceKind,
  displayHumanTaskKind,
  displayLifecycleValue,
  displayOpsRole,
  displayPoiCategory,
} from "./presentation";

describe("Ops Chinese presentation labels", () => {
  it("localizes roles, categories, task types, and lifecycle values without changing stored values", () => {
    expect(displayOpsRole("admin")).toBe("运营管理员");
    expect(displayPoiCategory("attraction")).toBe("景点");
    expect(displayHumanTaskKind("transport_help")).toBe("交通协助");
    expect(displayLifecycleValue("payment_pending")).toBe("待支付");
    expect(displayLifecycleValue("fulfilling")).toBe("处理中");
    expect(displayHumanTaskEvidenceKind("transcript_excerpt")).toBe("已脱敏的对话摘录");
  });
});
