DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = 'ca0e9919-67c7-4c8b-910e-3d022109b8e6') THEN
    UPDATE profiles
    SET active_organization_id = 'a0000000-0000-0000-0000-000000000001'
    WHERE user_id = 'ca0e9919-67c7-4c8b-910e-3d022109b8e6';
  END IF;
END $$;
