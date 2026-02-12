
-- Restringir inserção de audit_logs para usuários autenticados
-- (service_role bypassa RLS de qualquer forma)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
