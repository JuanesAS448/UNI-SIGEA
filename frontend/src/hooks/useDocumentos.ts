/**
 * Hooks React Query para Documentos.
 *
 * useDocumentos()           → lista con filtros opcionales
 * useActualizarDocumento()  → mutation PATCH (aprobar/rechazar)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentosService, type DocumentosFiltros } from "@/services/documentosService";
import type { Documento, DocumentoActualizacion, DocumentoUploadData } from "@/types/api";
import { EXPEDIENTES_KEY } from "@/hooks/useExpedientes";
import { CONVOCATORIAS_KEY } from "@/hooks/useConvocatorias";

export const DOCUMENTOS_KEY = ["documentos"] as const;

// ── Lista ─────────────────────────────────────────────────────────────────────
export function useDocumentos(filtros?: DocumentosFiltros) {
    return useQuery({
        queryKey: [...DOCUMENTOS_KEY, filtros],
        queryFn: () => documentosService.getAll(filtros),
        staleTime: 15_000,
    });
}

// ── Detalle ───────────────────────────────────────────────────────────────────
export function useDocumento(id: number) {
    return useQuery({
        queryKey: [...DOCUMENTOS_KEY, id],
        queryFn: () => documentosService.getById(id),
        enabled: !!id,
    });
}

// ── Mutation: actualizar estado (aprobar / rechazar) ──────────────────────────
export function useActualizarDocumento() {
    const queryClient = useQueryClient();

    return useMutation<Documento, Error, { id: number; data: DocumentoActualizacion }>({
        mutationFn: ({ id, data }) => documentosService.actualizarEstado(id, data),
        onSuccess: () => {
            // Invalida la lista y el dashboard para que se recarguen automáticamente
            queryClient.invalidateQueries({ queryKey: DOCUMENTOS_KEY });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}

export function useSubirDocumento() {
    const queryClient = useQueryClient();

    return useMutation<Documento, Error, DocumentoUploadData>({
        mutationFn: (data) => documentosService.subir(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: DOCUMENTOS_KEY });
            queryClient.invalidateQueries({ queryKey: EXPEDIENTES_KEY });
            queryClient.invalidateQueries({ queryKey: CONVOCATORIAS_KEY });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}
