/**
 * Servicio para Documentos.
 * Endpoints:
 *   GET  /api/documentos/
 *   POST /api/documentos/          (multipart/form-data)
 *   GET  /api/documentos/{id}/
 *   PATCH /api/documentos/{id}/
 */
import { apiClient } from "@/lib/api";
import type {
    Documento,
    DocumentoActualizacion,
    DocumentoUploadData,
    PaginatedResponse,
} from "@/types/api";

export interface DocumentosFiltros {
    postulante?: number;
    convocatoria?: number;
    documento_requerido?: number;
    estado?: string;
    estado_semaforo?: string;
}

export const documentosService = {
    /**
     * Lista documentos con filtros opcionales.
     * GET /api/documentos/?postulante=&convocatoria=&estado=
     */
    getAll: (filtros?: DocumentosFiltros): Promise<PaginatedResponse<Documento>> => {
        const params = new URLSearchParams();
        if (filtros?.postulante) params.append("postulante", String(filtros.postulante));
        if (filtros?.convocatoria) params.append("convocatoria", String(filtros.convocatoria));
        if (filtros?.documento_requerido) params.append("documento_requerido", String(filtros.documento_requerido));
        if (filtros?.estado) params.append("estado", filtros.estado);
        if (filtros?.estado_semaforo) params.append("estado_semaforo", filtros.estado_semaforo);
        const query = params.toString();
        return apiClient.get<PaginatedResponse<Documento>>(
            `/documentos/${query ? `?${query}` : ""}`
        );
    },

    /**
     * Obtiene un documento por ID.
     * GET /api/documentos/{id}/
     */
    getById: (id: number): Promise<Documento> =>
        apiClient.get<Documento>(`/documentos/${id}/`),

    eliminar: (id: number): Promise<void> =>
        apiClient.delete<void>(`/documentos/${id}/`),

    /**
     * Sube un documento al servidor (multipart/form-data).
     * El campo del archivo en Django es "archivo", no "file".
     * POST /api/documentos/
     */
    subir: (data: DocumentoUploadData): Promise<Documento> => {
        const formData = new FormData();
        formData.append("archivo", data.archivo);
        if (data.postulante) formData.append("postulante", String(data.postulante));
        if (data.convocatoria) formData.append("convocatoria", String(data.convocatoria));
        if (data.documento_requerido)
            formData.append("documento_requerido", String(data.documento_requerido));
        if (data.fecha_emision) formData.append("fecha_emision", data.fecha_emision);
        if (data.fecha_vencimiento)
            formData.append("fecha_vencimiento", data.fecha_vencimiento);
        if (data.numero_documento_usuario)
            formData.append("numero_documento_usuario", data.numero_documento_usuario);

        return apiClient.uploadFile<Documento>("/documentos/", data.archivo, {
            postulante: data.postulante,
            convocatoria: data.convocatoria,
            documento_requerido: data.documento_requerido,
            fecha_emision: data.fecha_emision,
            fecha_vencimiento: data.fecha_vencimiento,
            numero_documento_usuario: data.numero_documento_usuario,
        });
    },

    /**
     * Actualiza el estado de un documento (aprobar / rechazar).
     * PATCH /api/documentos/{id}/
     */
    actualizarEstado: (
        id: number,
        data: DocumentoActualizacion
    ): Promise<Documento> =>
        apiClient.patch<Documento>(`/documentos/${id}/`, data),
};
