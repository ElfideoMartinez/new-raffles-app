"use client";
import Image from "next/image";
import React from "react";
import CartButton from "./CartButton";
import Link from "next/link";

const MainHeader = () => {
  return (
    <div className='bg-gradient-to-b from-blue-500 to-teal-400 text-white p-4 flex items-center justify-between'>
      <button className='text-white focus:outline-none'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          className='h-6 w-6'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M4 6h16M4 12h16m-7 6h7'
          />
        </svg>
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
