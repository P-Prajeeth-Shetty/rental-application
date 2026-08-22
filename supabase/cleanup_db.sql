-- ============================================================
-- DB CLEANUP SCRIPT
-- Deletes ALL data from every table EXCEPT:
--   ✅ auth.users (kept)
--   ✅ user_roles (kept)
--   ✅ profiles  (kept)
-- 
-- Run this via Supabase SQL Editor with service_role/admin access.
-- ============================================================

BEGIN;

-- ── 1. Child tables first (FK dependencies) ──────────────────

-- Maintenance (charges → bills)
DELETE FROM public.maintenance_charges;
DELETE FROM public.maintenance_bills;

-- Rent revisions
DELETE FROM public.rent_revisions;

-- Payments & uploads
DELETE FROM public.payments;
DELETE FROM public.payment_uploads;

-- Tenant assignments (after payments & revisions are gone)
DELETE FROM public.tenant_assignments;

-- Tenants
DELETE FROM public.tenants;

-- Expenses
DELETE FROM public.expenses;

-- Leased side (revisions → outgoing → agreements → properties → landlords)
DELETE FROM public.lease_rent_revisions;
DELETE FROM public.outgoing_payments;
DELETE FROM public.lease_agreements;
DELETE FROM public.leased_properties;
DELETE FROM public.landlords;

-- Properties (after all FK children are gone)
DELETE FROM public.properties;

-- Reminders & Notebooks (user-scoped, but data is test data)
DELETE FROM public.reminders;
DELETE FROM public.notebooks;

-- Audit logs
DELETE FROM public.audit_logs;

COMMIT;

-- ✅ Done. auth.users, user_roles, and profiles are untouched.
