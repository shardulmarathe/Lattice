import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

// Coded OpenGraph card — rendered from siteConfig below, never a screenshot,
// so it never drifts from the live game.
export const alt = "Lattice — a laser reflection puzzle game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Full glyph set so Google's font subsetting includes every character we render.
const GLYPHS =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?/&()@·—–";

// satori only supports ttf/otf/woff (not woff2); requesting without a browser
// UA makes Google serve truetype. Falls back to the built-in font on failure.
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  const title = "LATTICE";
  const tagline = "Laser Reflection Puzzle";
  const [bold, mono] = await Promise.all([
    loadFont("Geist", 700, GLYPHS),
    loadFont("Geist Mono", 500, GLYPHS),
  ]);

  const fonts = [
    ...(bold ? [{ name: "Geist", data: bold, weight: 700 as const, style: "normal" as const }] : []),
    ...(mono ? [{ name: "GeistMono", data: mono, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000000",
          padding: "72px 84px",
          position: "relative",
        }}
      >
        {/* faint grid */}
        <div
          style={{
            position: "absolute", inset: 0, display: "flex",
            backgroundImage:
              "linear-gradient(#161616 1px, transparent 1px), linear-gradient(90deg, #161616 1px, transparent 1px)",
            backgroundSize: "84px 84px",
            opacity: 0.6,
          }}
        />
        {/* laser beam hitting a mirror */}
        <div style={{ position: "absolute", right: 84, top: 150, width: 3, height: 330, background: "#ff2d2d", boxShadow: "0 0 24px #ff2d2d", display: "flex" }} />
        <div style={{ position: "absolute", right: 84, top: 480, width: 300, height: 3, background: "#ff2d2d", boxShadow: "0 0 24px #ff2d2d", display: "flex" }} />
        <div style={{ position: "absolute", right: 74, top: 470, width: 24, height: 24, border: "3px solid #ffffff", transform: "rotate(45deg)", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, background: "#ff2d2d", boxShadow: "0 0 18px #ff2d2d", display: "flex" }} />
          <div style={{ fontFamily: "GeistMono", fontSize: 22, letterSpacing: 8, color: "#888888", display: "flex" }}>
            DAILY LOGIC PUZZLE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ fontFamily: "Geist", fontSize: 176, lineHeight: 0.9, letterSpacing: 6, color: "#ffffff", display: "flex" }}>
            {title}
          </div>
          <div style={{ fontFamily: "GeistMono", fontSize: 40, color: "#ff2d2d", letterSpacing: 2, display: "flex" }}>
            {tagline}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #222222", paddingTop: 22 }}>
          <div style={{ fontFamily: "GeistMono", fontSize: 24, color: "#888888", maxWidth: 720, display: "flex" }}>
            Route mirrors to guide a laser through numbered tiles in order.
          </div>
          <div style={{ fontFamily: "GeistMono", fontSize: 22, color: "#ffffff", display: "flex" }}>playlattice.vercel.app</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
