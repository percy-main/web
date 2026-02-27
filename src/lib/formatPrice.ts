export function formatPrice(amountPence: number): string {
  return `\u00A3${(amountPence / 100).toFixed(amountPence % 100 === 0 ? 0 : 2)}`;
}
