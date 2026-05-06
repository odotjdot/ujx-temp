export function parseCurrencyToCents(currencyString: string): number {
  if (!currencyString || typeof currencyString !== 'string') return 0;
  
  // Replace anything that is not a digit, period, or minus sign
  const cleanString = currencyString.replace(/[^0-9.-]+/g, '');
  
  if (!cleanString) return 0;
  
  const parsed = parseFloat(cleanString);
  if (isNaN(parsed)) return 0;
  
  return Math.round(parsed * 100);
}