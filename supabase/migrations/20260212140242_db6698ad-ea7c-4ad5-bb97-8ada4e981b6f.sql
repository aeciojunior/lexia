-- Dev seed data (only applied when the seed user exists in auth.users)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '15bfa2dd-c782-4e53-995e-756e798a8f75') THEN
    INSERT INTO public.organizations (id, name, plan)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Escritório Aecio Junior', 'pro')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_organizations (user_id, organization_id, role)
    VALUES ('15bfa2dd-c782-4e53-995e-756e798a8f75', 'a0000000-0000-0000-0000-000000000001', 'owner')
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles
    SET active_organization_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE user_id = '15bfa2dd-c782-4e53-995e-756e798a8f75';
  END IF;
END $$;
