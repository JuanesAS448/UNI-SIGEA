import { ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import type { CampoIdentidad, DatosExtraidosIdentidad, Documento } from "@/types/api";

const CAMPOS: { key: CampoIdentidad; label: string }[] = [
  { key: "nombres", label: "Nombres" },
  { key: "apellidos", label: "Apellidos" },
  { key: "numero_cedula", label: "Número de cédula" },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento" },
  { key: "fecha_expedicion", label: "Fecha de expedición" },
  { key: "tipo_sangre", label: "Tipo de sangre" },
  { key: "sexo", label: "Sexo" },
  { key: "lugar_expedicion", label: "Lugar de expedición" },
];

function esIdentidad(datos: Documento["datos_extraidos"]): datos is DatosExtraidosIdentidad {
  return datos?.origen === "ai_builder";
}

function porcentaje(value: number | null | undefined) {
  return value == null || !Number.isFinite(value)
    ? "Sin puntuación"
    : `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} %`;
}

interface Props {
  documento: Pick<Documento, "datos_extraidos" | "resumen_extraccion" | "confianza_ocr" | "nombre_archivo">;
  mostrarOcr?: boolean;
  soloPorcentaje?: boolean;
}

export function ExtraccionDocumento({ documento, mostrarOcr = true, soloPorcentaje = false }: Props) {
  const datos = documento.datos_extraidos;
  const resumen = documento.resumen_extraccion;
  if (!esIdentidad(datos)) {
    if (!mostrarOcr) return null;
    return (
      <div className="text-sm">
        <span>{porcentaje(documento.confianza_ocr)}</span>
        <span className="ml-1 text-xs text-muted-foreground">OCR</span>
      </div>
    );
  }

  if (soloPorcentaje) {
    return <p className="text-sm font-medium text-foreground">Confianza promedio: {porcentaje(resumen?.confianza_promedio)}</p>;
  }

  return (
    <div className="space-y-2 text-left text-sm">
      <div>
        <p className="font-medium text-foreground">
          Confianza promedio: {porcentaje(resumen?.confianza_promedio)}
        </p>
        {resumen && (
          <>
            <p className={resumen.extraccion_completa ? "text-xs text-muted-foreground" : "text-xs font-medium text-amber-700 dark:text-amber-400"}>
              {resumen.extraccion_completa ? "Extracción completa" : "Extracción incompleta"}
              {` · ${resumen.campos_extraidos}/${resumen.campos_esperados} campos`}
            </p>
            <p className="text-xs text-muted-foreground">
              {`Promedio calculado sobre ${resumen.confianzas_disponibles}/${resumen.campos_esperados} puntuaciones`}
            </p>
            <p className="text-xs text-foreground">
              {resumen.coincidencia_identidad ? "Identidad: coincide con lo registrado" : "Identidad: requiere revisión"}
            </p>
            {resumen.revision_pendiente && <p className="text-xs text-muted-foreground">Pendiente de revisión del documento</p>}
          </>
        )}
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-2" aria-label={`Ver extracción de ${documento.nombre_archivo ?? "documento"}`}>
            <ScanText className="h-4 w-4" />Ver extracción
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extracción del documento</DialogTitle>
            <DialogDescription>
              {documento.nombre_archivo ?? "Documento"}. Datos leídos por AI Builder y comparación con lo registrado al procesar este archivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">Confianza promedio: {porcentaje(resumen?.confianza_promedio)}</p>
            {resumen && (
              <p className="text-sm text-muted-foreground">
                {`${resumen.campos_extraidos}/${resumen.campos_esperados} campos extraídos · ${resumen.confianzas_disponibles}/${resumen.campos_esperados} puntuaciones disponibles`}
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Valores extraídos, confianza por campo y comparación de identidad</caption>
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-3">Campo</th>
                    <th scope="col" className="px-3 py-3">Valor extraído</th>
                    <th scope="col" className="px-3 py-3">Confianza</th>
                    <th scope="col" className="px-3 py-3">Dato registrado</th>
                    <th scope="col" className="px-3 py-3">Comparación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CAMPOS.map(({ key, label }) => {
                    const value = datos.valores[key];
                    const confidence = datos.confianzas[key];
                    const comparison = datos.comparacion.campos[key];
                    const comparisonLabel = !comparison ? "Sin dato de referencia"
                      : comparison.coincide === true ? "Coincide"
                      : comparison.coincide === false ? "No coincide" : "Sin datos para comparar";
                    return (
                      <tr key={key}>
                        <th scope="row" className="px-3 py-3 font-medium">{label}</th>
                        <td className="max-w-xs whitespace-pre-wrap break-words px-3 py-3">{value || <span className="text-muted-foreground">Sin extraer</span>}</td>
                        <td className="whitespace-nowrap px-3 py-3">{porcentaje(confidence == null ? null : confidence * 100)}</td>
                        <td className="max-w-xs break-words px-3 py-3">{comparison?.registrado || "—"}</td>
                        <td className={`px-3 py-3 ${comparison?.coincide === false ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {comparisonLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              La confianza describe la extracción. El estado de identidad se determina comparando nombres, apellidos y cédula con los datos registrados.
            </p>
            <div className="flex justify-end">
              <DialogClose asChild><Button variant="outline">Cerrar</Button></DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
