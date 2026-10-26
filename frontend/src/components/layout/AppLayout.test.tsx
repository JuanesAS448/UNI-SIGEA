import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./AppLayout";

const authMock = vi.hoisted(() => ({
  session: { rol: "postulante", email: "postulante@example.test" },
  signOut: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authMock,
}));

describe("AppLayout navigation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps applicant navigation accessible through the mobile menu", () => {
    render(
      <MemoryRouter initialEntries={["/portal-postulante"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/portal-postulante" element={<p>Portal del postulante</p>} />
            <Route path="/cambiar-contrasena" element={<p>Cambiar contraseña</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole("complementary", { name: "Navegación principal" });
    expect(sidebar).toHaveClass("lg:w-[232px]", "invisible", "-translate-x-full");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
    expect(sidebar).toHaveClass("visible", "translate-x-0");

    fireEvent.click(screen.getByRole("link", { name: "Cambiar contraseña" }));
    expect(screen.getByText("Cambiar contraseña", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
  });
});
