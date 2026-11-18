/** Makes user text safe to use inside a regular expression */
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Indian price format: 4500000 -> "₹45 L", 12500000 -> "₹1.25 Cr" */
export function formatINR(amount: number): string {
  if (amount >= 1e7) return `₹${trim(amount / 1e7)} Cr`;
  if (amount >= 1e5) return `₹${trim(amount / 1e5)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** Escapes text before putting it inside HTML emails */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
