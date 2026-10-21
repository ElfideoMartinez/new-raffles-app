import { formatDateTime } from "./format";

/** Kept for existing call sites; delegates to the shared es-MX formatter. */
export function formatDateLocal(dateString: string) {
  return formatDateTime(dateString);
}
