import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requisitosService } from "@/services/requisitosService";
import type { DocumentoRequerido, DocumentoRequeridoCreate } from "@/types/api";

export const REQUISITOS_KEY = ["requisitos"] as const;

// solo necesita creación, el listado se obtiene desde la convocatoria
export function useCrearRequisito() {
    const queryClient = useQueryClient();

    return useMutation<DocumentoRequerido, Error, DocumentoRequeridoCreate>({
        mutationFn: requisitosService.create,
        onSuccess: (_, datos) => {
            // invalidamos la convocatoria específica y la lista general
            queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
            queryClient.invalidateQueries({ queryKey: ["convocatorias", datos.convocatoria] });
        },
    });
}

export function useActualizarRequisito() {
    const queryClient = useQueryClient();

    return useMutation<DocumentoRequerido, Error, { id: number; convocatoria: number; data: Partial<DocumentoRequeridoCreate> }>(
        {
            mutationFn: ({ id, data }) => requisitosService.update(id, data),
            onSuccess: (_, datos) => {
                queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
                queryClient.invalidateQueries({ queryKey: ["convocatorias", datos.convocatoria] });
            },
        }
    );
}

export function useEliminarRequisito() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, {id: number; convocatoria: number}>({
        mutationFn: ({ id }) => requisitosService.remove(id),
        onSuccess: (_, datos) => {
            queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
            queryClient.invalidateQueries({ queryKey: ["convocatorias", datos.convocatoria] });
        },
    });
}
