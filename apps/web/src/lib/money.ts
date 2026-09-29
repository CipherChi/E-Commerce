export function decimalToMinorUnits(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Invalid decimal amount');
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}
export function minorUnitsToDecimal(value: bigint): string {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}
export function formatMoney(value: string): string {
  const amount = minorUnitsToDecimal(decimalToMinorUnits(value));
  const [whole, fraction] = amount.split('.');
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
export function sumMoney(values: string[]): string {
  return minorUnitsToDecimal(values.reduce((total, value) => total + decimalToMinorUnits(value), 0n));
}
export function multiplyMoney(value: string, quantity: number): string {
  return minorUnitsToDecimal(decimalToMinorUnits(value) * BigInt(quantity));
}
export function subtractMoney(value: string, minorUnits = 1n): string {
  const total = decimalToMinorUnits(value) - minorUnits;
  return minorUnitsToDecimal(total > 0n ? total : 0n);
}
