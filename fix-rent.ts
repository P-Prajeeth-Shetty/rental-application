import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oaafrqjsoiqimdvunmhk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYWZycWpzb2lxaW1kdnVubWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDk2NjAsImV4cCI6MjEwMTEyNTY2MH0.3dbP8GV4jl7LyTswos1EJGqRp_oOdv2JTCVxtSZrmho';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: assignments, error: fetchError } = await supabaseClient
    .from('tenant_assignments')
    .select('id, current_rent, lease_start')
    .eq('status', 'active');

  if (fetchError) throw fetchError;

  const { data: revisionsData, error: revErr } = await supabaseClient
    .from('rent_revisions')
    .select('assignment_id, effective_from')
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
  now.setHours(0, 0, 0, 0);

  const revisionsToInsert = [];
  const assignmentsToUpdate = [];

  for (const a of (assignments || [])) {
    if (!a.lease_start || !a.current_rent) continue;

    const revs = revisionsMap.get(a.id) || [];
    let baseDateStr = a.lease_start;
    if (revs.length > 0) {
      baseDateStr = revs[0].effective_from;
    }

    let currentRentSim = a.current_rent;
    if (revs.length > 0 && revs[0].new_rent) {
      currentRentSim = revs[0].new_rent;
    }

    let baseDate = new Date(baseDateStr);
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      const nextIncreaseDate = new Date(baseDate);
      nextIncreaseDate.setMonth(nextIncreaseDate.getMonth() + 10);

      const alreadyIncreased = revs.some(r => {
        const revDate = new Date(r.effective_from);
        revDate.setHours(0, 0, 0, 0);
        return revDate.getTime() === nextIncreaseDate.getTime();
      });

      if (!alreadyIncreased) {
        const newRent = Math.round((currentRentSim * 1.05) * 100) / 100;
        
        revisionsToInsert.push({
          assignment_id: a.id,
          previous_rent: currentRentSim,
          new_rent: newRent,
          effective_from: nextIncreaseDate.toISOString().split('T')[0]
        });

        if (now >= nextIncreaseDate) {
          assignmentsToUpdate.push({
            id: a.id,
            new_rent: newRent
          });
        }

        currentRentSim = newRent;
        revs.push({ effective_from: nextIncreaseDate.toISOString(), new_rent: newRent });
      }
      
      baseDate = new Date(nextIncreaseDate);
    }
  }

  if (revisionsToInsert.length > 0) {
    const { error: insertErr } = await supabaseClient
      .from('rent_revisions')
      .insert(revisionsToInsert);
    
    if (insertErr) throw insertErr;

    for (const update of assignmentsToUpdate) {
      await supabaseClient
        .from('tenant_assignments')
        .update({ current_rent: update.new_rent })
        .eq('id', update.id);
    }
    console.log(`Successfully generated ${revisionsToInsert.length} future rent revisions!`);
  } else {
    console.log('No new revisions needed.');
  }
}

run().catch(console.error);
