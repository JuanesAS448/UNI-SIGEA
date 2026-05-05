import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import SolicitarRecuperacion from "./pages/SolicitarRecuperacion";
import RestablecerContrasena from "./pages/RestablecerContrasena";
import CambiarContrasena from "./pages/CambiarContrasena";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { StaffOnly } from "@/components/auth/StaffOnly";
import HomeRedirect from "./pages/HomeRedirect";
import Convocatorias from "./pages/Convocatorias";
import ConvocatoriasArchivadas from "./pages/ConvocatoriasArchivadas";
import NuevaConvocatoria from "./pages/NuevaConvocatoria";
import ConvocatoriaDetalle from "./pages/ConvocatoriaDetalle";
import Documentos from "./pages/Documentos";
import SemaforoDocs from "./pages/SemaforoDocs";
import Usuarios from "./pages/Usuarios";
import PortalPostulante from "./pages/PortalPostulante";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Login fuera del AppLayout (sin barra lateral) */}
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-contrasena" element={<SolicitarRecuperacion />} />
            <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />

            {/* Sesión requerida; postulantes y staff comparten layout */}
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/convocatorias" element={<StaffOnly><Convocatorias /></StaffOnly>} />
              <Route path="/convocatorias/archivadas" element={<StaffOnly><ConvocatoriasArchivadas /></StaffOnly>} />
              <Route path="/convocatorias/nueva" element={<StaffOnly><NuevaConvocatoria /></StaffOnly>} />
              <Route path="/convocatorias/:id" element={<StaffOnly><ConvocatoriaDetalle /></StaffOnly>} />
              <Route path="/documentos" element={<StaffOnly><Documentos /></StaffOnly>} />
              <Route path="/documentos/semaforo/:status" element={<StaffOnly><SemaforoDocs /></StaffOnly>} />
              <Route path="/portal-postulante" element={<PortalPostulante />} />
              <Route path="/cambiar-contrasena" element={<CambiarContrasena />} />
              <Route path="/expedientes" element={<StaffOnly><Navigate to="/documentos?tab=expedientes" replace /></StaffOnly>} />
              <Route path="/usuarios" element={<StaffOnly><Usuarios /></StaffOnly>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;