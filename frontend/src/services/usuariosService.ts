/**
 * Servicio para UsuarioPerfil.
 * Endpoints: GET /api/usuarios-perfil/ · PATCH /api/usuarios-perfil/{id}/
 */
import { apiClient } from "@/lib/api";
import type { UsuarioPerfil, PaginatedResponse } from "@/types/api";

export type RolUsuario = "admin" | "revisor" | "postulante";

export interface UsuarioPerfilUpdate {
  rol: RolUsuario;
}

export const usuariosService = {
  /**
   * Lista todos los perfiles de usuario (paginado).
   * GET /api/usuarios-perfil/
   */
  getAll: (): Promise<PaginatedResponse<UsuarioPerfil>> =>
    apiClient.get<PaginatedResponse<UsuarioPerfil>>("/usuarios-perfil/"),

  /**
   * Obtiene un perfil por ID.
   * GET /api/usuarios-perfil/{id}/
   */
  getById: (id: number): Promise<UsuarioPerfil> =>
    apiClient.get<UsuarioPerfil>(`/usuarios-perfil/${id}/`),

  /**
   * Actualiza el rol de un perfil (PATCH).
   * PATCH /api/usuarios-perfil/{id}/
   */
  updateRol: (id: number, data: UsuarioPerfilUpdate): Promise<UsuarioPerfil> =>
    apiClient.patch<UsuarioPerfil>(`/usuarios-perfil/${id}/`, data),
};
