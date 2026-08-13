import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaymentMode = 'prepaid' | 'postpaid' | 'advance_on_entry';
type PaymentTiming = 'early' | 'on_time' | 'late' | 'unknown';

function computeDueDate(
  paymentMode: PaymentMode,
  dueDay: number,
  leaseStart: string,
  periodMonth: number,
  periodYear: number,
  isFirstPayment: boolean
): Date {
  // All rent is always due on the 1st of the month
  return new Date(periodYear, periodMonth - 1, 1);
}

function classifyTiming(
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

function computeCredit(amountPaid: number, expectedRent: number): number {
  return amountPaid - expectedRent;
}

function getExpectedRentForMonth(
  assignment: any,
  month: number,
  year: number,
  revisions: any[]
): number {
  let periodStart = new Date(year, month - 1, 1);
  let periodEnd = new Date(year, month, 0); // last day of month

  const leaseStart = new Date(assignment.lease_start);
  
  periodStart.setHours(0,0,0,0);
  periodEnd.setHours(0,0,0,0);
  leaseStart.setHours(0,0,0,0);

  // If lease hasn't started yet in this month
  if (periodStart < leaseStart) {
    if (periodEnd < leaseStart) return 0;
    periodStart = leaseStart;
  }

  // If lease has ended in this month
  if (assignment.lease_end) {
    const leaseEnd = new Date(assignment.lease_end);
    leaseEnd.setHours(0,0,0,0);
    if (periodEnd > leaseEnd) {
      if (periodStart > leaseEnd) return 0;
      periodEnd = leaseEnd;
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  let totalRent = 0;

  for (let d = periodStart.getDate(); d <= periodEnd.getDate(); d++) {
    const currentDate = new Date(year, month - 1, d);
    currentDate.setHours(0,0,0,0);

    let applicableRent = assignment.current_rent;

    if (revisions && revisions.length > 0) {
      const rev = revisions.find(r => {
        const revDate = new Date(r.effective_from);
        revDate.setHours(0,0,0,0);
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

function computeNetPayable(
  baseRent: number,
  gstRate: number,
  tdsRate: number
): { net: number; gstAmount: number; tdsAmount: number } {
  const gstAmount = Math.round(baseRent * gstRate / 100 * 100) / 100;
  const tdsAmount = Math.round(baseRent * tdsRate / 100 * 100) / 100;
  const net = Math.round((baseRent + gstAmount - tdsAmount) * 100) / 100;
  return { net, gstAmount, tdsAmount };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const body = await req.json();
    const { payments: incomingPayments, upload_batch_id } = body;

    if (!Array.isArray(incomingPayments) || incomingPayments.length === 0) {
      throw new Error("No payments provided.");
    }

    // Get all distinct assignment IDs
    const assignmentIds = [...new Set(incomingPayments.map(p => p.assignment_id))];

    // Fetch assignments
    const { data: assignmentsData, error: aErr } = await supabaseClient
      .from('tenant_assignments')
      .select('id, current_rent, payment_mode, due_day, grace_days, lease_start, gst_rate, tds_rate')
      .in('id', assignmentIds);

    if (aErr) throw aErr;
    const assignmentsMap = new Map(assignmentsData?.map(a => [a.id, a]) || []);

    // Fetch existing payments to correctly calculate cumulative partial payments
    const { data: existingPaymentsData, error: pErr } = await supabaseClient
      .from('payments')
      .select('assignment_id, amount, period_month, period_year, is_reversed')
      .in('assignment_id', assignmentIds)
      .eq('is_reversed', false);

    if (pErr) throw pErr;
    const existingPayments = existingPaymentsData || [];

    // Fetch rent revisions to calculate historical expected rent
    const { data: revisionsData, error: revErr } = await supabaseClient
      .from('rent_revisions')
      .select('assignment_id, previous_rent, new_rent, effective_from')
      .in('assignment_id', assignmentIds)
      .order('effective_from', { ascending: false });

    if (revErr) throw revErr;
    const revisionsMap = new Map();
    (revisionsData || []).forEach(r => {
      if (!revisionsMap.has(r.assignment_id)) {
        revisionsMap.set(r.assignment_id, []);
      }
      revisionsMap.get(r.assignment_id).push(r);
    });

    const allPayloads = [];

    for (const p of incomingPayments) {
      const assignment = assignmentsMap.get(p.assignment_id);
      if (!assignment) continue;

      const assignmentRevisions = revisionsMap.get(assignment.id) || [];
      let remainingAmount = parseFloat(p.amount);
      if (isNaN(remainingAmount) || remainingAmount <= 0) continue;

      const existingPays = existingPayments.filter(ep => ep.assignment_id === assignment.id);
      
      if (p.payment_type && p.payment_type !== 'rent') {
        const pDate = new Date(p.payment_date);
        allPayloads.push({
          assignment_id: p.assignment_id,
          amount: remainingAmount,
          payment_date: p.payment_date,
          payment_method: p.payment_method || null,
          period_month: pDate.getMonth() + 1,
          period_year: pDate.getFullYear(),
          reference_number: p.reference_number || null,
          notes: p.notes || null,
          status: 'paid',
          payment_type: p.payment_type,
          payment_timing: 'on_time',
          days_late: 0,
          credit_amount: 0,
          expected_amount: remainingAmount,
          upload_batch_id: upload_batch_id || null,
          gst_amount: 0,
          tds_amount: 0
        });
        continue;
      }

      // Calculate months elapsed since lease start
      const start = new Date(assignment.lease_start);
      let currentMonth = start.getMonth() + 1;
      let currentYear = start.getFullYear();
      let isFirstPayment = existingPays.length === 0 && allPayloads.filter(ap => ap.assignment_id === assignment.id).length === 0;

      let loopCount = 0;
      while (remainingAmount > 0.01 && loopCount < 120) { // Safety break after 10 years
        loopCount++;

        // Sum existing payments for this exact month
        const existingPaysForMonth = existingPays.filter(ep => ep.period_month === currentMonth && ep.period_year === currentYear);
        const alreadyPaidForMonth = existingPaysForMonth.reduce((sum, ep) => sum + Number(ep.amount), 0);
        
        const newlyAddedForMonth = allPayloads.filter(ap => ap.assignment_id === assignment.id && ap.period_month === currentMonth && ap.period_year === currentYear);
        const newlyPaidForMonth = newlyAddedForMonth.reduce((sum, ap) => sum + Number(ap.amount), 0);

        const totalPaidSoFarForMonth = alreadyPaidForMonth + newlyPaidForMonth;
        
        const baseRentForMonth = getExpectedRentForMonth(assignment, currentMonth, currentYear, assignmentRevisions);
        const gstRate = Number(assignment.gst_rate ?? 18);
        const tdsRate = Number(assignment.tds_rate ?? 10);
        const { net: expectedAmountForMonth, gstAmount, tdsAmount } = computeNetPayable(baseRentForMonth, gstRate, tdsRate);
        
        // If this month is already fully paid, move to next month
        if (totalPaidSoFarForMonth >= expectedAmountForMonth) {
          currentMonth++;
          if (currentMonth > 12) { currentMonth = 1; currentYear++; }
          isFirstPayment = false;
          continue;
        }

        // Amount needed to fully pay off this month
        const amountNeeded = expectedAmountForMonth - totalPaidSoFarForMonth;
        
        // Amount we will apply to this month
        const amountToApply = Math.min(amountNeeded, remainingAmount);
        // Round to 2 decimal places to avoid floating point issues
        const roundedAmountToApply = Math.round(amountToApply * 100) / 100;

        const dueDate = computeDueDate(
          assignment.payment_mode || 'prepaid',
          assignment.due_day || 1,
          assignment.lease_start,
          currentMonth, currentYear, isFirstPayment
        );

        const { timing, daysLate } = classifyTiming(p.payment_date, dueDate, assignment.grace_days || 5);

        const newTotalPaidForMonth = totalPaidSoFarForMonth + roundedAmountToApply;
        const creditAmount = computeCredit(newTotalPaidForMonth, expectedAmountForMonth);
        const status = newTotalPaidForMonth >= expectedAmountForMonth ? 'paid' : 'partial';

        allPayloads.push({
          assignment_id: p.assignment_id,
          amount: roundedAmountToApply,
          payment_date: p.payment_date,
          payment_method: p.payment_method || null,
          period_month: currentMonth,
          period_year: currentYear,
          reference_number: p.reference_number || null,
          notes: p.notes || null,
          status: status,
          payment_type: isFirstPayment ? (p.payment_type || 'rent') : 'rent', // or advance if future? Keep simple
          payment_timing: timing,
          days_late: daysLate,
          credit_amount: creditAmount,
          expected_amount: expectedAmountForMonth,
          upload_batch_id: upload_batch_id || null,
          gst_amount: gstAmount,
          tds_amount: tdsAmount
        });

        remainingAmount -= roundedAmountToApply;
        
        if (newTotalPaidForMonth >= expectedAmountForMonth) {
          currentMonth++;
          if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        }
        isFirstPayment = false;
      }
    }

    const { error: insertErr } = await supabaseClient.from('payments').insert(allPayloads);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ success: true, count: allPayloads.length }), {
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
