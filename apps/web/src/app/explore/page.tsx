import { INITIAL_POIS } from "@visepanda/domain";
import { ExploreView } from "./view";

export default function ExplorePage() {
  return <ExploreView pois={INITIAL_POIS} />;
}
