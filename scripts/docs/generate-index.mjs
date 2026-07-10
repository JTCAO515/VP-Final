import fs from "node:fs";

import { indexPath, readHandoff, readManifest, renderIndex } from "./lib.mjs";

const manifest = readManifest();
const handoff = readHandoff();
fs.writeFileSync(indexPath, renderIndex(manifest, handoff));
console.log("Generated docs/INDEX.md");
