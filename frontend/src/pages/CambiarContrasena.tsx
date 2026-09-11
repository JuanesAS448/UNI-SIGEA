import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Cambio de contraseña con sesión iniciada (sustituir clave temporal o genérica).
 */
export default function CambiarContrasena() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("La nueva contraseña y la confirmación no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const err = await changePassword(current, next);
      if (err) {
        toast.error(err);
      } else {
        toast.success("Contraseña actualizada.");
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            Si un administrador le asignó una contraseña temporal, cámbiela aquí tras iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Contraseña actual</Label>
              <Input
                id="cur"
                type="password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nw">Nueva contraseña</Label>
              <Input
                id="nw"
                type="password"
                minLength={6}
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cf">Confirmar nueva contraseña</Label>
              <Input
                id="cf"
                type="password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
