import { supabase } from './supabase';

export async function uploadPaymentReceipt(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from('payment_receipts')
    .upload(filePath, file);

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  return data.path;
}

export async function getPaymentReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('payment_receipts')
    .createSignedUrl(path, 60 * 60); // 1 hour expiry

  if (error || !data) {
    throw new Error(`Failed to generate receipt URL: ${error?.message}`);
  }

  return data.signedUrl;
}

