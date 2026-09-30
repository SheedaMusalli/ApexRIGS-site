/** Decimal arithmetic uses integer coefficients. Never convert money to binary floating point. */
export function decimal(value: unknown, places = 4): bigint {
  const text = String(value ?? '0');
  if (!/^-?\d+(\.\d+)?$/.test(text) || text.length > 35) throw new Error('Enter a plain decimal amount.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  if (fraction.length > places && /[1-9]/.test(fraction.slice(places))) throw new Error(`At most ${places} decimal places are allowed.`);
  const result = BigInt(whole) * 10n ** BigInt(places) + BigInt((fraction.slice(0, places) + '0'.repeat(places)).slice(0, places));
  if (result > 99999999999999999999n) throw new Error('Amount exceeds supported precision.');
  return negative ? -result : result;
}
export function format(value: bigint, places = 4): string {
  const sign = value < 0n ? '-' : ''; const abs = value < 0n ? -value : value;
  const scale = 10n ** BigInt(places);
  return `${sign}${abs / scale}.${String(abs % scale).padStart(places, '0')}`;
}
export function divide(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error('Divisor must be positive.');
  return n < 0n ? -divide(-n, d) : (n + d / 2n) / d;
}
export const amountFor = (quantity: unknown, price: unknown) => divide(decimal(quantity, 6) * decimal(price), 1000000n);
export const fxAmount = (value: bigint, rate: unknown) => divide(value * decimal(rate, 8), 100000000n);
