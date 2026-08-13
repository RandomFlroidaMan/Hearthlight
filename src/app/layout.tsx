import type { Metadata } from "next";
import { Cinzel, Lora, Geist_Mono } from "next/font/google";
import "./globals.css";

/** Fantasy display face — titles, act badges, primary buttons. Evokes
 * carved-stone/old-book lettering rather than a modern app. */
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

/** Body/prose face — a warm literary serif instead of a geometric sans,
 * for storybook feel, while staying easy to read aloud at a glance. */
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hearthlight",
  description: "A family tabletop storytelling app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${lora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
