-- ============================================================
-- Migration: Add payment_id to maintenance_charges
-- ============================================================

ALTER TABLE public.maintenance_charges
ADD COLUMN payment_id uuid references public.payments(id) on delete set null;
