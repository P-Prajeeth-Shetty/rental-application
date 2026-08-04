/**
 * paymentUtils.ts
 * Core business logic for payment timing, credit/outstanding computation,
 * and advance payment expansion.
 */

export type PaymentMode = 'prepaid' | 'postpaid' | 'advance_on_entry';
export type PaymentTiming = 'early' | 'on_time' | 'late' | 'unknown';

export interface AssignmentMeta {
  payment_mode: PaymentMode;
  due_day: number;       // 1–28
  grace_days: number;    // default 5
  lease_start: string;   // ISO date
}

/**
 * Compute the due date for a payment given the assignment's payment mode.
 *  - prepaid: due on due_day of period_month/period_year
 *  - postpaid: due on due_day of (period_month+1)
 *  - advance_on_entry (first payment): due on lease_start
 *  - advance_on_entry (subsequent): same as prepaid
 */
export function computeDueDate(
  assignment: AssignmentMeta,
  periodMonth: number,   // 1–12
  periodYear: number,
  isFirstPayment: boolean
): Date {
  const { payment_mode, due_day, lease_start } = assignment;

  if (payment_mode === 'advance_on_entry' && isFirstPayment) {
    return new Date(lease_start);
  }

  if (payment_mode === 'postpaid') {
    // Due on due_day of next month
    let m = periodMonth + 1;
    let y = periodYear;
    if (m > 12) { m = 1; y += 1; }
    return new Date(y, m - 1, due_day);
  }

  // prepaid (or advance_on_entry month 2+)
  return new Date(periodYear, periodMonth - 1, due_day);
}

/**
 * Classify payment timing.
 */
export function classifyTiming(
  paymentDate: string,
  dueDate: Date,
  graceDays: number
): { timing: PaymentTiming; daysLate: number } {
  const paid = new Date(paymentDate);
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  if (paid < dueDate) {
    return { timing: 'early', daysLate: 0 };
  }
  if (paid <= graceEnd) {
    return { timing: 'on_time', daysLate: 0 };
  }
  const msPerDay = 86400000;
  const daysLate = Math.ceil((paid.getTime() - dueDate.getTime()) / msPerDay);
  return { timing: 'late', daysLate };
}

/**
 * Compute credit/outstanding for a payment.
 * Positive credit_amount = tenant paid MORE than expected (credit).
 * Negative credit_amount = tenant paid LESS than expected (outstanding).
 */
export function computeCredit(amountPaid: number, expectedRent: number): number {
  return amountPaid - expectedRent;
}

/**
 * Expand an advance multi-month payment into individual monthly records.
 * E.g., amount=75000, monthsCovered=3, starting Aug 2026 → 3 records of ₹25,000 each.
 */
export function expandAdvancePayment(
  baseRecord: {
    assignment_id: string;
    amount: number;
    payment_date: string;
    payment_method: string | null;
    reference_number: string | null;
    notes: string | null;
    status: string;
    upload_batch_id?: string;
    payment_type: string;
    expected_amount: number;
    payment_timing: PaymentTiming;
    days_late: number;
    credit_amount: number;
  },
  startMonth: number,
  startYear: number,
  monthsCovered: number
): typeof baseRecord[] {
  const perMonth = Math.round((baseRecord.amount / monthsCovered) * 100) / 100;
  const records = [];

  for (let i = 0; i < monthsCovered; i++) {
    let m = startMonth + i;
    let y = startYear;
    while (m > 12) { m -= 12; y += 1; }

    records.push({
      ...baseRecord,
      amount: perMonth,
      period_month: m,
      period_year: y,
      credit_amount: perMonth - baseRecord.expected_amount,
      payment_type: i === 0 ? baseRecord.payment_type : 'advance',
    } as any);
  }
  return records;
}

/**
 * Human-readable timing badge info.
 */
export function timingBadge(timing: PaymentTiming, daysLate: number) {
  switch (timing) {
    case 'early':
      return { label: 'Early', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
    case 'on_time':
      return { label: 'On Time', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
    case 'late':
      return {
        label: `Late +${daysLate}d`,
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.12)'
      };
    default:
      return { label: '—', color: 'var(--text-secondary)', bg: 'transparent' };
  }
}
