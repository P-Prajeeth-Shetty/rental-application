-- 1. Add receipt_url to payment tables
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.maintenance_charges ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.outgoing_payments ADD COLUMN IF NOT EXISTS receipt_url text;

-- 2. Create payment_receipts bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment_receipts', 'payment_receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Setup RLS policies for payment_receipts bucket
CREATE POLICY "Authenticated users can upload payment receipts."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'payment_receipts' );

CREATE POLICY "Authenticated users can view payment receipts."
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'payment_receipts' );
