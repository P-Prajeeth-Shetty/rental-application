import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Rent is always due on the 1st of the month, regardless of payment_mode/due_day
    // (see supabase/functions/_shared/rentCalc.ts computeDueDate).
    const nextMonthFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysUntilDue = Math.round((nextMonthFirst.getTime() - now.getTime()) / 86400000);

    if (daysUntilDue !== 3) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: `Not 3 days out (${daysUntilDue} days until next due date)`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const dueMonth = nextMonthFirst.getMonth() + 1;
    const dueYear = nextMonthFirst.getFullYear();
    const dueDateStr = nextMonthFirst.toISOString().split('T')[0];

    const { data: assignments, error: assignErr } = await supabaseClient
      .from('tenant_assignments')
      .select('id, current_rent')
      .eq('status', 'active');
    if (assignErr) throw assignErr;

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ success: true, remindersSent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const assignmentIds = assignments.map((a) => a.id);

    // Skip assignments that already have a paid rent installment for next month's period.
    const { data: paidRows, error: paidErr } = await supabaseClient
      .from('payments')
      .select('assignment_id')
      .in('assignment_id', assignmentIds)
      .eq('period_month', dueMonth)
      .eq('period_year', dueYear)
      .eq('status', 'paid')
      .eq('is_reversed', false);
    if (paidErr) throw paidErr;

    const alreadyPaid = new Set((paidRows || []).map((p) => p.assignment_id));
    const dueAssignments = assignments.filter((a) => !alreadyPaid.has(a.id));

    let remindersSent = 0;
    for (const a of dueAssignments) {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          event: 'rent_due_reminder',
          assignment_id: a.id,
          amount: a.current_rent,
          due_date: dueDateStr,
        }),
      });

      if (res.ok) {
        remindersSent++;
      } else {
        console.error(`Failed to send reminder for assignment ${a.id}:`, await res.text());
      }
    }

    return new Response(JSON.stringify({
      success: true,
      remindersSent,
      totalDue: dueAssignments.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('check-due-reminders error:', error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
