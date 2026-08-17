const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="VisePanda">
  <rect width="64" height="64" rx="14" fill="#b51f2b"/>
  <path d="M17 17h11l4 19 4-19h11L38 47H26L17 17Z" fill="#d4af37"/>
</svg>`;

export function GET() {
  return new Response(FAVICON_SVG, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
