import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { welcomeEmail } from "./templates/welcomeEmail.ts";
import { assignmentEmail } from "./templates/assignmentEmail.ts";
import { rentDueEmail } from "./templates/rentDueEmail.ts";
import { receiptEmail } from "./templates/receiptEmail.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('NOTIFICATION_FROM_EMAIL');
  const fromName = Deno.env.get('NOTIFICATION_FROM_NAME') || 'Rental Management';

  if (!apiKey || !fromEmail) {
    throw new Error('RESEND_API_KEY / NOTIFICATION_FROM_EMAIL secrets are not configured');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }

  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { event, ...data } = await req.json();

    let to: string | null = null;
    let template: { subject: string; html: string } | null = null;

    switch (event) {
      case 'tenant_created': {
        const { data: tenant, error } = await supabaseClient
          .from('tenants')
          .select('full_name, email')
          .eq('id', data.tenant_id)
          .single();
        if (error) throw error;

        to = tenant?.email ?? null;
        if (to) {
          template = welcomeEmail({ tenantName: tenant.full_name });
        }
        break;
      }

      case 'property_assigned': {
        const { data: assignment, error } = await supabaseClient
          .from('tenant_assignments')
          .select('unit_number, current_rent, lease_start, tenants(full_name, email), properties(name, address)')
          .eq('id', data.assignment_id)
          .single();
        if (error) throw error;

        to = assignment?.tenants?.email ?? null;
        if (to) {
          template = assignmentEmail({
            tenantName: assignment.tenants.full_name,
            propertyName: assignment.properties?.name ?? '',
            propertyAddress: assignment.properties?.address ?? '',
            unitNumber: assignment.unit_number,
            rent: assignment.current_rent,
            leaseStart: assignment.lease_start,
          });
        }
        break;
      }

      case 'payment_received': {
        const { data: payment, error } = await supabaseClient
          .from('payments')
          .select('amount, payment_date, payment_method, period_month, period_year, tenant_assignments(unit_number, tenants(full_name, email), properties(name))')
          .eq('id', data.payment_id)
          .single();
        if (error) throw error;

        const assignment = payment?.tenant_assignments;
        to = assignment?.tenants?.email ?? null;
        if (to) {
          template = receiptEmail({
            tenantName: assignment.tenants.full_name,
            amount: payment.amount,
            paymentMethod: payment.payment_method,
            paymentDate: payment.payment_date,
            periodMonth: payment.period_month,
            periodYear: payment.period_year,
            propertyName: assignment.properties?.name ?? '',
            unitNumber: assignment.unit_number,
          });
        }
        break;
      }

      case 'rent_due_reminder': {
        const { data: assignment, error } = await supabaseClient
          .from('tenant_assignments')
          .select('unit_number, current_rent, tenants(full_name, email), properties(name)')
          .eq('id', data.assignment_id)
          .single();
        if (error) throw error;

        to = assignment?.tenants?.email ?? null;
        if (to) {
          template = rentDueEmail({
            tenantName: assignment.tenants.full_name,
            propertyName: assignment.properties?.name ?? '',
            unitNumber: assignment.unit_number,
            amount: data.amount ?? assignment.current_rent,
            dueDate: data.due_date,
          });
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    if (!to || !template) {
      return new Response(JSON.stringify({ skipped: true, reason: 'No recipient email on file' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const result = await sendViaResend(to, template.subject, template.html);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('send-notification error:', error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
