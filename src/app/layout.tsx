import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

// Pretendard — clean neutral sans with full Korean (Hangul) coverage.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
  fallback: ["Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrandSafe — Ad Compliance Review",
  description: "Agentic compliance & brand-safety review for social video ads.",
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-muted/30">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
