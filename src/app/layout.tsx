import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SoundProvider from "@/components/Sound/SoundProvider";
import { getSiteUrl, siteConfig } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

// Platforms cache og:image per-URL; versioning with the deploy SHA makes new
// shares fetch the latest screenshot instead of a stale cached one.
const ogImage = `/og-home.png?v=${(process.env.VERCEL_GIT_COMMIT_SHA ?? "dev").slice(0, 8)}`;

// og:image is a screenshot of the homepage, regenerated after every push by
// .github/workflows/og-refresh.yml -> public/og-home.png (committed by CI;
// headless Chrome can't run in Vercel's build container).
export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteUrl,
    siteName: siteConfig.name,
    type: "website",
    locale: "en_US",
    images: [{ url: ogImage, width: 1200, height: 630, alt: siteConfig.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Sits above the route boundary so the victory sting can start on the
            board in /play and finish on the checkmark in /complete. */}
        <SoundProvider>{children}</SoundProvider>
        <Analytics />
      </body>
    </html>
  );
}
