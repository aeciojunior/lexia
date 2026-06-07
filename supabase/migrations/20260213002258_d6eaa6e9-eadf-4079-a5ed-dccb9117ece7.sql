-- Dev seed data (only applied when the seed user exists in auth.users)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = 'ca0e9919-67c7-4c8b-910e-3d022109b8e6') THEN
    INSERT INTO public.user_organizations (user_id, organization_id, role, status)
    VALUES ('ca0e9919-67c7-4c8b-910e-3d022109b8e6', 'a0000000-0000-0000-0000-000000000001', 'client', 'active')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.clients (full_name, email, organization_id, user_id, client_type, document_type, status)
    VALUES ('Aecio Junior (Cliente Teste)', 'aeciojunior.dev@gmail.com', 'a0000000-0000-0000-0000-000000000001', 'ca0e9919-67c7-4c8b-910e-3d022109b8e6', 'individual', 'cpf', 'active')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
