-- Add update and delete policies to rent_revisions table
create policy "Admins can update rent revisions"
  on public.rent_revisions for update using (public.is_admin()) with check (public.is_admin());

create policy "Admins can delete rent revisions"
  on public.rent_revisions for delete using (public.is_admin());
