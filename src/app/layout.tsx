import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const plexSans = localFont({
  src: "./fonts/plex-sans-var.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plex-mono",
});

const newsreader = localFont({
  src: "./fonts/newsreader-italic-var.woff2",
  weight: "400 500",
  style: "italic",
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: "AuditorAI — Road Safety Auditor",
  description:
    "AI-assisted, evidence-grounded road safety auditing across International, UK, USA, Canada and UAE practice.",
};

const themeBootstrap = `try{var t=localStorage.getItem("auditorai.theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable} min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
