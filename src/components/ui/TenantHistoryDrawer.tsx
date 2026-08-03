import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Clock, Calendar, IndianRupee } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { timingBadge } from '../../lib/paymentUtils';
import type { PaymentTiming } from '../../lib/paymentUtils';

interface HistoryPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  period_month: number;
  period_year: number;
  reference_number: string | null;
  status: string;
  payment_type: string;
  payment_timing: PaymentTiming;
  days_late: number;
  credit_amount: number;
  expected_amount: number | null;
  is_reversed: boolean;
  reversal_notes: string | null;
  notes: string | null;
}

interface TenantHistoryDrawerProps {
  assignmentId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  currentRent: number;
  onClose: () => void;
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const TenantHistoryDrawer: React.FC<TenantHistoryDrawerProps> = ({
  assignmentId, tenantName, propertyName, unitNumber, currentRent, onClose
}) => {
  const [payments, setPayments] = useState<HistoryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (!error) setPayments((data as HistoryPayment[]) || []);
      setIsLoading(false);
    };
    fetchHistory();
  }, [assignmentId]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activePays = payments.filter(p => !p.is_reversed);
  const totalPaid = activePays.reduce((s, p) => s + Number(p.amount), 0);
  const onTimeCount = activePays.filter(p => p.payment_timing === 'on_time' || p.payment_timing === 'early').length;
  const lateCount = activePays.filter(p => p.payment_timing === 'late').length;
  const runningCredit = activePays.reduce((s, p) => s + Number(p.credit_amount || 0), 0);

  const creditLabel = runningCredit > 0
    ? { text: `+₹${Math.abs(runningCredit).toLocaleString('en-IN')} credit`, color: '#10b981' }
    : runningCredit < 0
    ? { text: `-₹${Math.abs(runningCredit).toLocaleString('en-IN')} outstanding`, color: '#ef4444' }
    : { text: '₹0 balance', color: 'var(--text-secondary)' };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1100 }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(680px, 95vw)',
        background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-color)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.15)', zIndex: 1200,
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{tenantName}</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {propertyName} — Unit {unitNumber} · ₹{currentRent.toLocaleString('en-IN')}/mo
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: '12px', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#10b981', icon: <IndianRupee size={14} /> },
            { label: 'Payments Made', value: String(activePays.length), color: 'var(--text-primary)', icon: <Calendar size={14} /> },
            { label: 'On Time / Early', value: String(onTimeCount), color: '#3b82f6', icon: <Clock size={14} /> },
            { label: 'Late', value: String(lateCount), color: lateCount > 0 ? '#ef4444' : 'var(--text-secondary)', icon: <Clock size={14} /> },
            { label: 'Balance', value: creditLabel.text, color: creditLabel.color, icon: runningCredit >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-glass-container)', borderRadius: '10px', padding: '10px 14px', minWidth: '100px', flex: '1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>
                {s.icon}{s.label}
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Payment Ledger */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            PAYMENT HISTORY
          </h3>

          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No payments recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.map(p => {
                const badge = timingBadge(p.payment_timing, p.days_late);
                const credit = Number(p.credit_amount || 0);
                const expected = Number(p.expected_amount || currentRent);
                const isReversed = p.is_reversed;
                const isAdvance = p.payment_type === 'advance';

                return (
                  <div key={p.id} style={{
                    padding: '14px 16px', borderRadius: '12px',
                    background: isReversed ? 'rgba(239,68,68,0.05)' : isAdvance ? 'rgba(139,92,246,0.05)' : 'var(--bg-glass-container)',
                    border: `1px solid ${isReversed ? 'rgba(239,68,68,0.15)' : isAdvance ? 'rgba(139,92,246,0.15)' : 'var(--border-color)'}`,
                    opacity: isReversed ? 0.6 : 1,
                    position: 'relative'
                  }}>
                    {isReversed && (
                      <span style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                        REVERSED
                      </span>
                    )}
                    {isAdvance && !isReversed && (
                      <span style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 600, background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: '10px' }}>
                        ADVANCE
                      </span>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                          {monthNames[p.period_month - 1]} {p.period_year}
                        </span>
                        <span style={{ marginLeft: '10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {new Date(p.payment_date).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                        {credit !== 0 && (
                          <div style={{ fontSize: '0.8rem', color: credit > 0 ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                            {credit > 0 ? `+₹${credit.toLocaleString('en-IN')} credit` : `-₹${Math.abs(credit).toLocaleString('en-IN')} short`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Timing badge */}
                      {!isReversed && p.payment_timing !== 'unknown' && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                          {badge.emoji} {badge.label}
                        </span>
                      )}
                      {/* Method */}
                      {p.payment_method && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                          {p.payment_method}
                        </span>
                      )}
                      {/* Reference */}
                      {p.reference_number && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Ref: {p.reference_number}
                        </span>
                      )}
                      {/* Type */}
                      {p.payment_type !== 'rent' && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 500 }}>
                          {p.payment_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    {/* Notes / reversal notes */}
                    {(p.notes || p.reversal_notes) && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {p.reversal_notes || p.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
