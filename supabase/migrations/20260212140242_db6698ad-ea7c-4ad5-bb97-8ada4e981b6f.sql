-- Create organization for the user
INSERT INTO public.organizations (id, name, plan)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Escritório Aecio Junior', 'pro');

-- Add user as owner
INSERT INTO public.user_organizations (user_id, organization_id, role)
VALUES ('15bfa2dd-c782-4e53-995e-756e798a8f75', 'a0000000-0000-0000-0000-000000000001', 'owner');

-- Set active organization on profile
UPDATE public.profiles
SET active_organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE user_id = '15bfa2dd-c782-4e53-995e-756e798a8f75';
