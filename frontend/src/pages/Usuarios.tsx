import { useState } from "react";
import { Shield, UserCheck, GraduationCap, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useUsuarios, useActualizarRol } from "@/hooks/useUsuarios";
import type { UsuarioPerfil } from "@/types/api";
import type { RolUsuario } from "@/services/usuariosService";

type Rol = "admin" | "revisor" | "postulante";

const roleConfig: Record<Rol, { icon: typeof Shield; label: string; badgeClass: string }> = {
  admin:       { icon: Shield,       label: "Administrador", badgeClass: "bg-primary/10 text-primary border-primary/30" },
  revisor:     { icon: UserCheck,    label: "Revisor",       badgeClass: "bg-blue-500/10 text-blue-600 border-blue-300/30" },
  postulante:  { icon: GraduationCap, label: "Postulante",  badgeClass: "bg-muted text-muted-foreground border-border" },
};

const roles: Rol[] = ["admin", "revisor", "postulante"];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
}

function UsuarioRow({ perfil }: { perfil: UsuarioPerfil }) {
  const { mutate: actualizarRol, isPending } = useActualizarRol();
  const [localRol, setLocalRol] = useState<Rol>(perfil.rol as Rol);

  const config = roleConfig[localRol] ?? roleConfig["postulante"];
  const Icon = config.icon;

  const handleRolChange = (nuevoRol: RolUsuario) => {
    actualizarRol(
      { id: perfil.id, data: { rol: nuevoRol } },
      {
        onSuccess: () => {
          setLocalRol(nuevoRol as Rol);
          toast({ title: "Rol actualizado", description: `${perfil.usuario.first_name} ahora es ${roleConfig[nuevoRol as Rol].label}.` });
        },
        onError: () => {
          toast({ title: "Error", description: "No se pudo actualizar el rol.", variant: "destructive" });
        },
      }
    );
  };

  const fullName = [perfil.usuario.first_name, perfil.usuario.last_name].filter(Boolean).join(" ") || perfil.usuario.username;
  const initials = getInitials(perfil.usuario.first_name, perfil.usuario.last_name);

  return (
    <tr className="hover:bg-accent/50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shrink-0">
            {initials}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">@{perfil.usuario.username}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-muted-foreground">{perfil.usuario.email || "—"}</td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              <Badge variant="outline" className={`gap-1 border ${config.badgeClass}`}>
                {config.label}
              </Badge>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {roles.map((r) => {
              const rc = roleConfig[r];
              const RIcon = rc.icon;
              return (
                <DropdownMenuItem
                  key={r}
                  onClick={() => handleRolChange(r)}
                  className="gap-2 cursor-pointer"
                  disabled={r === localRol}
                >
                  <RIcon className="h-4 w-4" />
                  {rc.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
      <td className="px-6 py-4 text-xs text-muted-foreground">
        {new Date(perfil.creado_en).toLocaleDateString("es-CO")}
      </td>
    </tr>
  );
}

export default function Usuarios() {
  const { data, isLoading, isError, refetch, isFetching } = useUsuarios();
  const perfiles = data?.results ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de usuarios y roles del sistema
            {data && <span className="ml-2 text-xs">({data.count} registros)</span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Cargando usuarios...</span>
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-destructive font-medium">Error al cargar usuarios</p>
            <p className="text-xs text-muted-foreground mt-1">¿Está el backend corriendo en localhost:8000?</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
              Reintentar
            </Button>
          </div>
        ) : perfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No hay usuarios registrados</p>
            <p className="mt-1 text-xs text-muted-foreground">Los usuarios aparecen aquí al registrarse en el sistema</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Registrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {perfiles.map((perfil) => (
                  <UsuarioRow key={perfil.id} perfil={perfil} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen por roles */}
      {perfiles.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {roles.map((r) => {
            const count = perfiles.filter((p) => p.rol === r).length;
            const rc = roleConfig[r];
            const RIcon = rc.icon;
            return (
              <div key={r} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <RIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{rc.label}{count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
