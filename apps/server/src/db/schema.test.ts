import { describe, expect, it } from "vitest";
import {
  agentRuns,
  humanTasks,
  knowledgeGaps,
  outboundClicks,
  partners,
  poiCommercialLinks,
  poiFacts,
  pois,
  telemetryEvents,
  toolCalls,
  tripEvents,
  trips,
  users,
} from "./schema.js";

describe("database schema", () => {
  it("maps the v1 auth/trip tables", () => {
    expect(users.id.name).toBe("id");
    expect(trips.owner.name).toBe("owner");
    expect(trips.anonId.name).toBe("anon_id");
    expect(trips.shareToken.name).toBe("share_token");
    expect(tripEvents.tripId.name).toBe("trip_id");
  });

  it("maps the agent trace tables", () => {
    expect(agentRuns.userId.name).toBe("user_id");
    expect(agentRuns.costUsd.name).toBe("cost_usd");
    expect(toolCalls.agentRunId.name).toBe("agent_run_id");
    expect(toolCalls.toolName.name).toBe("tool_name");
  });

  it("maps the knowledge tables", () => {
    expect(pois.nameEn.name).toBe("name_en");
    expect(poiFacts.factType.name).toBe("fact_type");
    expect(poiFacts.status.name).toBe("status");
    expect(knowledgeGaps.questionPattern.name).toBe("question_pattern");
    expect(knowledgeGaps.resolvedAt.name).toBe("resolved_at");
    expect(poiCommercialLinks.poiId.name).toBe("poi_id");
  });

  it("maps the outbound commerce tables", () => {
    expect(partners.trackingParam.name).toBe("tracking_param");
    expect(outboundClicks.targetUrl.name).toBe("target_url");
  });

  it("maps the telemetry events table", () => {
    expect(telemetryEvents.anonId.name).toBe("anon_id");
    expect(telemetryEvents.propsJsonb.name).toBe("props_jsonb");
  });

  it("maps the human task quote fields", () => {
    expect(humanTasks.status.name).toBe("status");
    expect(humanTasks.priceUsd.name).toBe("price_usd");
    expect(humanTasks.paymentLink.name).toBe("payment_link");
  });
});
