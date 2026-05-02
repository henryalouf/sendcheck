import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const TITLE = "SendCheck — Should you actually send this?";
const DESCRIPTION =
  "A second opinion before you hit send. Paste any message — email, Slack, text — and get an honest read on tone, power dynamics, and how it'll land. Free, no signup.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sendcheck.app"),
  title: {
    default: TITLE,
    template: "%s · SendCheck",
  },
  description: DESCRIPTION,
  applicationName: "SendCheck",
  keywords: [
    "second opinion",
    "before sending",
    "email coach",
    "tone check",
    "AI message review",
    "communications coach",
  ],
  authors: [{ name: "SendCheck" }],
  openGraph: {
    title: TITLE,
    description:
      "Catch the message you'd regret. Tone reading, power dynamics, three rewrites, and a verdict — in 5 seconds.",
    type: "website",
    siteName: "SendCheck",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description:
      "Catch the message you'd regret. Tone reading, power dynamics, three rewrites, and a verdict — in 5 seconds.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
