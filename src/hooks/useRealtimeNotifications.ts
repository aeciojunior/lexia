import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Subscribes to Supabase Realtime for new documents & deadlines in the active org.
 * Respects user notification preferences. Creates persistent notifications and shows toasts.
 */
export const useRealtimeNotifications = () => {
  const { user } = useAuth();
  const { activeOrgId } = useOrganization();
  const queryClient = useQueryClient();

  // Fetch user notification preferences
  const { data: prefs } = useQuery({
    queryKey: ["notif-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notify_deadlines, notify_documents, notify_in_app")
        .eq("user_id", user!.id)
        .maybeSingle();
      return {
        deadlines: (data as any)?.notify_deadlines ?? true,
        documents: (data as any)?.notify_documents ?? true,
        inApp: (data as any)?.notify_in_app ?? true,
      };
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Use ref to access latest prefs in callbacks
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Helper: send browser push notification
  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          new Notification(title, { body, icon: "/favicon.ico" });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!user || !activeOrgId) return;

    const getOrgMembers = async () => {
      const { data } = await supabase
        .from("user_organizations")
        .select("user_id")
        .eq("organization_id", activeOrgId);
      return (data || []).map((m) => m.user_id);
    };

    const notifyMembers = async (
      type: string, title: string, message: string,
      resourceId: string, resourceType: string, excludeUserId: string
    ) => {
      const members = await getOrgMembers();
      const others = members.filter((id) => id !== excludeUserId);
      if (others.length === 0) return;

      const rows = others.map((uid) => ({
        user_id: uid,
        organization_id: activeOrgId,
        type, title, message,
        resource_id: resourceId,
        resource_type: resourceType,
      }));

      await supabase.from("notifications" as any).insert(rows);
    };

    // --- Documents channel ---
    const docsChannel = supabase
      .channel(`docs-rt-${activeOrgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "documents", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          const doc = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ["documents"] });
          queryClient.invalidateQueries({ queryKey: ["client-documents"] });

          const p = prefsRef.current;
          if (doc.user_id !== user.id) {
            if (p?.documents !== false && p?.inApp !== false) {
              toast("📄 Novo documento", {
                description: doc.file_name || "Um novo documento foi adicionado.",
                duration: 6000,
              });
            }
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          } else {
            notifyMembers("document_added", "Novo documento", doc.file_name || "Um novo documento foi adicionado.", doc.id, "document", user.id);
          }
        }
      )
      .subscribe();

    // --- Deadlines channel ---
    const deadlinesChannel = supabase
      .channel(`deadlines-rt-${activeOrgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deadlines", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          const dl = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ["deadlines"] });

          const p = prefsRef.current;
          if (dl.user_id !== user.id) {
            if (p?.deadlines !== false && p?.inApp !== false) {
              toast("⏰ Novo prazo", {
                description: `${dl.title} — ${new Date(dl.due_date).toLocaleDateString("pt-BR")}`,
                duration: 6000,
              });
            }
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          } else {
            notifyMembers("deadline_created", "Novo prazo criado", `${dl.title} — Vence em ${new Date(dl.due_date).toLocaleDateString("pt-BR")}`, dl.id, "deadline", user.id);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deadlines", filter: `organization_id=eq.${activeOrgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["deadlines"] });
        }
      )
      .subscribe();

    // --- Quick tasks channel (RF-016: task assignment notifications) ---
    const tasksChannel = supabase
      .channel(`tasks-rt-${activeOrgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quick_tasks", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          const task = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });

          // Notify assigned user
          if (task.assigned_to && task.assigned_to !== task.user_id && task.assigned_to !== user.id) {
            supabase.from("notifications" as any).insert({
              user_id: task.assigned_to,
              organization_id: activeOrgId,
              type: "task_assigned",
              title: "Nova tarefa atribuída",
              message: task.title,
              resource_id: task.id,
              resource_type: "quick_task",
            });
          }

          if (task.assigned_to === user.id && task.user_id !== user.id) {
            const p = prefsRef.current;
            if (p?.inApp !== false) {
              toast("📋 Nova tarefa", {
                description: task.title,
                duration: 6000,
              });
            }
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quick_tasks", filter: `organization_id=eq.${activeOrgId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["quick-tasks"] });
          const task = payload.new as any;
          const old = payload.old as any;

          // Notify if assignment changed
          if (task.assigned_to && task.assigned_to !== old.assigned_to && task.assigned_to !== user.id) {
            supabase.from("notifications" as any).insert({
              user_id: task.assigned_to,
              organization_id: activeOrgId,
              type: "task_assigned",
              title: "Tarefa atribuída a você",
              message: task.title,
              resource_id: task.id,
              resource_type: "quick_task",
            });
          }
        }
      )
      .subscribe();

    // --- Contract signatures channel (browser push for admins) ---
    const sigChannel = supabase
      .channel(`sigs-rt-${activeOrgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contract_signatures", filter: `organization_id=eq.${activeOrgId}` },
        async (payload) => {
          const sig = payload.new as any;
          queryClient.invalidateQueries({ queryKey: ["admin-all-signatures"] });
          queryClient.invalidateQueries({ queryKey: ["admin-contracts"] });

          // Only notify other users (not the signer)
          if (sig.user_id !== user.id) {
            // Fetch contract title for the notification
            const { data: contract } = await supabase
              .from("contracts")
              .select("title, clients(full_name)")
              .eq("id", sig.contract_id)
              .single();

            const contractTitle = contract?.title || "Contrato";
            const clientName = (contract as any)?.clients?.full_name || "Cliente";

            const p = prefsRef.current;
            if (p?.inApp !== false) {
              toast("✍️ Contrato assinado!", {
                description: `${clientName} assinou "${contractTitle}"`,
                duration: 8000,
              });
            }

            // Browser push notification
            sendBrowserNotification(
              "Contrato Assinado",
              `${clientName} assinou "${contractTitle}"`
            );

            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }
        }
      )
      .subscribe();

    // --- Notifications channel (badge updates) ---
    const notifChannel = supabase
      .channel(`notif-rt-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(docsChannel);
      supabase.removeChannel(deadlinesChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(sigChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [user, activeOrgId, queryClient, sendBrowserNotification]);
};
