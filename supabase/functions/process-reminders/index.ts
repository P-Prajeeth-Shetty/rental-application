import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function to process due reminders
// This should ideally be triggered by a pg_cron job in the database.

serve(async (req) => {
  try {
    // 1. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need service role to bypass RLS and process all reminders
    )

    // 2. Fetch all pending reminders where due_date is in the past or now
    const now = new Date().toISOString()
    const { data: dueReminders, error: fetchError } = await supabaseClient
      .from('reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('due_date', now)

    if (fetchError) {
      throw fetchError
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending reminders to process." }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    // 3. Process each reminder
    const processedIds = []
    
    for (const reminder of dueReminders) {
      // TODO: Integrate with an Email provider (e.g., Resend, SendGrid) or Push Notification service
      // Example: await sendEmail(reminder.user_id, reminder.title, reminder.description)
      
      console.log(`Processing reminder ${reminder.id} for user ${reminder.user_id}: ${reminder.title}`)

      // Mark as completed so we don't process it again
      const { error: updateError } = await supabaseClient
        .from('reminders')
        .update({ status: 'completed' })
        .eq('id', reminder.id)

      if (updateError) {
        console.error(`Failed to update reminder ${reminder.id}:`, updateError)
      } else {
        processedIds.push(reminder.id)
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Successfully processed ${processedIds.length} reminders.`,
        processedIds 
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error) {
    console.error("Error processing reminders:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    )
  }
})
