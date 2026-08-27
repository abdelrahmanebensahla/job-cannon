import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";

import { AppHeader } from "@/components/AppHeader";
import { SubscriptionProvider } from "@/components/SubscriptionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { appUrl } from "@/lib/app-url";
import { getSubscriptionView } from "@/lib/subscription";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  // metadataBase makes the relative OG/Twitter image URLs absolute. Without
  // it Next warns at build time and social scrapers get a relative path.
  metadataBase: new URL(appUrl()),
  title: "Job Cannon — AI startup jobs, matched to your resume",
  description:
    "Drop your resume. Get 10 startup matches in your inbox every weekday at 8am ET.",
  openGraph: {
    type: "website",
    siteName: "Job Cannon",
    title: "Job Cannon — AI startup jobs, matched to your resume",
    description:
      "Drop your resume. Get 10 startup matches in your inbox every weekday at 8am ET.",
    url: appUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Job Cannon — AI startup jobs, matched to your resume",
    description:
      "Drop your resume. Get 10 startup matches in your inbox every weekday at 8am ET.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read subscription view once per request, server-side, and hand it to
  // <SubscriptionProvider /> so client islands like <SubscriptionBadge />
  // don't re-fetch. See HANDOFF.md for the single-source-of-truth contract.
  const subscription = await getSubscriptionView();

  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider>
            <SubscriptionProvider value={subscription}>
              <AppHeader />
              <div className="flex flex-1 flex-col">{children}</div>
              <Analytics />
            </SubscriptionProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
