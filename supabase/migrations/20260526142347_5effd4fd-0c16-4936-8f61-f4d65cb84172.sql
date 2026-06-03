
CREATE TABLE public.ovens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position INTEGER NOT NULL UNIQUE,
  serial_number TEXT NOT NULL UNIQUE,
  internal_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oven_id UUID NOT NULL REFERENCES public.ovens(id) ON DELETE CASCADE,
  demandeur TEXT NOT NULL,
  realisateur TEXT NOT NULL,
  projet TEXT,
  cdc TEXT,
  essai TEXT,
  specification TEXT,
  date_debut DATE NOT NULL,
  heure_debut TIME NOT NULL,
  date_fin DATE,
  heure_fin TIME,
  type TEXT,
  section TEXT,
  couleur TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_operations_oven_id ON public.operations(oven_id);
CREATE INDEX idx_operations_status ON public.operations(status);
CREATE UNIQUE INDEX idx_one_active_operation_per_oven ON public.operations(oven_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ovens TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations TO anon, authenticated;
GRANT ALL ON public.ovens TO service_role;
GRANT ALL ON public.operations TO service_role;

ALTER TABLE public.ovens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open read ovens" ON public.ovens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert ovens" ON public.ovens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update ovens" ON public.ovens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open delete ovens" ON public.ovens FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Open read operations" ON public.operations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert operations" ON public.operations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update operations" ON public.operations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open delete operations" ON public.operations FOR DELETE TO anon, authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ovens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operations;
ALTER TABLE public.ovens REPLICA IDENTITY FULL;
ALTER TABLE public.operations REPLICA IDENTITY FULL;

-- Seed 56 placeholder ovens
INSERT INTO public.ovens (position, serial_number, internal_number)
SELECT
  i,
  'B621.' || LPAD(i::text, 4, '0'),
  'RD ' || LPAD(i::text, 3, '0')
FROM generate_series(1, 56) AS i;
