import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Postulantes from "./Postulantes";

const mocks = vi.hoisted(() => ({
  crear: { mutateAsync: vi.fn(), isPending: false },
  actualizar: { mutateAsync: vi.fn(), isPending: false },
  eliminar: { mutateAsync: vi.fn(), isPending: false },
  list: vi.fn(),
}));
vi.mock("@/hooks/usePostulantes", () => ({
  usePostulantes: (...args: unknown[]) => mocks.list(...args),
  useCrearPostulante: () => mocks.crear,
  useActualizarPostulante: () => mocks.actualizar,
  useEliminarPostulante: () => mocks.eliminar,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
const ficha = { id: 9, usuario: null, nombres: "Ana", apellidos: "Prueba", tipo_documento: "Cédula de Ciudadanía", numero_documento: "12345678", email: "ana@example.invalid", telefono: "3001234567", direccion: "Dirección ficticia", estado: "activo", fecha_registro: "2026-10-21", puede_eliminar: true, documentos_count: 0, expedientes_count: 0 };

describe("CRUD de postulantes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.crear.isPending = false;
    mocks.actualizar.isPending = false;
    mocks.eliminar.isPending = false;
    mocks.crear.mutateAsync.mockResolvedValue(ficha);
    mocks.actualizar.mutateAsync.mockResolvedValue(ficha);
    mocks.eliminar.mutateAsync.mockResolvedValue(undefined);
    mocks.list.mockReturnValue({ data: { count: 1, results: [ficha], next: null, previous: null }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() });
  });
  afterEach(cleanup);

  it("crea una ficha con los campos del formulario", async () => {
    render(<Postulantes />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo postulante" }));
    for (const [label, value] of [["Nombres", "Ana"], ["Apellidos", "Prueba"], ["Número de documento", "12345678"], ["Correo electrónico", "ana@example.invalid"], ["Teléfono", "3001234567"], ["Dirección", "Dirección ficticia"]]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(mocks.crear.mutateAsync).toHaveBeenCalledOnce());
    expect(mocks.crear.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ nombres: "Ana", numero_documento: "12345678", email: "ana@example.invalid" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("edita la ficha elegida y conserva el formulario si falla", async () => {
    mocks.actualizar.mutateAsync.mockRejectedValue(new Error('HTTP 400: {"numero_documento":["El número ya está registrado."]}'));
    render(<Postulantes />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Número de documento"), { target: { value: "87654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El número ya está registrado.");
    expect(mocks.actualizar.mutateAsync).toHaveBeenCalledWith({ id: 9, data: expect.objectContaining({ numero_documento: "87654321" }) });
    expect(screen.getByLabelText("Número de documento")).toHaveValue("87654321");
  });

  it("consulta sin mutaciones y pide confirmación antes de eliminar", async () => {
    render(<Postulantes />);
    fireEvent.click(screen.getByRole("button", { name: "Consultar" }));
    expect(within(screen.getByRole("dialog")).getByText("Dirección ficticia")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.eliminar.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(mocks.eliminar.mutateAsync).toHaveBeenCalledExactlyOnceWith(9));
  });

  it("ofrece desactivar en lugar de eliminar registros vinculados", async () => {
    mocks.list.mockReturnValue({ data: { count: 1, results: [{ ...ficha, puede_eliminar: false, documentos_count: 2 }], next: null, previous: null } });
    render(<Postulantes />);
    expect(screen.queryByRole("button", { name: "Eliminar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(mocks.actualizar.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.actualizar.mutateAsync).toHaveBeenCalledWith({ id: 9, data: { estado: "inactivo" } }));
  });

  it("envía búsqueda y filtros al servidor", () => {
    render(<Postulantes />);
    fireEvent.change(screen.getByLabelText("Buscar postulantes"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "activo" } });
    expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, search: "Ana", estado: "activo" });
  });
});
