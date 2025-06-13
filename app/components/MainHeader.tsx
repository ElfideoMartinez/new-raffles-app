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
      <div className='bg-gradient-to-b from-blue-500 to-teal-400 text-white p-4 flex items-center justify-between'>
        {pathName === '/' ? 
          <button className="w-7 h-auto filter invert" onClick={() => setMenuOpen(!menuOpen)}><img src="burgerbutton.png"/></button> 
        : 
          <button className={`text-white focus:outline-none ${isMain ? 'invisible' : ''}`} onClick={() => {
            router.back();
          }}>
            <img src="/arrowBack.png" className="w-8 h-auto filter invert"/>
          </button> 
        }
        <Link href='/'>
          <Image
            className='rounded-full overflow-hidden'
            src='/icon.jpg'
            alt='logo'
            width={100}
            height={100}
          />
        </Link>
        <div className={`${isCartIconAvailable ? 'invisible' : ''}`}>
          <CartButton />
        </div>
      </div>
      <HamburgerMenu className={menuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"} />
    </div>
  );
};

export default MainHeader;
