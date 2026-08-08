import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifyAdmin(supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw { status: 401, message: 'Missing authorization header' };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) throw { status: 401, message: 'Invalid or expired token' };

  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles').select('role').eq('user_id', user.id).single();
  if (roleError || roleData?.role !== 'admin') throw { status: 403, message: 'Forbidden: Admins only' };

  return user;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!serviceRoleKey) throw { status: 500, message: 'SERVICE_ROLE_KEY is not set' };

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);

    const adminUser = await verifyAdmin(supabaseAdmin, req);

    const { email, password, role, full_name, phone_number } = await req.json();

    if (!email || !password || !role) {
      throw { status: 400, message: 'Email, password, and role are required' };
    }

    // Create the auth user
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone_number, email }
    });
    if (createUserError) throw createUserError;

    const newUserId = newUser.user.id;

    // Insert role
    const { error: insertRoleError } = await supabaseAdmin
      .from('user_roles').insert([{ user_id: newUserId, role }]);
    if (insertRoleError) throw insertRoleError;

    // Update profile with email, name, and phone
    try {
      await supabaseAdmin
        .from('profiles')
        .upsert({ id: newUserId, email, full_name: full_name || null, phone_number: phone_number || null });
    } catch (e) {
      // Ignore if email column doesn't exist yet in DB schema
      if (full_name || phone_number) {
        await supabaseAdmin
          .from('profiles')
          .update({ full_name: full_name || null, phone_number: phone_number || null })
          .eq('id', newUserId);
      }
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert([{
      admin_id: adminUser.id,
      action: 'user.create',
      target_user_id: newUserId,
      details: { email, role, full_name }
    }]);

    return new Response(JSON.stringify({ success: true, user: newUser.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error: any) {
    const status = error.status || 400;
    const message = error.message || 'An error occurred';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});

