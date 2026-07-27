"use client";

import { useEffect } from "react";
import { captureClientTelemetry } from "../../lib/clientTelemetry";

export function GuideTelemetry({ slug }: { slug: string }) {
  useEffect(() => {
    captureClientTelemetry({
      action: "guide_viewed",
      entity_type: "guide",
      entity_id: slug,
      props_jsonb: {},
    });
  }, [slug]);

  return null;
}
