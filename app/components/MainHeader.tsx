"use client";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import CartButton from "./CartButton";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import HamburgerMenu from "./HamburgerMenu";


const MainHeader = () => {

  const [menuOpen, setMenuOpen] = useState(false);

  const router = useRouter();
  const pathName = usePathname();
  const isMain = pathName === '/' || pathName === '/admin/dashboard' || pathName === '/checkout/success';
  const isCartIconAvailable = pathName === '/checkout/success';
  //console.log(pathName);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathName]);

  return (
    <div className="relative">
      <div className="sticky top-0 z-40 bg-gradient-to-b from-brand-500 to-accent-400 text-ink-900 shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4">
          {pathName === '/' ? (
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Image src="/burgerbutton.png" alt="" width={22} height={22} className="filter invert" />
            </button>
          ) : (
            <button
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25 ${isMain ? 'hidden' : ''}`}
              aria-label="Regresar"
              onClick={() => {
                router.back();
              }}
            >
              <Image src="/arrowBack.png" alt="" width={22} height={22} className="filter invert" />
            </button>
          )}

          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image
              className="h-10 w-10 rounded-full ring-2 ring-white/40"
              src="/icon.jpg"
              alt="Rifas Mtz"
              width={40}
              height={40}
            />
            <span className="hidden truncate text-base font-bold tracking-tight sm:block">
              Rifas Mtz
            </span>
          </Link>

          <div className={`flex h-10 w-10 shrink-0 items-center justify-center ${isCartIconAvailable ? 'hidden' : ''}`}>
            <CartButton />
          </div>
        </div>
      </div>
      <HamburgerMenu className={menuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"} />
    </div>
  );
};

export default MainHeader;
