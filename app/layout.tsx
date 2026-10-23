import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MainHeader from "./components/MainHeader";

// F14: expose Inter as a CSS variable so tailwind's font-sans can use it.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Rifas Mtz",
  description: "Rifas Mtz — compra tus boletos en línea",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/faviconApp.ico" type="image/x-icon" />
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
