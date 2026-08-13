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
    // 1. Initialize Supabase client with service role key to bypass RLS for automated jobs
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'PATCH') {
      const { data, error } = await supabaseClient
        .from('rent_revisions')
        .update({ increase_pct: 5 })
        .is('increase_pct', null);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, message: "Fixed NULL percentages" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 2. Fetch all active tenant assignments
    const { data: assignments, error: fetchError } = await supabaseClient
      .from('tenant_assignments')
      .select('id, current_rent, lease_start')
      .eq('status', 'active');

    if (fetchError) throw fetchError;

    // 3. Fetch all rent revisions to find the latest increase date
    const { data: revisionsData, error: revErr } = await supabaseClient
      .from('rent_revisions')
      .select('assignment_id, effective_from, new_rent')
      .order('effective_from', { ascending: false });

    if (revErr) throw revErr;

    const revisionsMap = new Map<string, any[]>();
    (revisionsData || []).forEach(r => {
      if (!revisionsMap.has(r.assignment_id)) {
        revisionsMap.set(r.assignment_id, []);
      }
      revisionsMap.get(r.assignment_id)!.push(r);
    });

    const now = new Date();
    // Reset time for accurate date comparisons
    now.setHours(0, 0, 0, 0);

    const revisionsToInsert: any[] = [];
    const assignmentsToUpdate: { id: string, new_rent: number }[] = [];

    // 4. Process each assignment
    for (const a of (assignments || [])) {
      if (!a.lease_start || !a.current_rent) continue;

      const revs = revisionsMap.get(a.id) || [];
      
      let baseDateStr = a.lease_start;
      let currentRentSim = a.current_rent;
      
      if (revs.length > 0) {
        baseDateStr = revs[0].effective_from;
        currentRentSim = revs[0].new_rent;
      }

      let baseDate = new Date(baseDateStr);
      baseDate.setHours(0, 0, 0, 0);

      // Project into the future, up to 2 years from today
      const maxFutureDate = new Date(now);
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);

      while (baseDate < maxFutureDate) {
        const nextIncreaseDate = new Date(baseDate);
        nextIncreaseDate.setMonth(nextIncreaseDate.getMonth() + 10);
        
        const nextStr = nextIncreaseDate.toISOString().split('T')[0];

        // Prevent duplicate increase for this exact date
        const alreadyIncreased = revs.some(r => {
          return r.effective_from.split('T')[0] === nextStr;
        });

        if (!alreadyIncreased) {
          const newRent = Math.round((currentRentSim * 1.05) * 100) / 100;
          
          revisionsToInsert.push({
            assignment_id: a.id,
            previous_rent: currentRentSim,
            new_rent: newRent,
            increase_pct: 5,
            effective_from: nextStr
          });

          // If the increase is today or in the past, update the current_rent on assignment
          if (now >= nextIncreaseDate) {
            assignmentsToUpdate.push({
              id: a.id,
              new_rent: newRent
            });
          }

          currentRentSim = newRent; // Cascade for next iteration
          revs.push({ effective_from: nextIncreaseDate.toISOString(), new_rent: newRent });
        } else {
          // Cascade even if already exists so subsequent iterations are correct
          currentRentSim = Math.round((currentRentSim * 1.05) * 100) / 100;
        }
        
        baseDate = new Date(nextIncreaseDate); // Next increase starts from this new date
      }
    }

    let processedCount = 0;

    // 5. Execute database updates
    if (revisionsToInsert.length > 0) {
      const { error: insertErr } = await supabaseClient
        .from('rent_revisions')
        .insert(revisionsToInsert);
      
      if (insertErr) throw insertErr;

      // Update current_rent on assignments
      for (const update of assignmentsToUpdate) {
        const { error: updateErr } = await supabaseClient
          .from('tenant_assignments')
          .update({ current_rent: update.new_rent })
          .eq('id', update.id);
        
        if (updateErr) console.error(`Failed to update rent for ${update.id}:`, updateErr);
      }
      processedCount = revisionsToInsert.length;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${processedCount} rent increases.`,
      processedCount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Auto-rent-increase error:", error);
    return new Response(JSON.stringify({ error: String(error), details: error }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
