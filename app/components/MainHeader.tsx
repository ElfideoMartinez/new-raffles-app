"use client";
import Image from "next/image";
import React from "react";
import CartButton from "./CartButton";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";


const MainHeader = () => {
  const router = useRouter();
  const pathName = usePathname();
  const isMain = pathName === '/' || pathName === '/admin/dashboard';
  //console.log(pathName);
  return (
    <div className='bg-gradient-to-b from-blue-500 to-teal-400 text-white p-4 flex items-center justify-between'>
      <button className={`text-white focus:outline-none ${isMain ? 'invisible' : ''}`} onClick={() => {
        router.back();
      }}>
        <img src="/arrowBack.png" className="w-8 h-auto filter invert"/>
      </button>
      <Link href='/'>
        <Image
          className='rounded-full overflow-hidden'
          src='/icon.jpg'
          alt='logo'
          width={100}
          height={100}
        />
      </Link>
      <CartButton />
    </div>
  );
};

export default MainHeader;
