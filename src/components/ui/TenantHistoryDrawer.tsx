import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, IndianRupee, FileText, ReceiptText, BookOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { timingBadge } from '../../lib/paymentUtils';
import type { PaymentTiming } from '../../lib/paymentUtils';
import { getPaymentReceiptUrl } from '../../lib/storageUtils';
import { Drawer } from './Modal';

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
  gst_amount: number;
  tds_amount: number;
  is_reversed: boolean;
  reversal_notes: string | null;
  notes: string | null;
  receipt_url: string | null;
}

interface RawTransaction {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_type: string;
  reference_number: string | null;
  receipt_url: string | null;
  notes: string | null;
  months_covered: number;
  created_at: string;
}

interface TenantHistoryDrawerProps {
  assignmentId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  currentRent: number;
  backendBalance: number;
  gstRate?: number;
  tdsRate?: number;
  onClose: () => void;
}

const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type ViewMode = 'ledger' | 'transactions';

export const TenantHistoryDrawer: React.FC<TenantHistoryDrawerProps> = ({
  assignmentId, tenantName, propertyName, unitNumber, currentRent, backendBalance, gstRate = 18, tdsRate = 10, onClose
}) => {
  const [payments, setPayments] = useState<HistoryPayment[]>([]);
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('ledger');

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      const [{ data, error }, { data: revData }, { data: txnData }] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount, payment_date, payment_method, period_month, period_year, reference_number, status, payment_type, payment_timing, days_late, credit_amount, expected_amount, gst_amount, tds_amount, is_reversed, reversal_notes, notes, receipt_url')
          .eq('assignment_id', assignmentId)
          .order('period_year', { ascending: false })
          .order('period_month', { ascending: false }),
        supabase
          .from('rent_revisions')
          .select('*')
          .eq('assignment_id', assignmentId),
        supabase
          .from('payment_transactions')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('payment_date', { ascending: false })
      ]);
      
      if (!error) setPayments((data as HistoryPayment[]) || []);
      if (revData) setRevisions(revData);
      if (txnData) setTransactions(txnData as RawTransaction[]);
      setIsLoading(false);
    };
    fetchHistory();
  }, [assignmentId]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activePays = payments.filter(p => !p.is_reversed);
  const totalPaid = activePays.reduce((s, p) => s + Number(p.amount), 0);
  const depositPaid = activePays.filter(p => p.payment_type === 'security_deposit').reduce((s, p) => s + Number(p.amount), 0);

  const runningBalance = backendBalance; // positive = owes money, negative = credit
  // Excess paid beyond what's currently due — money sitting in the tenant's favor
  const advanceAmountPaid = runningBalance < 0 ? Math.abs(runningBalance) : 0;

  const creditLabel = runningBalance < 0
    ? { text: `+₹${Math.abs(runningBalance).toLocaleString('en-IN')} credit`, color: '#10b981' }
    : runningBalance > 0
    ? { text: `-₹${runningBalance.toLocaleString('en-IN')} outstanding`, color: '#ef4444' }
    : { text: '₹0 balance', color: 'var(--text-secondary)' };

  return (
    <Drawer isOpen={true} onClose={onClose} title={tenantName} maxWidth="800px">
      <div style={{ display: 'flex', flexDirection: 'column', padding: 0, gap: '24px' }}>
        <p style={{ margin: '-16px 0 0', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {propertyName} — Unit {unitNumber} · ₹{currentRent.toLocaleString('en-IN')}/mo
          {(gstRate > 0 || tdsRate > 0) && (
            <span style={{ fontSize: '0.8rem', marginLeft: '8px', color: 'var(--text-muted)' }}>
              (GST {gstRate}% · TDS {tdsRate}% · Net ₹{(currentRent + Math.round(currentRent * gstRate / 100) - Math.round(currentRent * tdsRate / 100)).toLocaleString('en-IN')})
            </span>
          )}
        </p>

        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#10b981', icon: <IndianRupee size={14} /> },
          { label: 'Payments Made', value: String(activePays.length), color: 'var(--text-primary)', icon: <Calendar size={14} /> },
          { label: 'Deposit Paid', value: `₹${depositPaid.toLocaleString('en-IN')}`, color: '#8b5cf6', icon: <IndianRupee size={14} /> },
          { label: 'Advance Amount Paid', value: `₹${advanceAmountPaid.toLocaleString('en-IN')}`, color: '#3b82f6', icon: <IndianRupee size={14} /> },
          { label: 'Balance', value: creditLabel.text, color: creditLabel.color, icon: runningBalance <= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} /> },
        ].map(s => (
          <div key={s.label} className="surface-card" style={{ 
            padding: '12px 14px', 
            minWidth: '100px', 
            flex: '1',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '4px' }}>
              {s.icon}{s.label}
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', color: s.color }}>{s.value}</p>
          </div>
        ))}
        </div>

      {/* ── View Mode Toggle ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: 'rgba(0,0,0,0.03)', borderRadius: '10px', alignSelf: 'flex-start', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setViewMode('ledger')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 600, borderRadius: '6px',
            background: viewMode === 'ledger' ? '#10b981' : 'transparent',
            color: viewMode === 'ledger' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: viewMode === 'ledger' ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <BookOpen size={14} /> Monthly Ledger
        </button>
        <button
          onClick={() => setViewMode('transactions')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            fontSize: '0.82rem', fontWeight: 600, borderRadius: '6px',
            background: viewMode === 'transactions' ? '#10b981' : 'transparent',
            color: viewMode === 'transactions' ? '#ffffff' : 'var(--text-secondary)',
            boxShadow: viewMode === 'transactions' ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <ReceiptText size={14} /> Raw Receipts ({transactions.length})
        </button>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : viewMode === 'transactions' ? (
          /* ── Raw Transactions View ───────────────────────────────── */
          transactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No raw transaction records found. Transactions recorded before this feature was added won't appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transactions.map(txn => {
                const typeLabel = (txn.payment_type || 'rent').replace(/_/g, ' ');
                return (
                  <div key={txn.id} className="surface-card" style={{
                    padding: '16px 20px', borderRadius: '14px',
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}>
                          ₹{Number(txn.amount).toLocaleString('en-IN')}
                        </span>
                        <span style={{ marginLeft: '10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                          {new Date(txn.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 600,
                      }}>
                        {txn.months_covered} {txn.months_covered === 1 ? 'month' : 'months'} covered
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {txn.payment_method && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                          {txn.payment_method}
                        </span>
                      )}
                      {typeLabel !== 'rent' && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 500 }}>
                          {typeLabel}
                        </span>
                      )}
                      {txn.reference_number && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Ref: {txn.reference_number}
                        </span>
                      )}
                      {txn.receipt_url && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const url = await getPaymentReceiptUrl(txn.receipt_url as string);
                              window.open(url, '_blank');
                            } catch (err) {
                              console.error(err);
                              alert('Could not open receipt.');
                            }
                          }}
                          style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FileText size={12} />
                          Receipt
                        </button>
                      )}
                    </div>

                    {txn.notes && (
                      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        {txn.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ── Monthly Ledger View (existing) ──────────────────────── */
          payments.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No payments recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.map(p => {
                const badge = timingBadge(p.payment_timing, p.days_late);
                const credit = Number(p.credit_amount || 0);
                const isReversed = p.is_reversed;
                const isAdvance = p.payment_type === 'advance';

                const matchedRevision = revisions.find(r => {
                  const revDate = new Date(r.effective_from);
                  return revDate.getFullYear() === p.period_year && (revDate.getMonth() + 1) === p.period_month;
                });

                return (
                  <div key={p.id} className="surface-card" style={{
                    padding: '16px 20px', borderRadius: '14px',
                    background: isReversed ? 'rgba(239,68,68,0.05)' : isAdvance ? 'rgba(139,92,246,0.05)' : 'var(--bg-main)',
                    border: `1px solid ${isReversed ? 'rgba(239,68,68,0.2)' : isAdvance ? 'rgba(139,92,246,0.2)' : 'var(--border-color)'}`,
                    opacity: isReversed ? 0.6 : 1,
                    position: 'relative'
                  }}>
                    {isReversed && (
                      <span style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '2px' }}>
                        REVERSED
                      </span>
                    )}
                    {isAdvance && !isReversed && (
                      <span style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 600, background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: '2px' }}>
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
                        <span style={{ display: 'inline-block', minWidth: '75px', textAlign: 'center', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', fontWeight: 500, background: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      )}
                      {/* Method */}
                      {p.payment_method && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
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
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 500 }}>
                          {p.payment_type.replace('_', ' ')}
                        </span>
                      )}
                      {/* Revision Badge */}
                      {matchedRevision && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', fontWeight: 600 }}>
                          Rent revised to ₹{matchedRevision.new_rent.toLocaleString('en-IN')}
                        </span>
                      )}
                      {/* Receipt link */}
                      {p.receipt_url && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              const url = await getPaymentReceiptUrl(p.receipt_url as string);
                              window.open(url, '_blank');
                            } catch (err) {
                              console.error(err);
                              alert('Could not open receipt.');
                            }
                          }}
                          style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FileText size={12} />
                          Receipt
                        </button>
                      )}
                    </div>

                    {/* GST/TDS breakdown */}
                    {(Number(p.gst_amount) > 0 || Number(p.tds_amount) > 0) && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {Number(p.gst_amount) > 0 && (
                          <span style={{ color: '#f59e0b' }}>GST: ₹{Number(p.gst_amount).toLocaleString('en-IN')}</span>
                        )}
                        {Number(p.tds_amount) > 0 && (
                          <span style={{ color: '#ef4444' }}>TDS: ₹{Number(p.tds_amount).toLocaleString('en-IN')}</span>
                        )}
                      </div>
                    )}

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
          )
        )}
      </div>
      </div>
    </Drawer>
  );
};
