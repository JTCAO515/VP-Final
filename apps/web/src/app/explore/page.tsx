import type { Poi } from "@visepanda/domain";
import { getServerCaller } from "../api/_server";
import { ExploreView } from "./view";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const result = await loadExplorePois();
  return <ExploreView {...result} asOf={new Date().toISOString()} />;
}

async function loadExplorePois(): Promise<
  { pois: Poi[]; availability: "ready" } | { pois: []; availability: "unavailable" }
> {
  try {
    return { pois: await getServerCaller().knowledge.listPois(), availability: "ready" };
  } catch {
    return { pois: [], availability: "unavailable" };
  }
}
