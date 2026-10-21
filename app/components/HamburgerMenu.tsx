import Link from "next/link";

export default function HamburgerMenu({ className = "" }) {
  return (
    <div
      className={`absolute top-2/3 left-4 mt-2 w-48 bg-white text-gray-600 font-semibold shadow-md rounded-sm transition-all duration-300 ease-out ${className}`}
    >
      <Link
        href='/user/purchases'
        className='block px-4 py-3 hover:bg-gray-200 hover:rounded-card'
      >
        👜 Compras
      </Link>
      <Link
        href='/contact'
        className='block px-4 py-3 hover:bg-gray-200 hover:rounded-card'
      >
        ℹ️ Contacto
      </Link>
      <Link
        href='/quickTicket/play'
        className='block px-4 py-3 hover:bg-gray-200 hover:rounded-card'
      >
        🎟️ Rascadito Rápido
      </Link>
    </div>
  );
}
