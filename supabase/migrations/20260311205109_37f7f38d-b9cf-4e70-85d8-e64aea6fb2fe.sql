
CREATE OR REPLACE FUNCTION public.notify_post_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_description TEXT;
  v_priority TEXT;
  v_social_manager TEXT;
  v_req_id TEXT;
BEGIN
  -- Only fire when approval_status actually changes
  IF OLD.approval_status = NEW.approval_status THEN
    RETURN NEW;
  END IF;

  -- Only for approved or rejected
  IF NEW.approval_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Get the social manager for this client
  SELECT social_manager INTO v_social_manager
  FROM public.clients
  WHERE id = NEW.client_id;

  IF v_social_manager IS NULL THEN
    v_social_manager := 'Karen';
  END IF;

  v_req_id := 'notif-' || gen_random_uuid()::text;

  IF NEW.approval_status = 'approved' THEN
    v_title := '✅ Post aprovado: ' || NEW.file_name;
    v_description := 'O cliente ' || NEW.client_name || ' aprovou o post "' || NEW.file_name || '". Pronto para programar e publicar.';
    v_priority := 'normal';
  ELSE
    v_title := '⚠️ Alteração solicitada: ' || NEW.file_name;
    v_description := 'O cliente ' || NEW.client_name || ' solicitou alteração no post "' || NEW.file_name || '". Motivo: ' || COALESCE(NEW.rejection_reason, 'Não informado');
    v_priority := 'urgent';
  END IF;

  INSERT INTO public.internal_requests (
    id, title, description, requester_id, requester_name,
    assigned_to_id, assigned_to_name, client_id, client_name,
    department, priority, status
  ) VALUES (
    v_req_id, v_title, v_description,
    'system', 'Sistema',
    v_social_manager, v_social_manager,
    NEW.client_id, NEW.client_name,
    'Social Media', v_priority, 'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_approval ON public.client_posts;

CREATE TRIGGER trg_notify_post_approval
  AFTER UPDATE ON public.client_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_approval();
