import { useState, FormEvent, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

/**
 * Paso 2: enlace con uid y token (query) desde el correo o consola.
 */
export default function RestablecerContrasena() {
  const [searchParams] = useSearchParams();
  const uid = useMemo(() => searchParams.get("uid") ?? "", [searchParams]);
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (!uid || !token) {
      toast.error("Enlace incompleto. Use el enlace recibido por correo.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<{ detail?: string }>("/auth/reset-password/", {
        uid,
        token,
        new_password: password,
      });
      toast.success(res.detail ?? "Contraseña actualizada.");
      setPassword("");
      setPassword2("");
    } catch {
      toast.error("El enlace no es válido o expiró. Solicite uno nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!uid || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enlace inválido</CardTitle>
            <CardDescription>
              Abra esta página desde el enlace que le enviamos, o solicite una nueva recuperación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/recuperar-contrasena">Solicitar recuperación</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nueva contraseña</CardTitle>
          <CardDescription>Elija una contraseña segura (mínimo 6 caracteres).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="np1">Nueva contraseña</Label>
              <Input
                id="np1"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np2">Confirmar contraseña</Label>
              <Input
                id="np2"
                type="password"
                minLength={6}
                required
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar contraseña
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Ir al inicio de sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
