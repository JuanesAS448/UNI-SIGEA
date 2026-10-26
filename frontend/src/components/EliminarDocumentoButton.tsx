import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEliminarDocumento } from "@/hooks/useDocumentos";
import { toast } from "@/hooks/use-toast";
import type { Documento } from "@/types/api";

interface Props {
  documento: Pick<Documento, "id" | "nombre_archivo">;
  onDeleted?: () => void;
}

export function EliminarDocumentoButton({ documento, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const eliminar = useEliminarDocumento();

  const confirmar = async () => {
    try {
      await eliminar.mutateAsync(documento.id);
    } catch {
      return; // El diálogo muestra el error y permite cancelar o reintentar.
    }
    setOpen(false);
    toast({ title: "Documento eliminado", description: "Se eliminó de UNI SIGEA. La copia de SharePoint se conserva." });
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={(value) => {
      if (!eliminar.isPending) {
        setOpen(value);
        if (value) eliminar.reset();
      }
    }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" aria-label={`Eliminar ${documento.nombre_archivo ?? "documento"}`}>
          <Trash2 className="h-4 w-4" />Eliminar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminarán el registro y el archivo de {documento.nombre_archivo ?? "este documento"} en UNI SIGEA.
            Esta acción no se puede deshacer. La copia de SharePoint se conserva.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {eliminar.isError && (
          <p role="alert" className="text-sm text-destructive">
            No se pudo eliminar el documento. Comprueba tus permisos y que la convocatoria permita cambios.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={eliminar.isPending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={eliminar.isPending} onClick={confirmar}>
            {eliminar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {eliminar.isPending ? "Eliminando…" : "Eliminar documento"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
