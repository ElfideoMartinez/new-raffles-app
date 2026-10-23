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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-white/15 transition-colors hover:bg-white/25"
              aria-label="Abrir menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' className='w-6 h-6 text-white' fill='currentColor' aria-hidden='true'>
                <path d='M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z' />
              </svg>
            </button>
          ) : (
            <button
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-white/15 transition-colors hover:bg-white/25 ${isMain ? 'hidden' : ''}`}
              aria-label="Regresar"
              onClick={() => {
                router.back();
              }}
            >
              <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512' className='w-6 h-6 text-white' fill='currentColor' aria-hidden='true'>
                <path d='M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z' />
              </svg>
            </button>
          )}

          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image
              className="h-10 w-10 rounded-pill ring-2 ring-white/40"
              src="/icon.jpg"
              alt="Rifas Mtz"
              width={40}
              height={40}
            />
            <span className="hidden truncate text-base font-bold tracking-tight sm:block">
              Rifas Mtz
            </span>
          </Link>

          <div className='flex h-10 w-10 shrink-0 items-center justify-center'>
            <CartButton />
          </div>
        </div>
      </div>
      <HamburgerMenu className={menuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"} />
    </div>
  );
};

export default MainHeader;
