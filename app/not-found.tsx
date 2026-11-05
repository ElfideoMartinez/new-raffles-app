import Link from "next/link";

/**
 * Custom 404 for the storefront.
 *
 * Next's default 404 is a bare white page with no way back, which on a paid
 * raffle site reads as "the site is broken" rather than "that link is wrong".
 * This page states the problem plainly, offers the two destinations a visitor
 * actually wants (the raffle/bet lists), and keeps the contact route reachable.
 */
export default function NotFound() {
  return (
    <main className='flex min-h-[60vh] w-full flex-col items-center justify-center px-6 text-center'>
      <p className='text-6xl font-bold text-ink-500'>404</p>
      <h1 className='mt-3 text-2xl font-bold text-ink-900'>
        No encontramos esta página
      </h1>
      <p className='mt-2 max-w-md text-sm text-ink-500'>
        El enlace puede estar roto, o la rifa o apuesta que buscas ya no está
        disponible. Tus compras y boletos no se pierden por esto.
      </p>

      <div className='mt-6 flex flex-col gap-3 sm:flex-row'>
        <Link
          href='/'
          className='rounded-card px-5 py-2 font-semibold text-white'
          style={{ backgroundColor: "var(--color-brand-700)" }}
        >
          Ir al inicio
        </Link>
        <Link
          href='/bet'
          className='rounded-card bg-ink-100 px-5 py-2 font-semibold text-ink-700'
        >
          Ver apuestas
        </Link>
        <Link
          href='/user/purchases'
          className='rounded-card bg-ink-100 px-5 py-2 font-semibold text-ink-700'
        >
          Mis compras
        </Link>
      </div>

      <p className='mt-6 text-xs text-ink-500'>
        ¿Necesitas ayuda?{" "}
        <Link href='/contact' className='underline'>
          Contáctanos
        </Link>
      </p>
    </main>
  );
}
