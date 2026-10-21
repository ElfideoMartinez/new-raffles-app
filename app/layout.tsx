import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import MainHeader from "./components/MainHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rifas Mtz",
  description: "Rifas Mtz — compra tus boletos en linea",
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
      <body className={inter.className}>
        <header>
          <MainHeader />
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
