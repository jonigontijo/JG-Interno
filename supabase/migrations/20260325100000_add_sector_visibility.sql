ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sector_visibility text[] DEFAULT '{}';
