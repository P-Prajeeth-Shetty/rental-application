-- Fix Supabase Advisor Critical Security Issue: Security Definer View
-- This alters the tenant_credit_balance view to use security_invoker = true.
-- This ensures the view respects the Row Level Security (RLS) policies of the user querying it,
-- rather than bypassing RLS by running as the creator of the view.

ALTER VIEW public.tenant_credit_balance SET (security_invoker = on);
