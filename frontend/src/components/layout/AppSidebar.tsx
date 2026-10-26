import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  FolderCheck,
  LogOut,
  GraduationCap,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const staffNavItems = [
  { label: "Dashboard",     icon: LayoutDashboard, href: "/" },
  { label: "Convocatorias", icon: ClipboardList,   href: "/convocatorias" },
  { label: "Archivadas",    icon: FolderCheck,     href: "/convocatorias/archivadas" },
  { label: "Documentación", icon: FileText,        href: "/documentos" },
  { label: "Expedientes",   icon: FolderCheck,     href: "/expedientes" },
  { label: "Postulantes",   icon: GraduationCap,   href: "/portal-postulante" },
  { label: "Usuarios",      icon: Users,           href: "/usuarios" },
  { label: "Cambiar contraseña", icon: KeyRound, href: "/cambiar-contrasena" },
];

const postulanteNavItems = [
  { label: "Mi postulación", icon: GraduationCap, href: "/portal-postulante" },
  { label: "Cambiar contraseña", icon: KeyRound, href: "/cambiar-contrasena" },
];

export function AppSidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const location = useLocation();
  const navigate  = useNavigate();
  const { session, signOut } = useAuth();

  const navItems =
    session?.rol === "postulante" ? postulanteNavItems : staffNavItems;

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  // Obtiene iniciales del nombre o email del usuario
  const displayName = session?.email ?? "Usuario";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      id="app-sidebar"
      aria-label="Navegación principal"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card shadow-lg transition-transform duration-200 ease-out lg:static lg:z-20 lg:w-[232px] lg:translate-x-0 lg:shadow-none",
        mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center justify-center overflow-hidden border-b border-border px-5 lg:h-[72px]">
        <img
          src="/logo.png"
          alt="UNI SIGEA Logo"
          className="h-14 w-auto object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 overflow-hidden whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
              onClick={onMobileClose}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
            title={displayName}
          >
            {initial}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground capitalize">
              {session ? session.rol.replace("_", " ") : "Invitado"}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
