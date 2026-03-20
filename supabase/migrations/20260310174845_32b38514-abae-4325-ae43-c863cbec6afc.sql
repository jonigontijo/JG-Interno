
-- Update trigger to copy role data from user_metadata into profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, name, role, roles, is_admin, module_access)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', ''),
    CASE 
      WHEN NEW.raw_user_meta_data->'roles' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'roles') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles'))
      ELSE '{}'::TEXT[]
    END,
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false),
    CASE 
      WHEN NEW.raw_user_meta_data->'module_access' IS NOT NULL AND jsonb_typeof(NEW.raw_user_meta_data->'module_access') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'module_access'))
      ELSE '{}'::TEXT[]
    END
  );
  RETURN NEW;
END;
$$;
