export interface Landlord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  pan_number: string | null;
  gst_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface LeasedProperty {
  id: string;
  landlord_id: string;
  name: string;
  address: string;
  property_type: string;
  total_units: number;
  description: string | null;
  created_at: string;
}

export interface LeaseAgreement {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  security_deposit: number;
  status: 'active' | 'expired' | 'terminated';
  created_at: string;
}

export interface OutgoingPayment {
  id: string;
  agreement_id: string;
  amount: number;
  payment_type: 'rent' | 'deposit' | 'other';
  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;
  period_month: number | null;
  period_year: number | null;
  status: 'paid' | 'pending' | 'failed';
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface LeaseRentRevision {
  id: string;
  agreement_id: string;
  previous_rent: number;
  new_rent: number;
  increase_pct: number | null;
  effective_from: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}
