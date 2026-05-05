import { useState } from "react";
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

export function AppSidebar() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
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
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-in-out z-20 relative",
        isExpanded ? "w-64 absolute md:relative" : "w-20"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div className="flex h-[80px] items-center justify-center border-b-2 border-primary px-6 shrink-0 overflow-hidden">
        <img
          src="/logo.png"
          alt="UNI SIGEA Logo"
          className={cn(
            "h-16 w-auto object-contain transition-all duration-300",
            !isExpanded && "scale-150 origin-center"
          )}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors overflow-hidden whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                !isExpanded && "justify-center px-0"
              )}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {isExpanded && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn("border-t border-border p-4 transition-all duration-300", !isExpanded && "flex justify-center p-2")}>
        <div className={cn("flex items-center gap-3", !isExpanded && "flex-col gap-2")}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            title={displayName}
          >
            {initial}
          </div>

          {isExpanded && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {session ? session.rol.replace("_", " ") : "Invitado"}
              </p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
