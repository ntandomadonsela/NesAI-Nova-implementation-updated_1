-- Track whether an uploaded resource actually produced usable AI-searchable
-- text, so staff can see (and act on) uploads that silently failed to
-- extract text (e.g. scanned/image-only PDFs with no embedded text layer).
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS ingest_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ingest_status IN ('pending', 'ok', 'empty', 'error')),
  ADD COLUMN IF NOT EXISTS chunk_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ingest_error TEXT;

-- Speeds up "find flagged answers still open" queries on the console.
CREATE INDEX IF NOT EXISTS answer_flags_status_idx ON public.answer_flags (status);

-- Speeds up resource delete/lookup by subject, used by the RAG matcher and
-- the new admin resource list/delete UI.
CREATE INDEX IF NOT EXISTS resources_subject_idx ON public.resources (subject_or_module);
CREATE INDEX IF NOT EXISTS resources_academic_level_idx ON public.resources (academic_level);

-- These two tables each already have an RLS policy allowing staff/owner to
-- write (resources_staff_write, staff_tutors_write) — but a Postgres RLS
-- policy only ever narrows an operation that the underlying GRANT already
-- allows. Neither table had ever been granted INSERT/UPDATE/DELETE to the
-- `authenticated` role, only SELECT, so staff hit "permission denied" any
-- time they tried to upload a resource or edit a tutor from the browser
-- (this is the same class of bug as the earlier has_role() permission fix).
GRANT INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tutors TO authenticated;
