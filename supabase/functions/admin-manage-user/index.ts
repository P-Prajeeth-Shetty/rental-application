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

    const body = await req.json();
    const { action, target_user_id } = body;

    if (!action) {
      throw { status: 400, message: 'action is required' };
    }

    // ----------------------------------------------------------------
    // ACTION: list — list all auth users with email + profiles + roles
    // ----------------------------------------------------------------
    if (action === 'list') {
      const { data: { users: authUsers }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
      if (authErr) throw authErr;

      const [{ data: rolesData }, { data: profilesData }] = await Promise.all([
        supabaseAdmin.from('user_roles').select('user_id, role, created_at'),
        supabaseAdmin.from('profiles').select('id, full_name, phone_number, bio, avatar_url'),
      ]);

      const rolesMap = new Map((rolesData || []).map((r: any) => [r.user_id, r]));
      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const userList = authUsers.map((u: any) => ({
        user_id: u.id,
        email: u.email,
        role: rolesMap.get(u.id)?.role || 'user',
        created_at: u.created_at,
        profiles: profilesMap.get(u.id) || null,
      }));

      return new Response(JSON.stringify({ users: userList }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Verify caller is admin for modifying actions (edit, delete, change_password)
    const adminUser = await verifyAdmin(supabaseAdmin, req);

    if (!target_user_id) {
      throw { status: 400, message: 'target_user_id is required' };
    }
    if (action === 'edit') {
      const { full_name, phone_number, bio, role } = body;

      // Update profile fields
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: full_name ?? null,
          phone_number: phone_number ?? null,
          bio: bio ?? null,
        })
        .eq('id', target_user_id);

      if (profileError) throw profileError;

      // Update role if provided
      if (role) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', target_user_id);

        if (roleError) throw roleError;
      }

      // Audit log
      await supabaseAdmin.from('audit_logs').insert([{
        admin_id: adminUser.id,
        action: 'user.edit',
        target_user_id,
        details: { full_name, phone_number, bio, role }
      }]);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ----------------------------------------------------------------
    // ACTION: delete — remove user from auth (cascades everything)
    // ----------------------------------------------------------------
    if (action === 'delete') {
      // Prevent admin from deleting themselves
      if (target_user_id === adminUser.id) {
        throw { status: 400, message: 'You cannot delete your own account' };
      }

      // Get user info for audit log before deleting
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(target_user_id);

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
      if (deleteError) throw deleteError;

      // Audit log
      await supabaseAdmin.from('audit_logs').insert([{
        admin_id: adminUser.id,
        action: 'user.delete',
        target_user_id: null, // user is gone, foreign key would fail
        details: { deleted_user_email: targetUser?.user?.email, deleted_user_id: target_user_id }
      }]);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ----------------------------------------------------------------
    // ACTION: change_password — update auth user password
    // ----------------------------------------------------------------
    if (action === 'change_password') {
      const { new_password } = body;

      if (!new_password || new_password.length < 6) {
        throw { status: 400, message: 'Password must be at least 6 characters' };
      }

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        password: new_password,
      });
      if (pwError) throw pwError;

      // Audit log
      await supabaseAdmin.from('audit_logs').insert([{
        admin_id: adminUser.id,
        action: 'password.change',
        target_user_id,
        details: { note: 'Password was changed by admin' }
      }]);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw { status: 400, message: `Unknown action: ${action}` };

  } catch (error: any) {
    const status = error.status || 400;
    const message = error.message || 'An error occurred';
    console.error('admin-manage-user error:', message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});
