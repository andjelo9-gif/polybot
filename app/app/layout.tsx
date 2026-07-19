import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Polybot",
  description: "Polymarket copy-bet tracker",
};

const NAV = [
  { href: "/signals", label: "Signals" },
  { href: "/wallets", label: "Wallets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", geist.variable, geistMono.variable)}
    >
      <body className="min-h-full bg-background text-foreground">
        <nav className="border-b">
          <div className="mx-auto flex max-w-5xl items-baseline gap-6 px-4 py-3">
            <span className="font-mono text-sm font-semibold tracking-[0.2em] uppercase">
              Polybot
            </span>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-mono text-xs tracking-widest uppercase text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
