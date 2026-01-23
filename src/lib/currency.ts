/**
 * Format a number as Pakistani Rupees (PKR)
 * @param amount - The amount to format
 * @returns Formatted string with PKR symbol
 */
export function formatPKR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format a number as Pakistani Rupees with decimals
 * @param amount - The amount to format
 * @returns Formatted string with PKR symbol and 2 decimal places
 */
export function formatPKRDecimal(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
