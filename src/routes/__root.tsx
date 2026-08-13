import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "../index.css";
import "../themes.css";
import "../neobrutalism-redesign.css";
import "../donghua-pages.css";
import "../anti-ads.css";
import "../mobile-optimizations.css";
import "../polish.css";
import "../home-neobrutalism.css";
import "../detail-neobrutalism.css";
import "../App.css";
import "../responsive-fixes.css";
import "../perf-scroll.css";
import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider } from "../contexts/AuthContext";
import Header from "../components/Header";

import InstallBanner from "../components/InstallBanner";
import ErrorBoundary from "../components/ErrorBoundary";
import { reportLovableError } from "../lib/lovable-error-reporting";


function NotFoundComponent() {
  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-badge" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" />
            <line x1="13.5" y1="8.5" x2="8.5" y2="13.5" />
          </svg>
        </div>
        <p className="notfound-eyebrow">Error 404</p>
        <h1 className="notfound-title">Halaman Tidak Ditemukan</h1>
        <p className="notfound-desc">
          Wah, sepertinya halaman yang kamu cari sudah dipindahkan, dihapus, atau memang belum pernah ada. Coba periksa lagi alamatnya, atau kembali ke salah satu halaman di bawah ini.
        </p>
        <div className="notfound-actions">
          <Link to="/" className="btn btn-primary">Ke Beranda</Link>
          <Link to="/search" className="btn btn-secondary">Cari Judul</Link>
        </div>
        <nav className="notfound-links" aria-label="Tautan cepat">
          <Link to="/ongoing">Anime Ongoing</Link>
          <span aria-hidden="true">•</span>
          <Link to="/komik">Komik</Link>
          <span aria-hidden="true">•</span>
          <Link to="/schedule">Jadwal Rilis</Link>
        </nav>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "FiveNime - Streaming Anime, Donghua & Komik Sub Indo" },
      {
        name: "description",
        content:
          "FiveNime: nonton anime dan donghua sub Indo gratis, plus baca komik terbaru. Update setiap hari.",
      },
      { name: "theme-color", content: "#1D4ED8" },
      { property: "og:title", content: "FiveNime - Streaming Anime & Donghua Sub Indo" },
      {
        property: "og:description",
        content: "Nonton anime & donghua sub Indo gratis, baca komik terbaru. Update tiap hari.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      // Video & poster anime custom disajikan dari Firebase Storage —
      // preconnect memangkas waktu handshake sebelum buffer video mulai.
      { rel: "preconnect", href: "https://firebasestorage.googleapis.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://firebasestorage.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Outfit:wght@500;700;900&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icon-16.png" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <a href="#main-content" className="skip-link">
            Lewati ke konten
          </a>
          <div className="app">
            <Header />
            <InstallBanner />
            <main id="main-content">
              <ErrorBoundary>
                {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                <Outlet />
              </ErrorBoundary>
            </main>
          </div>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
        }
