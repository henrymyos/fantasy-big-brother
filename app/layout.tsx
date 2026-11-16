import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Draft houseguests, track a custom scoring system, and follow eliminations all season long.";

export const metadata: Metadata = {
  title: "Fantasy Big Brother",
  description,
  appleWebApp: {
    capable: true,
    title: "Fantasy BB",
    statusBarStyle: "black-translucent",
  },
  // Link previews (iMessage, Slack, Discord): text card, no image.
  openGraph: { title: "Fantasy Big Brother", description, siteName: "Fantasy Big Brother", type: "website" },
  twitter: { card: "summary", title: "Fantasy Big Brother", description },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
