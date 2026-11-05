import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MainHeader from "./components/MainHeader";

// F14: expose Inter as a CSS variable so tailwind's font-sans can use it.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Rifas Mtz",
  description: "Rifas Mtz — compra tus boletos en línea",
  // Item 20 (2026-10-25): iOS PWA web-push requires a web app manifest.
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/faviconApp.ico" type="image/x-icon" />
        {/* Dark mode boot (2026-11-05): applies the stored theme class before
            first paint so there is no light→dark flash. Keep the key in sync
            with app/components/theme.ts. suppressHydrationWarning above is
            required because this script mutates <html> before React hydrates. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('rmtz-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();",
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <header>
          <MainHeader />
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
