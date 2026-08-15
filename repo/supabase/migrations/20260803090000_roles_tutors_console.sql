-- Extend the original binary enum without breaking policies created by earlier migrations.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';
UPDATE public.user_roles SET role = 'staff' WHERE role = 'admin';
UPDATE public.user_roles SET role = 'student' WHERE role = 'user';

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_staff_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'staff')
  );
$$;

DROP POLICY IF EXISTS "own_roles_read" ON public.user_roles;
CREATE POLICY "own_roles_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'owner'));

-- Tutor configuration is staff-managed and is intentionally data-driven.
CREATE TABLE public.tutors (
  id TEXT PRIMARY KEY,
  subject_label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'BookOpen',
  system_prompt_overlay TEXT NOT NULL,
  color_accent TEXT NOT NULL DEFAULT '#b8872f',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tutors TO authenticated;
GRANT ALL ON public.tutors TO service_role;
CREATE POLICY "active_tutors_read" ON public.tutors FOR SELECT TO authenticated USING (is_active OR public.has_any_staff_role(auth.uid()));
CREATE POLICY "staff_tutors_write" ON public.tutors FOR ALL TO authenticated
  USING (public.has_any_staff_role(auth.uid())) WITH CHECK (public.has_any_staff_role(auth.uid()));

INSERT INTO public.tutors (id, subject_label, icon, system_prompt_overlay, color_accent) VALUES
  ('math', 'Mathematics', 'Sigma', 'Show working clearly. Name the method, calculate one step at a time, and check the final answer.', '#2563eb'),
  ('physical-sciences', 'Physical Sciences', 'Atom', 'For calculations use Given, Required, Formula, Substitution, and Answer. Include units in every relevant line.', '#7c3aed'),
  ('life-sciences', 'Life Sciences', 'Dna', 'Explain processes as linked cause-and-effect steps. Use correct biological vocabulary, then define unfamiliar terms.', '#059669'),
  ('english', 'English', 'BookOpen', 'Focus on argument, structure, evidence, and precise language. Quote source text sparingly and analyse it rather than reproducing it.', '#c2410c'),
  ('accounting', 'Accounting', 'Calculator', 'Use labelled journal entries, T-accounts, and balanced calculations. Explain why each debit or credit is used.', '#b45309')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.answer_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id TEXT REFERENCES public.tutors(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.answer_flags ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.answer_flags TO authenticated;
GRANT SELECT, UPDATE ON public.answer_flags TO authenticated;
GRANT ALL ON public.answer_flags TO service_role;
CREATE POLICY "students_insert_own_flags" ON public.answer_flags FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "staff_manage_flags" ON public.answer_flags FOR ALL TO authenticated
  USING (public.has_any_staff_role(auth.uid())) WITH CHECK (public.has_any_staff_role(auth.uid()));

-- Content management is available to staff and owners; finance remains inaccessible to staff.
DROP POLICY IF EXISTS "resources_admin_write" ON public.resources;
CREATE POLICY "resources_staff_write" ON public.resources FOR ALL TO authenticated
  USING (public.has_any_staff_role(auth.uid())) WITH CHECK (public.has_any_staff_role(auth.uid()));
DROP POLICY IF EXISTS "document_chunks_admin_write" ON public.document_chunks;
CREATE POLICY "document_chunks_staff_write" ON public.document_chunks FOR ALL TO authenticated
  USING (public.has_any_staff_role(auth.uid())) WITH CHECK (public.has_any_staff_role(auth.uid()));
DROP POLICY IF EXISTS "resource_files_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "resource_files_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "resource_files_admin_delete" ON storage.objects;
CREATE POLICY "resource_files_staff_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resource-files' AND public.has_any_staff_role(auth.uid()));
CREATE POLICY "resource_files_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resource-files' AND public.has_any_staff_role(auth.uid()));
CREATE POLICY "resource_files_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resource-files' AND public.has_any_staff_role(auth.uid()));

-- Explicitly deny staff financial and aggregate-user access. Owners use server routes
-- backed by the service role after a separate owner check.
DROP POLICY IF EXISTS "own_subscriptions_read" ON public.subscriptions;
CREATE POLICY "own_subscriptions_read" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_staff_role(UUID) FROM PUBLIC, anon, authenticated;
