import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { createElement } from "react";

/**
 * Subscribes to Supabase Realtime for new documents in the active org.
 * Shows a toast notification and invalidates document queries.
 */
export const useRealtimeDocuments = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !activeOrgId) return;

    const channel = supabase
      .channel(`documents-org-${activeOrgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "documents",
          filter: `organization_id=eq.${activeOrgId}`,
        },
        (payload) => {
          const newDoc = payload.new as any;

          // Don't notify the user who uploaded the document
          if (newDoc.user_id === user.id) {
            queryClient.invalidateQueries({ queryKey: ["documents"] });
            queryClient.invalidateQueries({ queryKey: ["client-documents"] });
            return;
          }

          // Show notification
          toast("Novo documento disponível", {
            description: newDoc.file_name || "Um novo documento foi adicionado.",
            icon: createElement(FileText, { className: "h-4 w-4 text-primary" }),
            duration: 6000,
          });

          // Invalidate queries to refresh lists
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["client-documents"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeOrgId, queryClient]);
};
