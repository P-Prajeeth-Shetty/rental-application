import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadTenantDocument } from '../lib/storageUtils';

export interface Tenant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  emergency_contact: string | null;
  notes: string | null;
  id_proof_url: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  unit_number: string;
  current_rent: number;
  lease_start: string;
  lease_end: string | null;
  security_deposit: number;
  status: string;
  property_id: string;
  payment_mode?: string;
  due_day?: number;
  grace_days?: number;
  gst_rate?: number;
  tds_rate?: number;
  previous_assignment_id?: string | null;
  transfer_reason?: string | null;
  properties: { id: string; name: string } | null;
  payments?: { amount: number; is_reversed: boolean }[];
  rent_revisions?: { previous_rent: number; new_rent: number; increase_pct: number | null; effective_from: string }[];
}

export interface Property {
  id: string;
  name: string;
  total_units: number;
}

export interface RentRevision {
  id: string;
  previous_rent: number;
  new_rent: number;
  increase_pct: number;
  effective_from: string;
  reason: string | null;
  created_at: string;
}

export interface TenantFormValues {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  id_proof_type: string;
  id_proof_number: string;
  emergency_contact: string;
  notes: string;
}

export interface AssignmentFormValues {
  property_id: string;
  unit_number: string;
  current_rent: string;
  lease_start: string;
  lease_end: string;
  security_deposit: string;
  payment_mode: string;
  due_day: string;
  grace_days: string;
  gst_rate: string;
  tds_rate: string;
}

export interface RentIncreaseFormValues {
  increase_pct: string;
  new_rent: string;
  effective_from: string;
  reason: string;
}

export interface TransferFormValues {
  property_id: string;
  unit_number: string;
  current_rent: string;
  security_deposit: string;
  lease_end: string;
  payment_mode: string;
  due_day: string;
  grace_days: string;
  gst_rate: string;
  tds_rate: string;
  transfer_date: string;
  reason: string;
}

export interface RevisionEditFormValues {
  increase_pct: string;
  new_rent: string;
  effective_from: string;
}

// Encapsulates every Supabase read/write TenantsView needs: fetching tenants,
// their assignments and properties, and every CRUD/RPC operation that
// mutates them. The view owns UI-only state (which modal is open, form
// field values, search/filter, expanded rows); this hook owns persistence.
export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, Assignment[]>>({});
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: tData, error: tErr }, { data: aData, error: aErr }, { data: pData, error: pErr }] = await Promise.all([
        supabase.from('tenants').select('*').order('created_at', { ascending: false }),
        supabase.from('tenant_assignments').select('*, properties(id, name), payments(amount, is_reversed), rent_revisions(previous_rent, new_rent, increase_pct, effective_from)').order('created_at', { ascending: false }),
        supabase.from('properties').select('id, name, total_units'),
      ]);
      if (tErr) throw tErr;
      if (aErr) throw aErr;
      if (pErr) throw pErr;

      setTenants(tData || []);
      setProperties(pData || []);

      const map: Record<string, Assignment[]> = {};
      (aData || []).forEach((a: any) => {
        if (!map[a.tenant_id]) map[a.tenant_id] = [];
        map[a.tenant_id].push(a);
      });
      setAssignmentsMap(map);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Tenant CRUD ───────────────────────────────────────────────────────────

  const saveTenant = useCallback(async (mode: 'create' | 'edit', form: TenantFormValues, idProofFile: File | null) => {
    let id_proof_url: string | undefined = undefined;
    if (idProofFile) {
      id_proof_url = await uploadTenantDocument(idProofFile);
    }

    const payload: any = {
      full_name: form.full_name,
      email: form.email || null, phone: form.phone || null,
      id_proof_type: form.id_proof_type || null, id_proof_number: form.id_proof_number || null,
      emergency_contact: form.emergency_contact || null, notes: form.notes || null,
    };

    if (id_proof_url !== undefined) {
      payload.id_proof_url = id_proof_url;
    }

    if (mode === 'create') {
      const { error: err } = await supabase.from('tenants').insert([payload]);
      if (err) throw err;
    } else {
      const { error: err } = await supabase.from('tenants').update(payload).eq('id', form.id);
      if (err) throw err;
    }
    await fetchAll();
  }, [fetchAll]);

  const deleteTenant = useCallback(async (tenant: Tenant) => {
    const hasAssignments = (assignmentsMap[tenant.id] || []).length > 0;
    if (hasAssignments) {
      throw new Error("Cannot delete a tenant who has assignment history. Please use the 'Vacate' feature on their property assignment instead to preserve payment data.");
    }
    const { error: err } = await supabase.from('tenants').delete().eq('id', tenant.id);
    if (err) throw err;
    await fetchAll();
  }, [assignmentsMap, fetchAll]);

  // ── Assign to Property ────────────────────────────────────────────────────

  const saveAssignment = useCallback(async (form: AssignmentFormValues, tenantId: string, editAssignmentId: string | null) => {
    const payload = {
      property_id: form.property_id,
      unit_number: form.unit_number,
      current_rent: parseFloat(form.current_rent) || 0,
      lease_start: form.lease_start,
      lease_end: form.lease_end || null,
      security_deposit: parseFloat(form.security_deposit) || 0,
      payment_mode: form.payment_mode,
      due_day: parseInt(form.due_day) || 1,
      grace_days: parseInt(form.grace_days) || 5,
      gst_rate: parseFloat(form.gst_rate) || 0,
      tds_rate: parseFloat(form.tds_rate) || 0
    };

    if (editAssignmentId) {
      const { error: err } = await supabase.from('tenant_assignments').update(payload).eq('id', editAssignmentId);
      if (err) throw err;

      // When editing (e.g. correcting lease_start), purge all automated
      // revisions so the auto-rent-increase function can rebuild them from
      // the updated start date. Manual revisions (those with a non-null
      // reason) are preserved.
      await supabase.from('rent_revisions')
        .delete()
        .eq('assignment_id', editAssignmentId)
        .is('reason', null);
    } else {
      const { error: err } = await supabase.from('tenant_assignments').insert([{ ...payload, tenant_id: tenantId, status: 'active' }]);
      if (err) throw err;
    }

    // Trigger automated projections for the new/edited assignment
    await supabase.functions.invoke('auto-rent-increase');

    await fetchAll();
  }, [fetchAll]);

  // ── Rent Increase ─────────────────────────────────────────────────────────

  const applyRentIncrease = useCallback(async (assignment: Assignment, form: RentIncreaseFormValues) => {
    const pct = parseFloat(form.increase_pct);
    const newRent = parseFloat(form.new_rent);

    const actualPct = isNaN(pct) ? null : pct;
    const actualNewRent = isNaN(newRent) ? assignment.current_rent : newRent;

    const { error: revErr } = await supabase.from('rent_revisions').insert([{
      assignment_id: assignment.id,
      previous_rent: assignment.current_rent,
      new_rent: actualNewRent,
      increase_pct: actualPct,
      effective_from: form.effective_from,
      reason: form.reason || null,
      created_by: (await supabase.auth.getUser()).data.user?.id || null,
    }]);
    if (revErr) throw revErr;

    // Only update current rent immediately if effective date is today or in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const effectiveDate = new Date(form.effective_from);
    effectiveDate.setHours(0, 0, 0, 0);

    if (effectiveDate <= today) {
      const { error: updErr } = await supabase.from('tenant_assignments').update({ current_rent: actualNewRent }).eq('id', assignment.id);
      if (updErr) throw updErr;
    }

    // Delete subsequent automated revisions so they can be re-projected from the new baseline
    await supabase.from('rent_revisions')
      .delete()
      .eq('assignment_id', assignment.id)
      .gt('effective_from', form.effective_from)
      .is('reason', null);

    // Instantly trigger re-calculation
    await supabase.functions.invoke('auto-rent-increase');

    await fetchAll();
  }, [fetchAll]);

  // ── Vacate Assignment ─────────────────────────────────────────────────────

  const vacateAssignment = useCallback(async (assignmentId: string, vacateDate: string) => {
    const { error: err } = await supabase.from('tenant_assignments').update({
      status: 'vacated',
      lease_end: vacateDate
    }).eq('id', assignmentId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── Transfer to Another Property ──────────────────────────────────────────

  const transferAssignment = useCallback(async (oldAssignmentId: string, form: TransferFormValues) => {
    const { error: err } = await supabase.rpc('transfer_tenant_assignment', {
      p_old_assignment_id: oldAssignmentId,
      p_transfer_date: form.transfer_date,
      p_new_property_id: form.property_id,
      p_new_unit_number: form.unit_number,
      p_new_rent: parseFloat(form.current_rent) || 0,
      p_new_deposit: parseFloat(form.security_deposit) || 0,
      p_new_lease_end: form.lease_end || null,
      p_payment_mode: form.payment_mode,
      p_due_day: parseInt(form.due_day) || 1,
      p_grace_days: parseInt(form.grace_days) || 5,
      p_gst_rate: parseFloat(form.gst_rate) || 0,
      p_tds_rate: parseFloat(form.tds_rate) || 0,
      p_reason: form.reason || null,
    });
    if (err) throw err;

    // Trigger automated projections for the transferred assignment
    await supabase.functions.invoke('auto-rent-increase');

    await fetchAll();
  }, [fetchAll]);

  // ── Rent Revision History ─────────────────────────────────────────────────
  // Note: editing/deleting a single revision intentionally does NOT refetch
  // the full tenants/assignments list below (matching prior behavior) —
  // callers should re-fetch just the revisions list for the open drawer via
  // fetchRevisions() afterward.

  const fetchRevisions = useCallback(async (assignmentId: string): Promise<RentRevision[]> => {
    const { data } = await supabase.from('rent_revisions').select('*').eq('assignment_id', assignmentId).order('effective_from', { ascending: false });
    return data || [];
  }, []);

  const saveRevisionEdit = useCallback(async (revId: string, previousRent: number, form: RevisionEditFormValues, assignmentId: string) => {
    const pct = parseFloat(form.increase_pct);
    const newRent = parseFloat(form.new_rent);
    const { error: err } = await supabase.from('rent_revisions').update({
      increase_pct: isNaN(pct) ? null : pct,
      new_rent: isNaN(newRent) ? previousRent : newRent,
      effective_from: form.effective_from
    }).eq('id', revId);
    if (err) throw err;

    // Delete subsequent automated revisions so they can be re-projected from the new baseline
    await supabase.from('rent_revisions')
      .delete()
      .eq('assignment_id', assignmentId)
      .gt('effective_from', form.effective_from)
      .is('reason', null);

    // Instantly trigger re-calculation
    await supabase.functions.invoke('auto-rent-increase');
  }, []);

  const deleteRevision = useCallback(async (revId: string, effectiveFrom: string, assignmentId: string) => {
    const { error: err } = await supabase.from('rent_revisions').delete().eq('id', revId);
    if (err) throw err;

    // Delete subsequent automated revisions so they can be re-projected from the new baseline
    await supabase.from('rent_revisions')
      .delete()
      .eq('assignment_id', assignmentId)
      .gt('effective_from', effectiveFrom)
      .is('reason', null);

    // Instantly trigger re-calculation
    await supabase.functions.invoke('auto-rent-increase');
  }, []);

  return {
    tenants, assignmentsMap, properties, isLoading, error, setError,
    refetch: fetchAll,
    saveTenant, deleteTenant,
    saveAssignment,
    applyRentIncrease,
    vacateAssignment,
    transferAssignment,
    fetchRevisions, saveRevisionEdit, deleteRevision,
  };
}
