import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LexBadge } from "../lexia/LexBadge";

describe("LexBadge", () => {
  it("renders with default variant", () => {
    render(<LexBadge>Default</LexBadge>);
    const badge = screen.getByText("Default");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-primary/15");
  });

  it("renders with destructive variant", () => {
    render(<LexBadge variant="destructive">Error</LexBadge>);
    const badge = screen.getByText("Error");
    expect(badge.className).toContain("bg-destructive/15");
  });

  it("renders with ai variant", () => {
    render(<LexBadge variant="ai">AI</LexBadge>);
    const badge = screen.getByText("AI");
    expect(badge.className).toContain("bg-gradient-to-r");
  });

  it("renders with warning variant", () => {
    render(<LexBadge variant="warning">Warn</LexBadge>);
    const badge = screen.getByText("Warn");
    expect(badge.className).toContain("bg-warning/15");
  });

  it("accepts custom className", () => {
    render(<LexBadge className="custom-class">Custom</LexBadge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("custom-class");
  });
});
