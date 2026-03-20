-- Add description and recur_until columns to tasks table
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS recur_until date;
