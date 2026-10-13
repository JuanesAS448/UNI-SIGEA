import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

/**
 * Paso 1: el usuario indica su correo; el backend envía el enlace (en desarrollo suele verse en la consola del servidor).
 */
export default function SolicitarRecuperacion() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ detail?: string }>("/auth/forgot-password/", { email });
      toast.success(res.detail ?? "Revise su correo o la consola del servidor en modo desarrollo.");
      setEmail("");
    } catch {
      toast.error("No se pudo procesar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
          <CardDescription>
            Si su correo está registrado, recibirá un enlace para elegir una nueva contraseña. En entorno de
            desarrollo el mensaje puede mostrarse en la terminal donde corre Django.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rec-email">Correo electrónico</Label>
              <Input
                id="rec-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar instrucciones
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
