import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Rutas de gestión (dashboard, convocatorias, documentos globales, usuarios).
 * Los postulantes se redirigen al portal.
 */
export function StaffOnly({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  if (session?.rol === "postulante") {
    return <Navigate to="/portal-postulante" replace />;
  }

  return <>{children}</>;
}
