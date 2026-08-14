// Shared rent/payment calculation logic used by both payment-stats and
// process-payments. Previously duplicated near-verbatim in both edge
// functions, which meant a business-rule change (e.g. the GST/TDS formula,
// or how mid-month rent revisions prorate) had to be applied twice or the
// live ledger (process-payments) and the reporting layer (payment-stats)
// would silently disagree.

export type PaymentMode = 'prepaid' | 'postpaid' | 'advance_on_entry';
export type PaymentTiming = 'early' | 'on_time' | 'late' | 'unknown';

export interface RentRevision {
  assignment_id?: string;
  previous_rent: number;
  new_rent: number;
  effective_from: string;
}

// All rent is always due on the 1st of the month, regardless of payment
// mode/due_day (those only affect display, not the actual due date).
export function computeDueDate(
  _paymentMode: PaymentMode,
  _dueDay: number,
  _leaseStart: string,
  periodMonth: number,
  periodYear: number,
  _isFirstPayment: boolean
): Date {
  return new Date(periodYear, periodMonth - 1, 1);
}

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

export function computeCredit(amountPaid: number, expectedRent: number): number {
  return amountPaid - expectedRent;
}

// Every (month, year) pair a lease is expected to be billed for, from
// lease_start through min(refMonth/refYear, lease_end).
export function getExpectedMonths(
  leaseStart: string,
  leaseEnd: string | null | undefined,
  refMonth: number,
  refYear: number
): { month: number; year: number }[] {
  const start = new Date(leaseStart);
  let m = start.getMonth() + 1;
  let y = start.getFullYear();
  const result: { month: number; year: number }[] = [];

  while (y < refYear || (y === refYear && m <= refMonth)) {
    result.push({ month: m, year: y });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  if (leaseEnd) {
    const end = new Date(leaseEnd);
    const endMonth = end.getMonth() + 1;
    const endYear = end.getFullYear();
    return result.filter(r => r.year < endYear || (r.year === endYear && r.month <= endMonth));
  }
  return result;
}

// Day-prorated rent for a given month, accounting for lease start/end
// falling mid-month and any rent revision taking effect mid-month.
export function getExpectedRentForMonth(
  assignment: any,
  month: number,
  year: number,
  revisions: RentRevision[]
): number {
  let periodStart = new Date(year, month - 1, 1);
  let periodEnd = new Date(year, month, 0); // last day of month

  const leaseStart = new Date(assignment.lease_start);

  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(0, 0, 0, 0);
  leaseStart.setHours(0, 0, 0, 0);

  // If lease hasn't started yet in this month
  if (periodStart < leaseStart) {
    if (periodEnd < leaseStart) return 0;
    periodStart = leaseStart;
  }

  // If lease has ended in this month
  if (assignment.lease_end) {
    const leaseEnd = new Date(assignment.lease_end);
    leaseEnd.setHours(0, 0, 0, 0);
    if (periodEnd > leaseEnd) {
      if (periodStart > leaseEnd) return 0;
      periodEnd = leaseEnd;
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  let totalRent = 0;

  for (let d = periodStart.getDate(); d <= periodEnd.getDate(); d++) {
    const currentDate = new Date(year, month - 1, d);
    currentDate.setHours(0, 0, 0, 0);

    let applicableRent = assignment.current_rent;

    if (revisions && revisions.length > 0) {
      const rev = revisions.find(r => {
        const revDate = new Date(r.effective_from);
        revDate.setHours(0, 0, 0, 0);
        return revDate <= currentDate;
      });
      if (rev) {
        applicableRent = rev.new_rent;
      } else {
        applicableRent = revisions[revisions.length - 1].previous_rent;
      }
    }

    totalRent += (applicableRent / daysInMonth);
  }

  return Math.round(totalRent * 100) / 100;
}

export function computeNetPayable(
  baseRent: number,
  gstRate: number,
  tdsRate: number
): { net: number; gstAmount: number; tdsAmount: number } {
  const gstAmount = Math.round(baseRent * gstRate / 100 * 100) / 100;
  const tdsAmount = Math.round(baseRent * tdsRate / 100 * 100) / 100;
  const net = Math.round((baseRent + gstAmount - tdsAmount) * 100) / 100;
  return { net, gstAmount, tdsAmount };
}
