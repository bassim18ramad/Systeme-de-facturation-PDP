
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending'));

-- Update existing profiles to active
UPDATE public.user_profiles SET status = 'active' WHERE status IS NULL;
