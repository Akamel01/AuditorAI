import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuditorAI — Road Safety Auditor",
  description:
    "AI-assisted, evidence-grounded road safety auditing across International, UK, USA, Canada and UAE practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
