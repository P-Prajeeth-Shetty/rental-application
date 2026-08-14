-- 1. Add id_proof_url column to tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS id_proof_url text;

-- 2. Create tenant_documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant_documents', 'tenant_documents', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS for tenant_documents
-- Allow authenticated users to view tenant_documents
CREATE POLICY "Authenticated users can view tenant_documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant_documents' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to upload tenant_documents
CREATE POLICY "Authenticated users can upload tenant_documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tenant_documents' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update tenant_documents
CREATE POLICY "Authenticated users can update tenant_documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tenant_documents' AND auth.uid() IS NOT NULL);
