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

export interface RentRevisionLike {
  new_rent: number;
  increase_pct: number | null;
  effective_from: string;
}

/**
 * Explains why the current rent is what it is: an escalation that has
 * kicked in, or still the original base rent.
 */
export function rentBadge(revisions: RentRevisionLike[] | undefined, asOf: Date = new Date()) {
  const asOfStr = asOf.toISOString().split('T')[0];
  const applicable = (revisions || [])
    .filter(r => r.effective_from.split('T')[0] <= asOfStr)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  if (applicable.length === 0) {
    return { label: 'Base Rent', color: 'var(--text-secondary)', bg: 'rgba(148,163,184,0.12)' };
  }
  const pct = applicable[0].increase_pct ?? 5;
  return { label: `Escalated +${pct}%`, color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' };
}
