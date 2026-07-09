import { describe, expect, it } from "vitest";
import {
  agentRuns,
  knowledgeGaps,
  poiCommercialLinks,
  poiFacts,
  pois,
  toolCalls,
  tripEvents,
  trips,
  users,
} from "./schema.js";

describe("database schema", () => {
  it("maps the v1 auth/trip tables", () => {
    expect(users.id.name).toBe("id");
    expect(trips.owner.name).toBe("owner");
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
    expect(knowledgeGaps.questionPattern.name).toBe("question_pattern");
    expect(poiCommercialLinks.poiId.name).toBe("poi_id");
  });
});
