export function formatDateLocal(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString();
}