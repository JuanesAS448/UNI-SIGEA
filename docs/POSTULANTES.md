# Gestión de postulantes

En el menú **Postulantes**, administradores y revisores pueden crear fichas,
consultar sus datos, editarlas, buscar por nombre/documento/correo y filtrar por
estado. La lista usa paginación del servidor.

- **Nuevo postulante** crea una ficha manual sin cuenta de acceso.
- **Editar** valida documento de 6 a 12 dígitos y documento/correo únicos.
  Si existe una cuenta vinculada, sincroniza sus nombres, apellidos y correo;
  conserva el nombre de usuario y la contraseña.
- **Desactivar / Activar** conserva documentos y expedientes. También cambia
  el acceso de la cuenta vinculada. Requiere confirmación en pantalla.
- **Eliminar** requiere confirmación y solo está disponible para fichas sin
  cuenta, documentos ni expedientes. La API vuelve a comprobarlo y responde
  HTTP 409 si ya existen relaciones.

Cambiar nombres, apellidos o número de documento actualiza la comparación
de las extracciones de identidad existentes y deja esos documentos en revisión
(amarillo). Conserva sus valores extraídos, confianza e historial; no vuelve
a llamar a Power Automate ni aprueba documentos automáticamente.

La API `/api/postulantes/` requiere autenticación. Los postulantes únicamente
pueden consultar su propia ficha; las operaciones de escritura requieren rol
administrador o revisor. Se admiten `search`, `estado`, `numero_documento`,
`page` y `excluir_convocatoria` como filtros de consulta.

No requiere nuevas migraciones. Pruebas con registros ficticios:

```powershell
backend\.venv\Scripts\python.exe -B backend/manage.py test documental.tests documental.test_postulantes --noinput
```

Desde `frontend`:

```powershell
npm.cmd test
npm.cmd exec tsc -- -p tsconfig.app.json --noEmit
npm.cmd run build
```
