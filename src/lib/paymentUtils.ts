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
