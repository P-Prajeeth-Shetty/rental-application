import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  computeDueDate,
  getExpectedMonths,
  getExpectedRentForMonth,
  computeNetPayable as computeNetPayableDetailed,
} from "../_shared/rentCalc.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// payment-stats only ever needs the net figure, not the GST/TDS breakdown
function computeNetPayable(baseRent: number, gstRate: number, tdsRate: number): number {
  return computeNetPayableDetailed(baseRent, gstRate, tdsRate).net;
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
    { data: periodSummary },
    { data: revisionsData }
  ] = await Promise.all([
    supabase.from('properties').select('total_units, property_type'),
    supabase.from('tenant_assignments')
      .select('id, current_rent, lease_start, lease_end, payment_mode, due_day, grace_days, gst_rate, tds_rate, tenant_id, unit_number, tenants(full_name), properties(name, property_type), status')
      .in('status', ['active', 'vacated']),
    // Pre-aggregated in SQL (one row per assignment/month/year) instead of
    // pulling every individual payment row into the function.
    supabase.from('payments_period_summary').select('assignment_id, period_month, period_year, rent_paid, rent_payment_count'),
    supabase.from('rent_revisions').select('assignment_id, previous_rent, new_rent, effective_from').order('effective_from', { ascending: false }),
  ]);

  const totalUnits = (properties || []).reduce((s: number, p: any) => s + (p.total_units || 0), 0);
  const occupiedUnits = (assignments || []).filter((a: any) => a.status === 'active').length;

  const occupancyByType: Record<string, { total: number, occupied: number }> = {};
  (properties || []).forEach((p: any) => {
    const type = p.property_type || 'Residential';
    if (!occupancyByType[type]) occupancyByType[type] = { total: 0, occupied: 0 };
    occupancyByType[type].total += (p.total_units || 0);
  });

  (assignments || []).filter((a: any) => a.status === 'active').forEach((a: any) => {
    const type = a.properties?.property_type || 'Residential';
    if (occupancyByType[type]) {
      occupancyByType[type].occupied += 1;
    }
  });

  const revisionsMap = new Map();
  (revisionsData || []).forEach((r: any) => {
    if (!revisionsMap.has(r.assignment_id)) {
      revisionsMap.set(r.assignment_id, []);
    }
    revisionsMap.get(r.assignment_id).push(r);
  });

  // Rent-ledger totals, already summed per (assignment, month, year) in SQL
  // (the view filters out reversed payments and non-rent payment types).
  const paidPerAssignment: Record<string, number> = {};
  const paidSet = new Set<string>();
  let currentMonthPaid = 0;
  (periodSummary || []).forEach((r: any) => {
    const rentPaid = Number(r.rent_paid || 0);
    paidPerAssignment[r.assignment_id] = (paidPerAssignment[r.assignment_id] || 0) + rentPaid;
    if ((r.rent_payment_count || 0) > 0) {
      paidSet.add(`${r.assignment_id}-${r.period_month}-${r.period_year}`);
    }
    if (r.period_month === currentMonth && r.period_year === currentYear) {
      currentMonthPaid += rentPaid;
    }
  });

  // Compute cumulative expected + overdue items
  let totalExpected = 0;
  let totalPaid = 0;
  const overdueItems: any[] = [];
  let currentMonthExpected = 0;

  (assignments || []).forEach((a: any) => {
    const expectedMonths = getExpectedMonths(a.lease_start, a.lease_end, currentMonth, currentYear);
    const assignmentRevisions = revisionsMap.get(a.id) || [];

    let assignmentTotalExpected = 0;
    const gstRate = Number(a.gst_rate ?? 18);
    const tdsRate = Number(a.tds_rate ?? 10);
    
    expectedMonths.forEach(em => {
      const baseRent = getExpectedRentForMonth(a, em.month, em.year, assignmentRevisions);
      assignmentTotalExpected += computeNetPayable(baseRent, gstRate, tdsRate);
    });

    totalExpected += assignmentTotalExpected;
    totalPaid += paidPerAssignment[a.id] || 0;

    // Add to current month expected if the lease is active this month
    if (expectedMonths.some(em => em.month === currentMonth && em.year === currentYear)) {
      currentMonthExpected += computeNetPayable(getExpectedRentForMonth(a, currentMonth, currentYear, assignmentRevisions), gstRate, tdsRate);
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
        totalOverdue += computeNetPayable(getExpectedRentForMonth(a, om.month, om.year, assignmentRevisions), gstRate, tdsRate);
      });

      overdueItems.push({
        assignmentId: a.id,
        tenantName: a.tenants?.full_name || 'Unknown',
        propertyName: a.properties?.name || '',
        unitNumber: a.unit_number,
        monthlyRent: computeNetPayable(getExpectedRentForMonth(a, currentMonth, currentYear, assignmentRevisions), gstRate, tdsRate),
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
    occupancyByType,
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

  const [{ data: assignments }, { data: periodSummary }, { data: revisionsData }] = await Promise.all([
    supabase.from('tenant_assignments')
      .select('id, current_rent, payment_mode, due_day, grace_days, lease_start, lease_end, gst_rate, tds_rate')
      .in('status', ['active', 'vacated']),
    // One row per (assignment, month, year), pre-summed in SQL, instead of
    // fetching every individual payment row for the cumulative balance.
    supabase.from('payments_period_summary')
      .select('assignment_id, period_month, period_year, rent_paid, deposit_paid, rent_payment_count'),
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
  (periodSummary || [])
    .filter((r: any) => r.period_month === filterMonth && r.period_year === filterYear)
    .forEach((r: any) => {
      paidPerAssignment[r.assignment_id] = (paidPerAssignment[r.assignment_id] || 0) + Number(r.rent_paid || 0);
    });

  // Sum ALL payments per assignment for CUMULATIVE balance
  const totalPaidPerAssignment: Record<string, number> = {};
  const paymentCountPerAssignment: Record<string, number> = {};
  const totalDepositPerAssignment: Record<string, number> = {};
  (periodSummary || []).forEach((r: any) => {
    const rentPaid = Number(r.rent_paid || 0);
    const depositPaid = Number(r.deposit_paid || 0);
    totalPaidPerAssignment[r.assignment_id] = (totalPaidPerAssignment[r.assignment_id] || 0) + rentPaid;
    paymentCountPerAssignment[r.assignment_id] = (paymentCountPerAssignment[r.assignment_id] || 0) + (r.rent_payment_count || 0);
    if (depositPaid) {
      totalDepositPerAssignment[r.assignment_id] = (totalDepositPerAssignment[r.assignment_id] || 0) + depositPaid;
    }
  });

  const statusMap: Record<string, any> = {};

  (assignments || []).forEach((a: any) => {
    const assignmentRevisions = revisionsMap.get(a.id) || [];
    const baseRent = getExpectedRentForMonth(a, filterMonth, filterYear, assignmentRevisions);
    const gstRate = Number(a.gst_rate ?? 18);
    const tdsRate = Number(a.tds_rate ?? 10);
    const expected = computeNetPayable(baseRent, gstRate, tdsRate);
    const paidAmount = paidPerAssignment[a.id] || 0;
    const fullyPaid = paidAmount >= expected;

    // CUMULATIVE BALANCE CALCULATION
    // Full current calendar month is always due on the 1st, regardless of lease anniversary day.
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const expectedMonths = getExpectedMonths(a.lease_start, a.lease_end, currentMonth, currentYear);

    let totalExpectedAllTime = 0;
    expectedMonths.forEach(em => {
      const baseRentForMonth = getExpectedRentForMonth(a, em.month, em.year, assignmentRevisions);
      totalExpectedAllTime += computeNetPayable(baseRentForMonth, gstRate, tdsRate);
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
      totalDepositPaid: totalDepositPerAssignment[a.id] || 0
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
