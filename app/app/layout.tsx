import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polybot",
  description: "Polymarket copy-bet tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        <nav className="border-b border-zinc-800 bg-zinc-900/60">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm">
            <span className="font-semibold">Polybot</span>
            <Link href="/signals" className="text-zinc-400 hover:text-zinc-100">
              Signals
            </Link>
            <Link href="/wallets" className="text-zinc-400 hover:text-zinc-100">
              Wallets
            </Link>
            <Link href="/leaderboard" className="text-zinc-400 hover:text-zinc-100">
              Leaderboard
            </Link>
          </div>
        </nav>
        <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
      </body>
    </html>
  );
}
