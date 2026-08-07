import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Payment mode due-date logic (mirrors paymentUtils.ts) ───────────────

type PaymentMode = 'prepaid' | 'postpaid' | 'advance_on_entry';

function computeDueDate(
  paymentMode: PaymentMode,
  dueDay: number,
  leaseStart: string,
  periodMonth: number,
  periodYear: number,
  isFirstPayment: boolean
): Date {
  if (paymentMode === 'advance_on_entry' && isFirstPayment) {
    return new Date(leaseStart);
  }
  if (paymentMode === 'postpaid') {
    let m = periodMonth + 1;
    let y = periodYear;
    if (m > 12) { m = 1; y += 1; }
    return new Date(y, m - 1, dueDay);
  }
  // prepaid or advance_on_entry (month 2+)
  return new Date(periodYear, periodMonth - 1, dueDay);
}

// ── Get expected months from lease_start to refMonth/refYear ────────────

function getExpectedMonths(
  leaseStart: string,
  leaseEnd: string | null,
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

// ── Get expected rent for a specific month (mirrors process-payments) ───

function getExpectedRentForMonth(
  assignment: any,
  month: number,
  year: number,
  revisions: any[]
): number {
  if (!revisions || revisions.length === 0) {
    return assignment.current_rent;
  }
  const periodDate = new Date(year, month - 1, assignment.due_day || 1);
  for (const rev of revisions) {
    const effectiveDate = new Date(rev.effective_from);
    if (periodDate >= effectiveDate) {
      return rev.new_rent;
    }
  }
  const earliestRev = revisions[revisions.length - 1];
  return earliestRev.previous_rent;
}

// ── ACTION: dashboard ───────────────────────────────────────────────────
// Returns: KPI stats + overdue items list

async function handleDashboard(supabase: any) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [
    { data: properties },
    { data: assignments },
    { data: allPayments },
    { data: revisionsData }
  ] = await Promise.all([
    supabase.from('properties').select('total_units'),
    supabase.from('tenant_assignments')
      .select('id, current_rent, lease_start, lease_end, payment_mode, due_day, grace_days, tenant_id, unit_number, tenants(full_name), properties(name), status')
      .in('status', ['active', 'vacated']),
    supabase.from('payments').select('assignment_id, amount, period_month, period_year, is_reversed'),
    supabase.from('rent_revisions').select('assignment_id, previous_rent, new_rent, effective_from').order('effective_from', { ascending: false }),
  ]);

  const totalUnits = (properties || []).reduce((s: number, p: any) => s + (p.total_units || 0), 0);
  const occupiedUnits = (assignments || []).filter((a: any) => a.status === 'active').length;

  const revisionsMap = new Map();
  (revisionsData || []).forEach((r: any) => {
    if (!revisionsMap.has(r.assignment_id)) {
      revisionsMap.set(r.assignment_id, []);
    }
    revisionsMap.get(r.assignment_id).push(r);
  });

  // Valid (non-reversed) payments
  const validPayments = (allPayments || []).filter((p: any) => !p.is_reversed);

  // Per-assignment totals
  const paidPerAssignment: Record<string, number> = {};
  validPayments.forEach((p: any) => {
    paidPerAssignment[p.assignment_id] = (paidPerAssignment[p.assignment_id] || 0) + Number(p.amount);
  });

  // Build paid periods set: "assignId-month-year"
  const paidSet = new Set<string>();
  validPayments.forEach((p: any) => {
    paidSet.add(`${p.assignment_id}-${p.period_month}-${p.period_year}`);
  });

  // Compute cumulative expected + overdue items
  let totalExpected = 0;
  let totalPaid = 0;
  const overdueItems: any[] = [];

  // Current month totals for collection rate gauge
  const currentMonthPayments = validPayments.filter((p: any) => p.period_month === currentMonth && p.period_year === currentYear);
  const currentMonthPaid = currentMonthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  let currentMonthExpected = 0;

  (assignments || []).forEach((a: any) => {
    const expectedMonths = getExpectedMonths(a.lease_start, a.lease_end, currentMonth, currentYear);
    const assignmentRevisions = revisionsMap.get(a.id) || [];

    let assignmentTotalExpected = 0;
    
    expectedMonths.forEach(em => {
      assignmentTotalExpected += getExpectedRentForMonth(a, em.month, em.year, assignmentRevisions);
    });

    totalExpected += assignmentTotalExpected;
    totalPaid += paidPerAssignment[a.id] || 0;

    // Add to current month expected if the lease is active this month
    if (expectedMonths.some(em => em.month === currentMonth && em.year === currentYear)) {
      currentMonthExpected += getExpectedRentForMonth(a, currentMonth, currentYear, assignmentRevisions);
    }

    // Check for overdue months
    const overdueMonths: any[] = [];
    expectedMonths.forEach((em, idx) => {
      const key = `${a.id}-${em.month}-${em.year}`;
      if (paidSet.has(key)) return;

      const isFirstPayment = idx === 0;
      const dueDate = computeDueDate(
        a.payment_mode || 'prepaid',
        a.due_day || 1,
        a.lease_start,
        em.month,
        em.year,
        isFirstPayment
      );

      const graceEnd = new Date(dueDate);
      graceEnd.setDate(graceEnd.getDate() + (a.grace_days || 5));

      if (now > graceEnd) {
        overdueMonths.push({ month: em.month, year: em.year });
      }
    });

    if (overdueMonths.length > 0) {
      let totalOverdue = 0;
      overdueMonths.forEach(om => {
        totalOverdue += getExpectedRentForMonth(a, om.month, om.year, assignmentRevisions);
      });

      overdueItems.push({
        assignmentId: a.id,
        tenantName: a.tenants?.full_name || 'Unknown',
        propertyName: a.properties?.name || '',
        unitNumber: a.unit_number,
        monthlyRent: getExpectedRentForMonth(a, currentMonth, currentYear, assignmentRevisions),
        overdueMonths,
        totalOverdue,
      });
    }
  });

  // Sort overdue by total descending
  overdueItems.sort((a: any, b: any) => b.totalOverdue - a.totalOverdue);

  const pendingRent = Math.max(0, totalExpected - totalPaid);
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const collectionRate = currentMonthExpected > 0 ? Math.round((currentMonthPaid / currentMonthExpected) * 100) : 0;

  return {
    // KPI data
    totalRevenue: totalPaid,
    pendingRent,
    availableUnits: Math.max(0, totalUnits - occupiedUnits),
    totalTenants: occupiedUnits,
    // Side widgets data
    occupancyPct,
    collectionRate,
    collected: currentMonthPaid, // Show current month collected on the widget
    pending: pendingRent, // Keep pending as cumulative total
    // Overdue alerts
    overdueItems,
  };
}

// ── ACTION: payment-status ──────────────────────────────────────────────
// Returns per-assignment payment status for a specific month/year

async function handlePaymentStatus(supabase: any, filterMonth: number, filterYear: number) {
  const now = new Date();

  const [{ data: assignments }, { data: payments }, { data: allPayments }, { data: revisionsData }] = await Promise.all([
    supabase.from('tenant_assignments')
      .select('id, current_rent, payment_mode, due_day, grace_days, lease_start, lease_end')
      .in('status', ['active', 'vacated']),
    supabase.from('payments')
      .select('assignment_id, amount, is_reversed')
      .eq('period_month', filterMonth)
      .eq('period_year', filterYear),
    supabase.from('payments')
      .select('assignment_id, amount, is_reversed'),
    supabase.from('rent_revisions').select('assignment_id, previous_rent, new_rent, effective_from').order('effective_from', { ascending: false }),
  ]);

  const revisionsMap = new Map();
  (revisionsData || []).forEach((r: any) => {
    if (!revisionsMap.has(r.assignment_id)) {
      revisionsMap.set(r.assignment_id, []);
    }
    revisionsMap.get(r.assignment_id).push(r);
  });

  // Sum payments per assignment for THIS period
  const paidPerAssignment: Record<string, number> = {};
  (payments || []).filter((p: any) => !p.is_reversed).forEach((p: any) => {
    paidPerAssignment[p.assignment_id] = (paidPerAssignment[p.assignment_id] || 0) + Number(p.amount);
  });

  // Sum ALL payments per assignment for CUMULATIVE balance
  const totalPaidPerAssignment: Record<string, number> = {};
  const paymentCountPerAssignment: Record<string, number> = {};
  (allPayments || []).filter((p: any) => !p.is_reversed).forEach((p: any) => {
    totalPaidPerAssignment[p.assignment_id] = (totalPaidPerAssignment[p.assignment_id] || 0) + Number(p.amount);
    paymentCountPerAssignment[p.assignment_id] = (paymentCountPerAssignment[p.assignment_id] || 0) + 1;
  });

  const statusMap: Record<string, any> = {};

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  (assignments || []).forEach((a: any) => {
    const assignmentRevisions = revisionsMap.get(a.id) || [];
    const expected = getExpectedRentForMonth(a, filterMonth, filterYear, assignmentRevisions);
    const paidAmount = paidPerAssignment[a.id] || 0;
    const fullyPaid = paidAmount >= expected;

    // CUMULATIVE BALANCE CALCULATION (Anniversary Billing)
    // We compute exactly the list of months expected to be paid up to 'now'
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const expectedMonths = getExpectedMonths(a.lease_start, a.lease_end, currentMonth, currentYear);
    
    // Check if we should include the current month based on due date/anniversary
    const start = new Date(a.lease_start);
    let includedMonths = expectedMonths;
    if (a.payment_mode !== 'prepaid' && a.payment_mode !== 'advance_on_entry') {
        if (now.getDate() < start.getDate()) {
            includedMonths = expectedMonths.slice(0, -1);
        }
    }

    let totalExpectedAllTime = 0;
    includedMonths.forEach(em => {
      totalExpectedAllTime += getExpectedRentForMonth(a, em.month, em.year, assignmentRevisions);
    });

    const totalPaidAllTime = totalPaidPerAssignment[a.id] || 0;
    const cumulativeBalance = totalExpectedAllTime - totalPaidAllTime;

    // Check overdue for the specific filter period
    let isOverdue = false;
    if (!fullyPaid) {
      const isFirstPayment = (paymentCountPerAssignment[a.id] || 0) === 0;
      const dueDate = computeDueDate(
        a.payment_mode || 'prepaid',
        a.due_day || 1,
        a.lease_start,
        filterMonth,
        filterYear,
        isFirstPayment
      );
      const graceEnd = new Date(dueDate);
      graceEnd.setDate(graceEnd.getDate() + (a.grace_days || 5));
      isOverdue = now > graceEnd;
    }

    let status: string;
    if (fullyPaid) status = 'paid';
    else if (isOverdue) status = 'overdue';
    else if (paidAmount > 0) status = 'partial';
    else status = 'pending';

    statusMap[a.id] = {
      paidAmount, // Amount paid this specific month
      balance: cumulativeBalance, // UI expects total outstanding balance here
      monthBalance: expected - paidAmount, // Real balance for this specific month
      isOverdue,
      fullyPaid,
      status,
    };
  });

  return { statusMap };
}

// ── Main handler ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create supabase client with the caller's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const body = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'dashboard':
        result = await handleDashboard(supabaseClient);
        break;

      case 'payment-status': {
        const { filterMonth, filterYear } = body;
        if (!filterMonth || !filterYear) {
          throw { status: 400, message: 'filterMonth and filterYear are required' };
        }
        result = await handlePaymentStatus(supabaseClient, filterMonth, filterYear);
        break;
      }

      default:
        throw { status: 400, message: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    const status = error.status || 500;
    const message = error.message || 'An error occurred';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});
