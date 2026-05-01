import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";

import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Convocatorias from "./pages/Convocatorias";
import ConvocatoriasArchivadas from "./pages/ConvocatoriasArchivadas";
import NuevaConvocatoria from "./pages/NuevaConvocatoria";
import ConvocatoriaDetalle from "./pages/ConvocatoriaDetalle";
import Documentos from "./pages/Documentos";
import SemaforoDocs from "./pages/SemaforoDocs";
import Expedientes from "./pages/Expedientes";
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

            {/* Rutas Protegidas (dentro de AppLayout con barra lateral) */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/convocatorias" element={<Convocatorias />} />
              <Route path="/convocatorias/archivadas" element={<ConvocatoriasArchivadas />} />
              <Route path="/convocatorias/nueva" element={<NuevaConvocatoria />} />
              <Route path="/convocatorias/:id" element={<ConvocatoriaDetalle />} />
              <Route path="/documentos" element={<Documentos />} />
              <Route path="/documentos/semaforo/:status" element={<SemaforoDocs />} />
              <Route path="/portal-postulante" element={<PortalPostulante />} />
              <Route path="/expedientes" element={<Expedientes />} />
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;