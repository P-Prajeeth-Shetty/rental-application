-- Add id_proof_url column to tenants table
-- This column stores the storage path of the uploaded ID proof document

alter table public.tenants
  add column if not exists id_proof_url text;
