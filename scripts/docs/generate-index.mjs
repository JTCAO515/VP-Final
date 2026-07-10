import fs from "node:fs";

import { indexPath, readManifest, renderIndex } from "./lib.mjs";

const manifest = readManifest();
fs.writeFileSync(indexPath, renderIndex(manifest));
console.log("Generated docs/INDEX.md");
