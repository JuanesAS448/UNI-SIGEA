import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usePostulantes, useCrearPostulante, useActualizarPostulante, useEliminarPostulante } from "@/hooks/usePostulantes";
import { toast } from "@/hooks/use-toast";
import type { Postulante, PostulanteCreate } from "@/types/api";

const empty: PostulanteCreate = { nombres: "", apellidos: "", tipo_documento: "Cédula de Ciudadanía", numero_documento: "", email: "", telefono: "", direccion: "" };
const fields = [
  ["nombres", "Nombres", 100], ["apellidos", "Apellidos", 100],
  ["tipo_documento", "Tipo de documento", 50], ["numero_documento", "Número de documento", 12],
  ["email", "Correo electrónico", 254], ["telefono", "Teléfono", 20], ["direccion", "Dirección", 255],
] as const;

function mensajeError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo guardar el cambio.";
  try {
    const body = JSON.parse(message.replace(/^HTTP \d+: /, ""));
    return Object.entries(body).map(([key, value]) => `${fields.find(([name]) => name === key)?.[1] ?? (key === "detail" ? "" : key)}: ${Array.isArray(value) ? value.join(" ") : value}`).join(" · ");
  } catch { return message; }
}

export default function Postulantes() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [estado, setEstado] = useState<"" | "activo" | "inactivo">("");
  const query = usePostulantes({ page, search, estado: estado || undefined });
  const crear = useCrearPostulante();
  const actualizar = useActualizarPostulante();
  const eliminar = useEliminarPostulante();
  const [modal, setModal] = useState<"crear" | "editar" | "ver" | "eliminar" | "estado" | null>(null);
  const [selected, setSelected] = useState<Postulante | null>(null);
  const [form, setForm] = useState<PostulanteCreate>(empty);
  const [error, setError] = useState("");
  const pending = crear.isPending || actualizar.isPending || eliminar.isPending;
  const rows = query.data?.results ?? [];
  useEffect(() => {
    if (page > 1 && query.isError) setPage(1);
  }, [page, query.isError]);

  function open(mode: NonNullable<typeof modal>, candidate: Postulante | null = null) {
    setSelected(candidate);
    setForm(candidate ? Object.fromEntries(fields.map(([name]) => [name, candidate[name]])) as unknown as PostulanteCreate : { ...empty });
    setError("");
    setModal(mode);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError("");
    try {
      if (modal === "crear") await crear.mutateAsync(form);
      if (modal === "editar" && selected) await actualizar.mutateAsync({ id: selected.id, data: form });
      if (modal === "eliminar" && selected) {
        await eliminar.mutateAsync(selected.id);
        if (rows.length === 1 && page > 1) setPage(page - 1);
      }
      if (modal === "estado" && selected) await actualizar.mutateAsync({ id: selected.id, data: { estado: selected.estado === "activo" ? "inactivo" : "activo" } });
      toast({ title: modal === "eliminar" ? "Postulante eliminado" : "Cambios guardados" });
      setModal(null);
    } catch (err) { setError(mensajeError(err)); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Postulantes</h1><p className="text-sm text-muted-foreground">{query.data?.count ?? "—"} registros · Administra sus datos y estado.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>Actualizar</Button><Button onClick={() => open("crear")}>Nuevo postulante</Button></div>
    </div>
    <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(draftSearch.trim()); }}>
      <Input className="max-w-md" aria-label="Buscar postulantes" placeholder="Nombre, apellido, documento o correo" value={draftSearch} onChange={e => setDraftSearch(e.target.value)} />
      <Button type="submit" variant="outline">Buscar</Button>
      <select aria-label="Filtrar por estado" className="rounded-md border bg-background px-3 text-sm" value={estado} onChange={e => { setEstado(e.target.value as typeof estado); setPage(1); }}>
        <option value="">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
      </select>
    </form>
    {query.isLoading ? <p role="status">Cargando postulantes…</p> : query.isError ? <p role="alert" className="text-destructive">No se pudieron cargar los postulantes. Usa Actualizar para intentar nuevamente.</p> : <>
      <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
        <thead><tr className="border-b text-left"><th className="p-4">Postulante</th><th className="p-4">Documento</th><th className="p-4">Contacto</th><th className="p-4">Estado</th><th className="p-4">Acciones</th></tr></thead>
        <tbody>{rows.map(p => <tr key={p.id} className="border-b last:border-0">
          <td className="p-4 font-medium">{p.nombres} {p.apellidos}</td><td className="p-4">{p.tipo_documento}<br />{p.numero_documento}</td>
          <td className="p-4">{p.email}<br />{p.telefono}</td><td className="p-4"><Badge variant={p.estado === "activo" ? "default" : "secondary"}>{p.estado === "activo" ? "Activo" : "Inactivo"}</Badge></td>
          <td className="p-4"><div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => open("ver", p)}>Consultar</Button>
            <Button size="sm" variant="outline" onClick={() => open("editar", p)}>Editar</Button>
            <Button size="sm" variant="outline" onClick={() => open("estado", p)}>{p.estado === "activo" ? "Desactivar" : "Activar"}</Button>
            {p.puede_eliminar && <Button size="sm" variant="destructive" onClick={() => open("eliminar", p)}>Eliminar</Button>}
          </div></td>
        </tr>)}</tbody>
      </table>{!rows.length && <p className="p-8 text-center text-muted-foreground">No hay postulantes que coincidan con la búsqueda.</p>}</div>
      <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={!query.data?.previous || query.isFetching} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button variant="outline" disabled={!query.data?.next || query.isFetching} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </>}
    <Dialog open={modal !== null} onOpenChange={value => { if (!value && !pending) setModal(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{modal === "crear" ? "Nuevo postulante" : modal === "editar" ? "Editar postulante" : modal === "ver" ? "Datos del postulante" : modal === "eliminar" ? "Eliminar postulante" : selected?.estado === "activo" ? "Desactivar postulante" : "Activar postulante"}</DialogTitle>
          <DialogDescription>{modal === "crear" ? "Crea una ficha manual. Esta operación no crea una cuenta de acceso." : modal === "editar" ? "Los cambios en nombres o documento requieren revisar nuevamente sus documentos de identidad." : "Consulta o administra la ficha conservando sus registros asociados."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {(modal === "crear" || modal === "editar") && <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">{fields.map(([name, label, length]) => <div key={name} className={name === "direccion" ? "sm:col-span-2" : ""}>
            <Label htmlFor={`postulante-${name}`}>{label}</Label><Input id={`postulante-${name}`} required maxLength={length} type={name === "email" ? "email" : "text"} pattern={name === "numero_documento" ? "[0-9]{6,12}" : undefined} title={name === "numero_documento" ? "Entre 6 y 12 dígitos, sin puntos" : undefined} value={form[name] ?? ""} onChange={e => setForm({ ...form, [name]: e.target.value })} />
          </div>)}</fieldset>}
          {modal === "ver" && selected && <dl className="grid gap-3 sm:grid-cols-2">{fields.map(([name, label]) => <div key={name}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words">{selected[name] || "Sin información"}</dd></div>)}
            <div><dt className="text-sm text-muted-foreground">Cuenta vinculada</dt><dd>{selected.usuario?.username ?? "Sin cuenta"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Registro</dt><dd>{new Date(selected.fecha_registro).toLocaleDateString("es-CO")}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Registros asociados</dt><dd>{selected.documentos_count ?? 0} documentos · {selected.expedientes_count ?? 0} expedientes</dd></div>
            {!selected.puede_eliminar && <p className="text-sm text-muted-foreground sm:col-span-2">Tiene cuenta o registros asociados. Puedes desactivarlo para conservar el historial.</p>}
          </dl>}
          {modal === "eliminar" && <p>Se eliminará la ficha de <strong>{selected?.nombres} {selected?.apellidos}</strong>. Esta acción no se puede deshacer.</p>}
          {modal === "estado" && <div className="space-y-2"><p className="font-medium">{selected?.nombres} {selected?.apellidos} · {selected?.numero_documento}</p><p>{selected?.estado === "activo" ? "Se desactivará el postulante y su acceso, si tiene cuenta. Sus documentos y expedientes se conservarán." : "Se activará el postulante y su acceso, si tiene cuenta."}</p></div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setModal(null)}>{modal === "ver" ? "Cerrar" : "Cancelar"}</Button>{modal !== "ver" && <Button type="submit" disabled={pending} variant={modal === "eliminar" ? "destructive" : "default"}>{pending ? "Guardando…" : modal === "eliminar" ? "Confirmar eliminación" : modal === "estado" ? "Confirmar" : "Guardar"}</Button>}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
