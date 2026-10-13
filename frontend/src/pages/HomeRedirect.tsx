import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "./Dashboard";

/**
 * Raíz del sistema: postulantes van al portal; admin/revisor al dashboard.
 */
export default function HomeRedirect() {
  const { session } = useAuth();

  if (session?.rol === "postulante") {
    return <Navigate to="/portal-postulante" replace />;
  }

  return <Dashboard />;
}
