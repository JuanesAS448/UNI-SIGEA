# UNI SIGEA - Documentación y Endpoints

Este archivo contiene la referencia de los endpoints (API de backend) corporativos y los enlaces a las vistas (Frontend) correspondientes a los diferentes CRUD del sistema.

## Enlaces del Frontend (Rutas / Vistas)

A continuación se detallan las rutas principales de navegación de la aplicación en React/Vite, donde se gestionan los distintos modelos (CRUDs):

| Módulo / Acción | Ruta en Frontend | Descripción |
|---|---|---|
| **Autenticación** | `/login` | Pantalla de inicio de sesión de usuarios. |
| **Dashboard** | `/` | Panel principal e inicio de la aplicación. |
| **Convocatorias** | `/convocatorias` | Listado y gestión principal (CRUD) de convocatorias. |
| **Convocatoria (Nueva)**| `/convocatorias/nueva` | Formulario para la creación de una nueva convocatoria. |
| **Convocatoria (Detalles)**| `/convocatorias/:id` | Vista detallada e información particular de una convocatoria. |
| **Convocatorias Archivadas**| `/convocatorias/archivadas` | Vista de convocatorias en estado archivado. |
| **Documentos & Requisitos** | `/documentos` | Gestión de documentos (incluye CRUD de Documento Requerido / Documentos). |
| **Doc. Semáforo** | `/documentos/semaforo/:status`| Filtrado de documentos por estado de alerta/semáforo dependiendo del avance. |
| **Postulantes** | `/portal-postulante`| Portal y registro de postulantes. |
| **Expedientes** | `/expedientes` | Listado y CRUD general de expedientes de los aspirantes/postulantes. |
| **Usuarios** | `/usuarios` | Gestión y CRUD de usuarios del sistema. |

---

## Endpoints del Backend (API REST)

Los siguientes endpoints son provistos por el backend en Django Rest Framework (DRF) para realizar la gestión y operaciones CRUD en la base de datos:

### Autenticación (`/api/auth/`)
- `POST /api/auth/login/` - Autenticación y obtención de tokens JWT (Access y Refresh).
- `POST /api/auth/refresh/` - Refresco del token de acceso JWT.
- `POST /api/auth/register/` - Registro de nuevos usuarios.
- `GET/PUT /api/auth/me/` - Obtención y actualización de información del usuario autenticado.

### Módulo Documental y CRUDs genéricos (`/api/`)
La mayoría de estos endpoints están respaldados por el `DefaultRouter` de DRF, e incluyen los predeterminados de un CRUD:
- `GET` (Listar todos)
- `POST` (Crear nuevo registro)
- `GET {id}/` (Detalle de un registro en específico)
- `PUT / PATCH {id}/` (Actualización parcial o total del registro)
- `DELETE {id}/` (Eliminar registro)

| Modelo | Endpoint Principal Base |
|---|---|
| **Postulantes** | `/api/postulantes/` |
| **Convocatorias** | `/api/convocatorias/` |
| **Doc. Requeridos** | `/api/documentos-requeridos/` |
| **Documentos** | `/api/documentos/` |
| **Usuarios Perfil** | `/api/usuarios-perfil/` |
| **Expedientes** | `/api/expedientes/` |

### Endpoints Especiales / Adicionales
- **Dashboard Stats:** `GET /api/dashboard/stats/` (Métricas y conteos para la vista de estadísticas de la landing).
- **Health Check:** `GET /api/health/` (Verificar la salud y si se encuentra encendida la API).
- **Alias Requisitos (Crear):** `POST /api/requisitos/` (Atajo para creación de documentos requeridos).
- **Alias Postulantes (Crear):** `POST /api/postulantes/` (Atajo para creación de postulantes).
