import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LexCard, LexCardHeader, LexCardTitle } from "../lexia/LexCard";

describe("LexCard", () => {
  it("renders children", () => {
    render(<LexCard>Card Content</LexCard>);
    expect(screen.getByText("Card Content")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    const { container } = render(<LexCard>Test</LexCard>);
    expect(container.firstChild).toHaveClass("bg-card");
    expect(container.firstChild).toHaveClass("border");
  });

  it("applies ai variant", () => {
    const { container } = render(<LexCard variant="ai">AI</LexCard>);
    expect(container.firstChild).toHaveClass("neon-border-violet");
  });

  it("applies glass variant", () => {
    const { container } = render(<LexCard variant="glass">Glass</LexCard>);
    expect(container.firstChild).toHaveClass("glass");
  });

  it("disables hover effect", () => {
    const { container } = render(<LexCard hover={false}>No Hover</LexCard>);
    expect(container.firstChild).not.toHaveClass("hover:shadow-lg");
  });
});

describe("LexCardHeader", () => {
  it("renders with flex layout", () => {
    const { container } = render(<LexCardHeader>Header</LexCardHeader>);
    expect(container.firstChild).toHaveClass("flex");
    expect(container.firstChild).toHaveClass("items-start");
  });
});

describe("LexCardTitle", () => {
  it("renders as h3 element", () => {
    render(<LexCardTitle>Title</LexCardTitle>);
    const title = screen.getByText("Title");
    expect(title.tagName).toBe("H3");
  });
});
