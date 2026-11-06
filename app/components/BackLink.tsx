"use client";
import Link from "next/link";

/**
 * Consistent back affordance (2026-11-06).
 *
 * Daniel's feedback on the bet-detail back control: a floating translucent
 * pill that was invisible in light mode and looked off. This is a clean
 * ghost link — left chevron + label — that tints via the ink tokens so it
 * reads on both light and dark surfaces. Used on bet detail, raffle detail
 * and the quick-ticket screen so "go back" looks the same everywhere.
 */
const BackLink = ({
  href,
  label = "Volver",
}: {
  href: string;
  label?: string;
}) => (
  <Link
    href={href}
    aria-label={label}
    className="-ml-1 inline-flex items-center gap-1 self-start rounded-sm px-1 py-1 text-sm font-semibold text-ink-500 transition-colors hover:text-brand-700 focus-ring"
  >
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      {/* Left-pointing chevron (points back). */}
      <path d="m15 18-6-6 6-6" />
    </svg>
    {label}
  </Link>
);

export default BackLink;
