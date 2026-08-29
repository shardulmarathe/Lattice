export const siteConfig = {
  name: "Lattice",
  title: "Lattice: Laser Reflection Puzzle Game",
  description:
    "Route mirrors to guide a laser through numbered tiles in order. A minimalist daily logic puzzle with a sleek black, white, and red aesthetic.",
};

export const productionSiteUrl = "https://playlattice.vercel.app";

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  // Use canonical domain on production, preview URLs require Vercel auth
  // and break Open Graph image fetching for social crawlers.
  if (process.env.VERCEL_ENV === "production") {
    return productionSiteUrl;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
