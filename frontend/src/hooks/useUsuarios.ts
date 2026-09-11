/**
 * Hooks React Query para UsuariosPerfil.
 *
 * useUsuarios()      → lista todos los perfiles de usuario (GET)
 * useActualizarRol() → mutation PATCH para cambiar el rol de un usuario
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usuariosService, type UsuarioPerfilUpdate } from "@/services/usuariosService";
import type { UsuarioPerfil } from "@/types/api";

export const USUARIOS_KEY = ["usuarios-perfil"] as const;

// ── Lista ─────────────────────────────────────────────────────────────────────
export function useUsuarios() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: usuariosService.getAll,
    staleTime: 30_000,
  });
}

// ── Mutation: actualizar rol ──────────────────────────────────────────────────
export function useActualizarRol() {
  const queryClient = useQueryClient();

  return useMutation<UsuarioPerfil, Error, { id: number; data: UsuarioPerfilUpdate }>({
    mutationFn: ({ id, data }) => usuariosService.updateRol(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USUARIOS_KEY });
    },
  });
}
