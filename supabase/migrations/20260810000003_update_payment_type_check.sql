-- ============================================================
-- Migration: Allow 'maintenance' in payments.payment_type
-- ============================================================

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;

ALTER TABLE public.payments ADD CONSTRAINT payments_payment_type_check 
CHECK (payment_type = ANY (ARRAY['rent'::text, 'security_deposit'::text, 'advance'::text, 'adjustment'::text, 'penalty'::text, 'maintenance'::text]));
