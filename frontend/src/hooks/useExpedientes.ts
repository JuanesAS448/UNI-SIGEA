/**
 * Hooks React Query para Expedientes.
 *
 * useExpedientes() → lista expedientes con filtros opcionales (GET)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expedientesService, type ExpedientesFiltros } from "@/services/expedientesService";
import { CONVOCATORIAS_KEY } from "@/hooks/useConvocatorias";

export const EXPEDIENTES_KEY = ["expedientes"] as const;

// ── Lista ─────────────────────────────────────────────────────────────────────
export function useExpedientes(filtros?: ExpedientesFiltros) {
    return useQuery({
        queryKey: [...EXPEDIENTES_KEY, filtros],
        queryFn: () => expedientesService.getAll(filtros),
        staleTime: 30_000,
    });
}

export function useCrearExpediente() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: expedientesService.create,
        onSuccess: (_created, variables) => {
            queryClient.invalidateQueries({ queryKey: EXPEDIENTES_KEY });
            queryClient.invalidateQueries({ queryKey: CONVOCATORIAS_KEY });
            queryClient.invalidateQueries({
                queryKey: [...CONVOCATORIAS_KEY, variables.convocatoria],
            });
        },
    });
}
