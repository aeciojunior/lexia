import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronDenied = verifyCronSecret(req);
  if (cronDenied) return cronDenied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const todayStr = now.toISOString().split("T")[0];
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const dayAfterStr = dayAfter.toISOString().split("T")[0];

    // Get tasks due today, tomorrow, or day after that are not done
    const { data: tasks, error } = await supabase
      .from("quick_tasks")
      .select("id, title, due_date, user_id, assigned_to, organization_id, priority")
      .eq("done", false)
      .not("due_date", "is", null)
      .in("due_date", [todayStr, tomorrowStr, dayAfterStr]);

    if (error) throw error;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ message: "No tasks due soon", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notifCount = 0;

    for (const task of tasks) {
      const isToday = task.due_date === todayStr;
      const isTomorrow = task.due_date === tomorrowStr;

      const urgency = isToday ? "vence hoje" : isTomorrow ? "vence amanhã" : "vence em 2 dias";
      const type = isToday ? "task_due_today" : "task_due_soon";

      // Notify task owner
      const recipients = [task.user_id];
      if (task.assigned_to && task.assigned_to !== task.user_id) {
        recipients.push(task.assigned_to);
      }

      for (const userId of recipients) {
        // Check if notification already sent today for this task+user
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("resource_id", task.id)
          .eq("resource_type", "quick_task")
          .gte("created_at", todayStr + "T00:00:00Z")
          .limit(1);

        if (existing && existing.length > 0) continue;

        // Check user notification preferences
        const { data: profile } = await supabase
          .from("profiles")
          .select("notify_deadlines, notify_in_app")
          .eq("user_id", userId)
          .single();

        if (!profile?.notify_deadlines || !profile?.notify_in_app) continue;

        await supabase.from("notifications").insert({
          user_id: userId,
          organization_id: task.organization_id,
          title: `Tarefa ${urgency}: ${task.title}`,
          message: `A tarefa "${task.title}" (prioridade: ${task.priority}) ${urgency}.`,
          type,
          resource_id: task.id,
          resource_type: "quick_task",
        });

        notifCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Task notifications processed", count: notifCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in task-notifications:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
