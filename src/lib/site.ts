export const siteConfig = {
  name: "Lattice",
  title: "Lattice",
  description: "A laser reflection puzzle game.",
};

export const productionSiteUrl = "https://playlattice.vercel.app";

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NODE_ENV === "production") {
    return productionSiteUrl;
  }
  return "http://localhost:3000";
}
