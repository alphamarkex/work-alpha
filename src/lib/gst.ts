// GST (Goods & Services Tax) helpers for invoice generation.
// Amounts are handled as plain numbers at the call site; Prisma stores them as Decimal.

export const DEFAULT_GST_RATE = 18;

export interface GstBreakdown {
  amount: number;
  gstRate: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;
}

/**
 * Computes the GST breakdown for a given base amount and rate.
 * If `interState` is true, the full GST is charged as IGST; otherwise
 * it is split evenly between CGST and SGST (standard intra-state invoicing).
 */
export function calculateGst(
  amount: number,
  gstRate: number = DEFAULT_GST_RATE,
  interState: boolean = false
): GstBreakdown {
  const roundedAmount = round2(amount);
  const gstAmount = round2((roundedAmount * gstRate) / 100);
  const totalAmount = round2(roundedAmount + gstAmount);

  const igst = interState ? gstAmount : 0;
  const cgst = interState ? 0 : round2(gstAmount / 2);
  const sgst = interState ? 0 : round2(gstAmount / 2);

  return {
    amount: roundedAmount,
    gstRate,
    gstAmount,
    cgst,
    sgst,
    igst,
    totalAmount,
  };
}

/** Rounds to 2 decimal places, avoiding floating point artifacts. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Formats a number as Indian Rupees, e.g. ₹1,23,456.78 */
export function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Returns the Indian financial year label for a date, e.g. "26-27" for FY Apr 2026–Mar 2027. */
export function getFinancialYearLabel(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed; April = 3
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

/** Returns the [start, end] bounds of the Indian financial year containing `date`. */
export function getFinancialYearRange(date: Date = new Date()): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
}

/**
 * Generates a sequential invoice number in the form AMX/26-27/004.
 * `existingCountInFY` should be the number of invoices already created in
 * the current Indian financial year (the caller queries this from the DB).
 */
export function generateInvoiceNo(existingCountInFY: number, date: Date = new Date()): string {
  const fy = getFinancialYearLabel(date);
  const seq = String(existingCountInFY + 1).padStart(3, '0');
  return `AMX/${fy}/${seq}`;
}

/** Basic structural validation for a 15-character Indian GSTIN. */
export function isValidGstin(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
}
