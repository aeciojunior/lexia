import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NavLink } from "../NavLink";

describe("NavLink", () => {
  it("renders a link with correct text", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <NavLink to="/dashboard">Dashboard</NavLink>
      </MemoryRouter>
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("applies active class when route matches", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <NavLink to="/dashboard" className="base" activeClassName="active-link">
          Dashboard
        </NavLink>
      </MemoryRouter>
    );
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).toHaveClass("active-link");
  });

  it("does not apply active class when route doesn't match", () => {
    render(
      <MemoryRouter initialEntries={["/other"]}>
        <NavLink to="/dashboard" className="base" activeClassName="active-link">
          Dashboard
        </NavLink>
      </MemoryRouter>
    );
    const link = screen.getByText("Dashboard").closest("a");
    expect(link).not.toHaveClass("active-link");
  });
});
