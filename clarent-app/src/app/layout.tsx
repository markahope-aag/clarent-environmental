import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import Link from 'next/link';
import { detectPortal } from '@/lib/portal';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Clarent Environmental',
  description: 'Hazardous waste disposal and compliance for small quantity generators.',
};

const PORTAL_LABELS = {
  generator: 'Generator portal',
  vendor: 'Vendor portal',
  ops: 'Ops console',
} as const;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const portal = detectPortal(hdrs.get('host'));
  const portalLabel = portal ? PORTAL_LABELS[portal] : null;

  return (
    <ClerkProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col">
          <header className="flex items-center justify-between border-b border-black/10 px-6 py-4">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="text-sm font-semibold tracking-tight">Clarent Environmental</span>
              {portalLabel && (
                <span className="text-[10px] font-medium tracking-[0.14em] text-zinc-400 uppercase">
                  {portalLabel}
                </span>
              )}
            </Link>
            <nav className="flex items-center gap-4">
              {portal === 'generator' && (
                <Show when="signed-in">
                  <Link
                    href="/jobs"
                    className="text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900"
                  >
                    Your requests
                  </Link>
                </Show>
              )}
              {portal === 'vendor' && (
                <Show when="signed-in">
                  <Link
                    href="/jobs"
                    className="text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900"
                  >
                    Your queue
                  </Link>
                </Show>
              )}
              {portal === 'ops' && (
                <Link
                  href="/jobs"
                  className="text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900"
                >
                  Jobs
                </Link>
              )}
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
