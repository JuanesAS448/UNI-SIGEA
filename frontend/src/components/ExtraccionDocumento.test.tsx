import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExtraccionDocumento } from "./ExtraccionDocumento";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { DatosExtraidosIdentidad, Documento } from "@/types/api";

type DocumentoVista = Pick<Documento, "datos_extraidos" | "resumen_extraccion" | "confianza_ocr" | "nombre_archivo">;

function documentoPrueba(): DocumentoVista {
  return {
    nombre_archivo: "identidad_ficticia.pdf",
    confianza_ocr: 0,
    datos_extraidos: {
      origen: "ai_builder", tipo_documento: "documento_identidad",
      valores: {
        nombres: "PERSONA", apellidos: "DE PRUEBA", numero_cedula: "1.000.000.001",
        fecha_nacimiento: "1995-01-01", fecha_expedicion: "2013-02-01",
        tipo_sangre: "O+", sexo: "F", lugar_expedicion: "LUGAR FICTICIO",
      },
      confianzas: {
        nombres: 0.98, apellidos: 0.96, numero_cedula: 1,
        fecha_nacimiento: 0.94, fecha_expedicion: 0.92,
        tipo_sangre: 0.9, sexo: 0.88, lugar_expedicion: 0.86,
      },
      comparacion: {
        coincidencia_identidad: true,
        campos: {
          nombres: { registrado: "Persona", coincide: true },
          apellidos: { registrado: "De prueba", coincide: true },
          numero_cedula: { registrado: "1000000001", coincide: true },
        },
      },
    },
    resumen_extraccion: {
      confianza_promedio: 93, campos_esperados: 8, campos_extraidos: 8,
      confianzas_disponibles: 8, campos_faltantes: [], extraccion_completa: true,
      coincidencia_identidad: true, tiene_alertas_de_datos: false, revision_pendiente: true,
    },
  };
}

afterEach(cleanup);

describe("ExtraccionDocumento", () => {
  it("el portal muestra solo la confianza y el personal conserva el detalle", () => {
    const doc = documentoPrueba();
    doc.resumen_extraccion!.coincidencia_identidad = false;
    const { container, rerender } = render(<ExtraccionDocumento documento={doc} mostrarOcr={false} soloPorcentaje />);
    expect(container).toHaveTextContent(/^Confianza promedio: 93 %$/);
    expect(screen.queryByRole("button", { name: /Ver extracción/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/requiere revisión/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pendiente de revisión/)).not.toBeInTheDocument();
    rerender(<ExtraccionDocumento documento={doc} />);
    expect(screen.getByRole("button", { name: /Ver extracción/ })).toBeInTheDocument();
    expect(screen.getByText("Identidad: requiere revisión")).toBeInTheDocument();
  });

  it("muestra el promedio y la cobertura; abre los ocho campos y la comparación", () => {
    render(<ExtraccionDocumento documento={documentoPrueba()} />);
    expect(screen.getByText("Confianza promedio: 93 %")).toBeInTheDocument();
    expect(screen.getByText("Extracción completa · 8/8 campos")).toBeInTheDocument();
    expect(screen.getByText("Identidad: coincide con lo registrado")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de revisión del documento")).toBeInTheDocument();
    expect(screen.queryByText("1000000001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver extracción/ }));
    const dialog = screen.getByRole("dialog", { name: "Extracción del documento" });
    const table = within(dialog).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    const cedula = within(table).getByRole("row", { name: /Número de cédula/ });
    expect(within(cedula).getByText("1.000.000.001")).toBeInTheDocument();
    expect(within(cedula).getByText("1000000001")).toBeInTheDocument();
    expect(within(cedula).getByText("100 %")).toBeInTheDocument();
    expect(within(cedula).getByText("Coincide")).toBeInTheDocument();
    expect(within(table).getAllByText("Sin dato de referencia")).toHaveLength(5);
  });

  it("un promedio alto no oculta campos incompletos ni confianzas ausentes", () => {
    const doc = documentoPrueba();
    const datos = doc.datos_extraidos as DatosExtraidosIdentidad;
    datos.valores.fecha_nacimiento = null;
    datos.confianzas.fecha_nacimiento = null;
    Object.assign(doc.resumen_extraccion!, {
      confianza_promedio: 99, campos_extraidos: 7, confianzas_disponibles: 7,
      extraccion_completa: false, campos_faltantes: ["fecha_nacimiento"], tiene_alertas_de_datos: true,
    });
    render(<ExtraccionDocumento documento={doc} />);
    expect(screen.getByText("Confianza promedio: 99 %")).toBeInTheDocument();
    expect(screen.getByText("Extracción incompleta · 7/8 campos")).toBeInTheDocument();
    expect(screen.getByText("Promedio calculado sobre 7/8 puntuaciones")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver extracción/ }));
    const row = screen.getByRole("row", { name: /Fecha de nacimiento/ });
    expect(within(row).getByText("Sin extraer")).toBeInTheDocument();
    expect(within(row).getByText("Sin puntuación")).toBeInTheDocument();
  });

  it("distingue confianza cero de puntuaciones ausentes", () => {
    const doc = documentoPrueba();
    const datos = doc.datos_extraidos as DatosExtraidosIdentidad;
    datos.confianzas.nombres = 0;
    doc.resumen_extraccion!.confianza_promedio = 0;
    render(<ExtraccionDocumento documento={doc} />);
    expect(screen.getByText("Confianza promedio: 0 %")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver extracción/ }));
    expect(within(screen.getByRole("row", { name: /^Nombres/ })).getByText("0 %")).toBeInTheDocument();
  });

  it("las diferencias de identidad siguen visibles con un promedio alto", () => {
    const doc = documentoPrueba();
    const datos = doc.datos_extraidos as DatosExtraidosIdentidad;
    datos.comparacion.campos.numero_cedula!.coincide = false;
    doc.resumen_extraccion!.coincidencia_identidad = false;
    render(<ExtraccionDocumento documento={doc} />);
    expect(screen.getByText("Identidad: requiere revisión")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ver extracción/ }));
    expect(within(screen.getByRole("row", { name: /Número de cédula/ })).getByText("No coincide")).toBeInTheDocument();
  });

  it("un promedio ausente no se presenta como cero", () => {
    const doc = documentoPrueba();
    doc.resumen_extraccion!.confianza_promedio = null;
    doc.resumen_extraccion!.confianzas_disponibles = 0;
    render(<ExtraccionDocumento documento={doc} />);
    expect(screen.getByText("Confianza promedio: Sin puntuación")).toBeInTheDocument();
    expect(screen.getByText("Promedio calculado sobre 0/8 puntuaciones")).toBeInTheDocument();
  });

  it("conserva OCR para documentos anteriores y oculta el detalle inexistente", () => {
    const doc = { nombre_archivo: "anterior.pdf", confianza_ocr: 35, datos_extraidos: {}, resumen_extraccion: null };
    const { rerender, container } = render(<ExtraccionDocumento documento={doc} />);
    expect(screen.getByText("35 %")).toBeInTheDocument();
    expect(screen.getByText("OCR")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver extracción/ })).not.toBeInTheDocument();
    rerender(<ExtraccionDocumento documento={doc} mostrarOcr={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("permite abrir y cerrar extracción dentro del detalle de un documento", async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Detalle del documento</DialogTitle>
          <DialogDescription>Documento ficticio para comprobar ventanas anidadas.</DialogDescription>
          <ExtraccionDocumento documento={documentoPrueba()} />
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ver extracción/ }));
    expect(screen.getByRole("dialog", { name: "Extracción del documento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Extracción del documento" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Detalle del documento" })).toBeInTheDocument();
  });
});
