import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EliminarDocumentoButton } from "./EliminarDocumentoButton";

const mutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(), reset: vi.fn(), isPending: false, isError: false,
}));
vi.mock("@/hooks/useDocumentos", () => ({ useEliminarDocumento: () => mutation }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

describe("EliminarDocumentoButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutation.isPending = false;
    mutation.isError = false;
    mutation.mutateAsync.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it("abrir y cancelar no elimina el documento", () => {
    render(<EliminarDocumentoButton documento={{ id: 17, nombre_archivo: "prueba.pdf" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar prueba.pdf" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/La copia de SharePoint se conserva/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("solo elimina el ID elegido tras confirmar", async () => {
    const onDeleted = vi.fn();
    render(<EliminarDocumentoButton documento={{ id: 17, nombre_archivo: "prueba.pdf" }} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar prueba.pdf" }));
    expect(mutation.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar documento" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(mutation.mutateAsync).toHaveBeenCalledExactlyOnceWith(17);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("un error conserva el diálogo y no notifica éxito", async () => {
    mutation.mutateAsync.mockRejectedValue(new Error("Fallo ficticio"));
    const onDeleted = vi.fn();
    render(<EliminarDocumentoButton documento={{ id: 17, nombre_archivo: "prueba.pdf" }} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar prueba.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar documento" }));
    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledOnce());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
