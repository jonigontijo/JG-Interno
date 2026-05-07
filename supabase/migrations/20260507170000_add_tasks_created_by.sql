-- Add created_by column to tasks table so users can see tasks they created
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by TEXT;
