/** Formats existing decimal-major-unit amounts for receipts, consistently across API and web. */
exports.formatReceiptMoney = function formatReceiptMoney(value) {
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('Invalid receipt amount');
  const [, sign, whole, fraction = ''] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `NGN ${sign}${grouped}.${fraction.padEnd(2, '0')}`;
};
