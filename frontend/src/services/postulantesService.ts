/**
 * Servicio para Postulantes.
 * Endpoints: GET /api/postulantes/ · POST /api/postulantes/
 */
import { apiClient } from "@/lib/api";
import type { Postulante, PostulanteCreate, PaginatedResponse } from "@/types/api";

export interface PostulantesFiltros {
    excluir_convocatoria?: number;
}

export const postulantesService = {
    /**
     * Lista postulantes con rol postulante (paginado).
     * GET /api/postulantes/?excluir_convocatoria=
     */
    getAll: (filtros?: PostulantesFiltros): Promise<PaginatedResponse<Postulante>> => {
        const params = new URLSearchParams();
        if (filtros?.excluir_convocatoria != null) {
            params.append("excluir_convocatoria", String(filtros.excluir_convocatoria));
        }
        const q = params.toString();
        return apiClient.get<PaginatedResponse<Postulante>>(
            `/postulantes/${q ? `?${q}` : ""}`
        );
    },

    /**
     * Obtiene un postulante por ID.
     * GET /api/postulantes/{id}/
     */
    getById: (id: number): Promise<Postulante> =>
        apiClient.get<Postulante>(`/postulantes/${id}/`),

    /**
     * Crea un nuevo postulante.
     * POST /api/postulantes/
     */
    create: (data: PostulanteCreate): Promise<Postulante> =>
        apiClient.post<Postulante>("/postulantes/", data),

    /**
     * Actualiza parcialmente un postulante.
     * PATCH /api/postulantes/{id}/
     */
    // data puede incluir cualquier campo del recurso de postulante, incluyendo estado
    update: (id: number, data: Partial<Postulante>): Promise<Postulante> =>
        apiClient.patch<Postulante>(`/postulantes/${id}/`, data),
};
