/**
 * Tipos TypeScript que mapean 1:1 con los serializers de Django (G-Doc backend).
 * Referencia: backend/documental/serializers.py
 */

// ──────────────────────────────────────────────────────────────────────────────
// Respuesta paginada genérica (DRF PageNumberPagination)
// ──────────────────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Usuario
// ──────────────────────────────────────────────────────────────────────────────
export interface Usuario {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
}

export interface UsuarioPerfil {
    id: number;
    usuario: Usuario;
    rol: "admin" | "revisor" | "postulante";
    creado_en: string;
    actualizado_en: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Postulante
// ──────────────────────────────────────────────────────────────────────────────
export type EstadoPostulante = "activo" | "inactivo";

export interface Postulante {
    puede_eliminar?: boolean;
    documentos_count?: number;
    expedientes_count?: number;
    id: number;
    usuario: Usuario | null;
    nombres: string;
    apellidos: string;
    tipo_documento: string;
    numero_documento: string;
    email: string;
    telefono: string;
    direccion: string;
    fecha_registro: string;
    estado: EstadoPostulante;
}

export interface PostulanteCreate {
    nombres: string;
    apellidos: string;
    tipo_documento?: string;
    numero_documento: string;
    email: string;
    telefono: string;
    direccion: string;
}

// Actualización parcial de postulante. El backend permite cambiar también el estado.
export interface PostulanteUpdate {
    nombres?: string;
    apellidos?: string;
    tipo_documento?: string;
    numero_documento?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    estado?: EstadoPostulante;
}

// ──────────────────────────────────────────────────────────────────────────────
// Convocatoria
// ──────────────────────────────────────────────────────────────────────────────
export type EstadoConvocatoria = "abierta" | "cerrada";

export interface Convocatoria {
    id: number;
    titulo: string;
    descripcion: string;
    estado: EstadoConvocatoria;
    archivado: boolean;
    fecha_inicio: string;   // YYYY-MM-DD
    fecha_fin: string;      // YYYY-MM-DD
    documentos_requeridos: DocumentoRequerido[];
    // listado de postulantes asociados, puede venir vacío
    postulantes?: Postulante[];
    postulantes_count: number;
    is_abierta: boolean;
    creado_en: string;
    actualizado_en: string;
}

export interface DocumentoRequerido {
    id: number;
    nombre: string;
    descripcion: string;
    obligatorio: boolean;
    convocatoria: number;
    subido_por?: { id: number; nombres: string; apellidos: string }[];
    documentos_count?: number;
}

export interface DocumentoRequeridoCreate {
    nombre: string;
    descripcion: string;
    obligatorio?: boolean;
    convocatoria: number;
}


export interface ConvocatoriaCreate {
    titulo: string;
    descripcion: string;
    estado?: EstadoConvocatoria;
    archivado?: boolean;
    fecha_inicio: string;
    fecha_fin: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Documento
// ──────────────────────────────────────────────────────────────────────────────
export type EstadoDocumento = "pendiente" | "en_revision" | "aprobado" | "rechazado";
export type EstadoSemaforo = "verde" | "amarillo" | "rojo";
export type TipoValidacion = "automatica" | "manual";

export type CampoIdentidad =
    | "nombres" | "apellidos" | "numero_cedula" | "fecha_nacimiento"
    | "fecha_expedicion" | "tipo_sangre" | "sexo" | "lugar_expedicion";

export interface DatosExtraidosIdentidad {
    origen: "ai_builder";
    tipo_documento: "documento_identidad";
    valores: Record<CampoIdentidad, string | null>;
    confianzas: Record<CampoIdentidad, number | null>;
    comparacion: {
        coincidencia_identidad: boolean;
        campos: Partial<Record<CampoIdentidad, { registrado: string; coincide: boolean | null }>>;
    };
}

export interface ResumenExtraccion {
    confianza_promedio: number | null;
    campos_esperados: number;
    campos_extraidos: number;
    confianzas_disponibles: number;
    campos_faltantes: CampoIdentidad[];
    extraccion_completa: boolean;
    coincidencia_identidad: boolean;
    tiene_alertas_de_datos: boolean;
    revision_pendiente: boolean;
}

export interface Documento {
    id: number;
    archivo: string;                          // ruta relativa en el servidor
    nombre_archivo: string | null;            // solo el nombre del archivo
    url_archivo: string | null;               // URL absoluta para descarga
    postulante: number | null;
    postulante_nombre: string | null;
    convocatoria: number | null;
    convocatoria_titulo: string | null;
    documento_requerido: number | null;
    documento_requerido_nombre: string | null;
    fecha_emision: string | null;
    fecha_vencimiento: string | null;
    estado: EstadoDocumento;
    estado_semaforo: EstadoSemaforo;
    texto_extraido: string | null;
    confianza_ocr: number;                    // 0-100
    datos_extraidos?: DatosExtraidosIdentidad | Record<string, never>;
    resumen_extraccion?: ResumenExtraccion | null;
    observaciones: string | null;
    tipo_validacion: TipoValidacion;
    numero_documento_usuario: string | null;
    fecha_carga: string;
}

export interface DocumentoActualizacion {
    estado?: EstadoDocumento;
    observaciones?: string;
    estado_semaforo?: EstadoSemaforo;
}

export interface DocumentoUploadData {
    archivo: File;
    postulante?: number;
    convocatoria?: number;
    documento_requerido?: number;
    fecha_emision?: string;
    fecha_vencimiento?: string;
    numero_documento_usuario?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Expediente
// ──────────────────────────────────────────────────────────────────────────────
export type EstadoExpediente = "completo" | "incompleto" | "en_proceso";

export interface Expediente {
    id: number;
    postulante: number;
    postulante_nombre: string;
    postulante_apellidos: string;
    postulante_numero_documento: string;
    postulante_email: string;
    convocatoria: number;
    convocatoria_titulo: string;
    estado: EstadoExpediente;
    documentos_count: number;
    documentos_aprobados_count: number;
    progreso_porcentaje: number;
    creado_en: string;
    actualizado_en: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Stats
// ──────────────────────────────────────────────────────────────────────────────
export interface DashboardStats {
    total_documentos: number;
    documentos_aprobados: number;
    documentos_pendientes: number;
    documentos_rechazados: number;
    documentos_en_revision: number;
    semaforo_verde: number;
    semaforo_amarillo: number;
    semaforo_rojo: number;
    convocatorias_activas: number;
    convocatorias_cerradas: number;
    total_postulantes: number;
    expedientes_total: number;
    expedientes_completos: number;
    expedientes_incompletos: number;
    expedientes_en_proceso: number;
    documentos_vencidos: number;
    documentos_por_vencer: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────────────────────────────────
export interface ApiHealth {
    status: "ok" | "error";
    message: string;
    version: string;
}
