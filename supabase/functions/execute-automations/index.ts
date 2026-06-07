import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronSecret } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TriggerConfig {
  event: string;
  params: Record<string, string>;
}
interface ConditionConfig {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string;
}
interface ActionConfig {
  type: string;
  params: Record<string, string>;
}
interface WorkflowConfig {
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
}

function evaluateCondition(cond: ConditionConfig, data: Record<string, any>): boolean {
  const fieldVal = String(data[cond.field] ?? "");
  const condVal = cond.value;
  switch (cond.operator) {
    case "equals": return fieldVal === condVal;
    case "not_equals": return fieldVal !== condVal;
    case "contains": return fieldVal.includes(condVal);
    case "greater_than": return Number(fieldVal) > Number(condVal);
    case "less_than": return Number(fieldVal) < Number(condVal);
    default: return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronDenied = verifyCronSecret(req);
  if (cronDenied) return cronDenied;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get all active automations
    const { data: automations, error: autoErr } = await supabase
      .from("automations")
      .select("*")
      .eq("status", "active")
      .eq("type", "workflow");
    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "No active automations", executed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalExecuted = 0;

    for (const auto of automations) {
      const config = auto.config as WorkflowConfig | null;
      if (!config?.trigger?.event || !config?.actions?.length) continue;

      const orgId = auto.organization_id;
      const event = config.trigger.event;
      const startedAt = new Date().toISOString();
      let logStatus = "success";
      let logError: string | null = null;
      let matchedItems: Record<string, any>[] = [];
      const logDetails: any[] = [];

      try {
        // ─── Gather event data ───────────────────────────────────
        if (event === "process_created") {
          const since = auto.last_run_at || new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from("processes")
            .select("*")
            .eq("organization_id", orgId)
            .gte("created_at", since);
          matchedItems = (data || []).map((p: any) => ({ ...p, _type: "process" }));

        } else if (event === "process_status_changed") {
          const since = auto.last_run_at || new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from("process_movements")
            .select("*, processes(title, number, status, type, client_name)")
            .eq("organization_id", orgId)
            .eq("movement_type", "status_change")
            .gte("created_at", since);
          matchedItems = (data || []).map((m: any) => ({
            ...m,
            new_status: m.processes?.status,
            type: m.processes?.type,
            _type: "process_movement",
            _process: m.processes,
          }));

        } else if (event === "deadline_approaching") {
          const daysBefore = parseInt(config.trigger.params.days_before || "3");
          const targetDate = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);
          const targetStr = targetDate.toISOString().split("T")[0];
          const { data } = await supabase
            .from("deadlines")
            .select("*, processes(title, number)")
            .eq("organization_id", orgId)
            .eq("status", "pending")
            .gte("due_date", today)
            .lte("due_date", targetStr);
          matchedItems = (data || []).map((d: any) => ({ ...d, _type: "deadline" }));

        } else if (event === "deadline_overdue") {
          const { data } = await supabase
            .from("deadlines")
            .select("*, processes(title, number)")
            .eq("organization_id", orgId)
            .eq("status", "pending")
            .lt("due_date", today);
          matchedItems = (data || []).map((d: any) => ({
            ...d,
            days_overdue: String(Math.floor((now.getTime() - new Date(d.due_date).getTime()) / (1000 * 60 * 60 * 24))),
            _type: "deadline",
          }));

        } else if (event === "invoice_created") {
          const since = auto.last_run_at || new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from("invoices")
            .select("*, clients(full_name, email)")
            .eq("organization_id", orgId)
            .gte("created_at", since);
          matchedItems = (data || []).map((inv: any) => ({
            ...inv,
            amount_min: String(inv.amount_cents / 100),
            _type: "invoice",
          }));

        } else if (event === "invoice_overdue") {
          const { data } = await supabase
            .from("invoices")
            .select("*, clients(full_name, email)")
            .eq("organization_id", orgId)
            .in("status", ["pending", "sent"])
            .not("due_date", "is", null)
            .lt("due_date", today);
          matchedItems = (data || []).map((inv: any) => ({
            ...inv,
            days_overdue: String(Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))),
            _type: "invoice",
          }));

        } else if (event === "hearing_scheduled") {
          const since = auto.last_run_at || new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from("hearings")
            .select("*, processes(title, number, client_name)")
            .eq("organization_id", orgId)
            .gte("created_at", since);
          matchedItems = (data || []).map((h: any) => ({ ...h, _type: "hearing" }));

        } else if (event === "movement_created") {
          const since = auto.last_run_at || new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
          const { data } = await supabase
            .from("process_movements")
            .select("*, processes(title, number, client_name)")
            .eq("organization_id", orgId)
            .gte("created_at", since);
          matchedItems = (data || []).map((m: any) => ({ ...m, _type: "movement" }));
        }

        // ─── Evaluate conditions ──────────────────────────────
        const filtered = config.conditions.length > 0
          ? matchedItems.filter(item => config.conditions.every(c => evaluateCondition(c, item)))
          : matchedItems;

        let itemsProcessed = 0;

        if (filtered.length > 0) {
          // ─── Execute actions ──────────────────────────────────
          for (const item of filtered) {
            const vars: Record<string, string> = {
              "{{processo}}": item.processes?.title || item.title || "",
              "{{numero}}": item.processes?.number || item.number || "",
              "{{cliente}}": item.processes?.client_name || item.clients?.full_name || item.client_name || "",
              "{{data}}": new Date().toLocaleDateString("pt-BR"),
              "{{titulo}}": item.title || "",
            };

            const replaceVars = (text: string) => {
              let result = text;
              for (const [key, val] of Object.entries(vars)) {
                result = result.replaceAll(key, val);
              }
              return result;
            };

            // Deduplicate
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("resource_id", item.id)
              .eq("resource_type", `auto_${auto.id}`)
              .gte("created_at", today + "T00:00:00Z")
              .limit(1);
            if (existing && existing.length > 0) continue;

            const actionResults: string[] = [];

            for (const action of config.actions) {
              try {
                if (action.type === "send_notification") {
                  const title = replaceVars(action.params.title || "Automação");
                  const message = replaceVars(action.params.message || "");
                  await supabase.from("notifications").insert({
                    user_id: item.user_id || auto.user_id,
                    organization_id: orgId,
                    title,
                    message,
                    type: "automation",
                    resource_id: item.id,
                    resource_type: `auto_${auto.id}`,
                  });
                  actionResults.push(`notification:ok`);

                } else if (action.type === "send_email" && RESEND_API_KEY) {
                  const title = replaceVars(action.params.title || "Automação Lexia");
                  const message = replaceVars(action.params.message || "");
                  let toEmail = action.params.to;

                  if (!toEmail) {
                    const userId = item.user_id || item.responsible_id || auto.user_id;
                    const { data: userData } = await supabase.auth.admin.getUserById(userId);
                    toEmail = userData?.user?.email;
                  }

                  if (toEmail) {
                    await fetch("https://api.resend.com/emails", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${RESEND_API_KEY}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        from: "Lexia <onboarding@resend.dev>",
                        to: [toEmail],
                        subject: `⚙️ ${title}`,
                        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                          <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px;border-radius:12px 12px 0 0;">
                            <h1 style="color:#e0e0ff;margin:0;font-size:18px;">⚙️ Automação: ${auto.name}</h1>
                          </div>
                          <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;">
                            <h2 style="margin:0 0 8px;">${title}</h2>
                            <p style="color:#555;">${message}</p>
                            <p style="color:#888;font-size:12px;margin-top:24px;">Email automático do sistema Lexia.</p>
                          </div>
                        </div>`,
                      }),
                    });
                    actionResults.push(`email:${toEmail}`);
                  }

                } else if (action.type === "create_deadline") {
                  const daysOffset = parseInt(action.params.days_offset || "7");
                  const dueDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
                  await supabase.from("deadlines").insert({
                    title: replaceVars(action.params.title || "Prazo automático"),
                    due_date: dueDate.toISOString().split("T")[0],
                    priority: action.params.priority || "medium",
                    user_id: item.user_id || auto.user_id,
                    organization_id: orgId,
                    process_id: item.process_id || item.id || null,
                  });
                  actionResults.push(`deadline:created`);

                } else if (action.type === "update_status") {
                  const newStatus = action.params.new_status;
                  if (newStatus && item._type === "process") {
                    await supabase.from("processes").update({ status: newStatus }).eq("id", item.id);
                  } else if (newStatus && item._type === "deadline") {
                    await supabase.from("deadlines").update({ status: newStatus }).eq("id", item.id);
                  } else if (newStatus && item._type === "invoice") {
                    await supabase.from("invoices").update({ status: newStatus }).eq("id", item.id);
                  }
                  actionResults.push(`status:${newStatus}`);
                }
              } catch (actionErr: any) {
                actionResults.push(`error:${actionErr.message}`);
              }
            }

            itemsProcessed++;
            logDetails.push({
              item_id: item.id,
              item_type: item._type,
              actions: actionResults,
            });

            totalExecuted++;
          }
        }

        // Log execution
        await supabase.from("automation_logs").insert({
          automation_id: auto.id,
          organization_id: orgId,
          status: logStatus,
          items_matched: matchedItems.length,
          items_processed: itemsProcessed,
          details: logDetails,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });

        // Update last_run_at and increment run_count
        await supabase
          .from("automations")
          .update({
            last_run_at: now.toISOString(),
            run_count: (auto.run_count || 0) + itemsProcessed,
          })
          .eq("id", auto.id);

      } catch (autoError: any) {
        logStatus = "error";
        logError = autoError.message;

        // Log the error
        await supabase.from("automation_logs").insert({
          automation_id: auto.id,
          organization_id: orgId,
          status: "error",
          items_matched: matchedItems.length,
          items_processed: 0,
          error_message: logError,
          details: logDetails,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });

        console.error(`Error processing automation ${auto.id}:`, autoError);
      }
    }

    return new Response(JSON.stringify({ success: true, executed: totalExecuted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in execute-automations:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
