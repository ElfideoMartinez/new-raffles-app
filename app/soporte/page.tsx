import Link from "next/link";

/**
 * Support / report-a-problem info page.
 *
 * WHY THIS EXISTS
 * /user/purchases now has a "Reportar problema" button. There is no support
 * backend (ticketing, email pipe, or form endpoint) wired into this app yet, so
 * routing users to an empty form would silently swallow their complaint. This
 * page instead explains exactly what to send and where, using the live
 * contact details from /admin/config, so a problem report actually reaches a
 * human.
 *
 * BACKLOG: replace the manual instructions with a real form once a support
 * channel exists (see the notification/services research item).
 */
export default function SupportPage() {
  return (
    <main className='mx-auto mt-6 max-w-xl px-5'>
      <h1 className='text-center text-xl font-bold text-ink-900'>
        Reportar un problema
      </h1>

      <p className='mt-3 text-sm text-ink-700'>
        Si tu compra no aparece, tu pago no se ha confirmado o tus boletos no
        están apartados, escríbenos con estos datos para poder revisarlo:
      </p>

      <ul className='mt-3 list-disc space-y-1 pl-6 text-sm text-ink-700'>
        <li>La fecha de tu compra (la ves en «Mis compras»).</li>
        <li>Los números de boleto que compraste.</li>
        <li>El comprobante o imagen de tu transferencia.</li>
        <li>Un teléfono o correo de contacto.</li>
      </ul>

      <div className='mt-5 rounded-card border border-blue-300 bg-blue-50 p-4 text-sm text-gray-800'>
        <p className='font-semibold'>Envíanos tu reporte</p>
        <p className='mt-1'>
          Los datos de contacto actualizados están en la página de{" "}
          <Link href='/contact' className='underline'>
            contacto
          </Link>
          .
        </p>
      </div>

      <div className='mt-6 flex flex-col gap-3 sm:flex-row'>
        <Link
          href='/user/purchases'
          className='rounded-card px-5 py-2 text-center font-semibold text-white'
          style={{ backgroundColor: "var(--color-brand-700)" }}
        >
          Volver a mis compras
        </Link>
        <Link
          href='/contact'
          className='rounded-card bg-gray-200 px-5 py-2 text-center font-semibold text-gray-800'
        >
          Contacto
        </Link>
      </div>
    </main>
  );
}
