import { describe, it, expect } from "vitest";
import { PLAN_LABELS } from "@/hooks/usePlanLimits";
import type { PlanType } from "@/hooks/usePlanLimits";

describe("usePlanLimits — pure exports", () => {
  describe("PLAN_LABELS", () => {
    it("has labels for all plan types", () => {
      const plans: PlanType[] = ["free", "trial", "pro", "enterprise"];
      plans.forEach((p) => {
        expect(PLAN_LABELS[p]).toBeDefined();
        expect(typeof PLAN_LABELS[p]).toBe("string");
        expect(PLAN_LABELS[p].length).toBeGreaterThan(0);
      });
    });

    it("free plan label is Gratuito", () => {
      expect(PLAN_LABELS.free).toBe("Gratuito");
    });

    it("pro plan label is Profissional", () => {
      expect(PLAN_LABELS.pro).toBe("Profissional");
    });

    it("enterprise plan label is Enterprise", () => {
      expect(PLAN_LABELS.enterprise).toBe("Enterprise");
    });

    it("trial plan label contains Trial", () => {
      expect(PLAN_LABELS.trial).toContain("Trial");
    });
  });
});
