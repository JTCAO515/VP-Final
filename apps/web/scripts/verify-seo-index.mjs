import { INITIAL_POIS, deriveSeoPageMatrix } from "@visepanda/domain";

// CI build guard for the checked-in knowledge fixture. Runtime consumers run the same matrix against
// the durable knowledge service before publishing any URL.
const pages = deriveSeoPageMatrix(INITIAL_POIS).pages;
const paths = pages.map((page) => page.canonicalPath);
if (new Set(paths).size !== paths.length) {
  throw new Error("Duplicate canonical SEO path in the checked-in knowledge fixture.");
}

console.log(`SEO index fixture valid: ${pages.length} evidence-gated canonical paths`);
