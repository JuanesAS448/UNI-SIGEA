<h2 align="left">
    <img src= "https://github.com/user-attachments/assets/518854b5-fac7-41ab-b355-3bbe083167be#
       alt="Logo SIGEA"
       width="80"
       style="vertical-align: left;">
  UNI SIGEA - Documentación y Endpoints

</h2>

Este archivo contiene la referencia sobre la estructura del proyecto, las principales funcionalidades del sistema, así como los endpoints (API de backend) y los enlaces a las vistas (Frontend) correspondientes a los diferentes CRUD.

## Funcionalidades del Sistema

Las características más destacadas de la plataforma incluyen:

- **Carga y Validación de Documentos:** Los postulantes pueden subir de forma digital los documentos exigidos por cada convocatoria. Los administradores revisan y validan estos archivos con apoyo de un indicador de estado por semáforo.
- **Gestión de Convocatorias:** Permite crear, modificar, detallar y archivar los distintos procesos de admisión.
- **Portal del Postulante:** Espacio donde los candidatos pueden registrarse, enviar su información y dar seguimiento a sus trámites de admisión de manera integral.
- **Administración de Expedientes:** Vista completa y organizada de los expedientes físicos/virtuales por aspirante, agilizando la revisión de cada caso.
- **Gestión de Usuarios:** Control de acceso y administración de perfiles dentro de la plataforma.

## Estructura del Proyecto

El código está organizado en un monorepositorio que separa claramente el cliente del servidor. A continuación se detalla cada directorio principal:

### 🌐 Frontend (`/frontend/`)

La aplicación web está desarrollada como Single Page Application utilizando **React** con **TypeScript**, empaquetada con **Vite** y con estilos gestionados mediante **TailwindCSS**.
Su estructura interna destacada es:

- `/src/components/`: Componentes de interfaz de usuario reutilizables (Botones, Modales, Tablas, etc.).
- `/src/pages/`: Vistas completas de la aplicación (Dashboard, Convocatorias, Login, Rutas de Postulantes, etc.).
- `/src/services/`: Funciones y utilidades para interactuar con la API del backend mediante peticiones HTTP.
- `/src/hooks/`: Hooks personalizados de React encargados de aislar la lógica de negocio.
- `/src/contexts/`: Manejo del estado global de la aplicación (Autenticación, Tema, etc.) vía Context API.
- `/src/types/`: Definiciones estrictas de tipos o interfaces propias de TypeScript para el tipado de los datos.

### ⚙️ Backend (`/backend/`)

La **API REST** central está desarrollada en Python utilizando el framework **Django** junto con **Django Rest Framework (DRF)**.

- `/config/`: Configuraciones globales de Django (settings corporativos, ruteo maestro, WSGI, ASGI).
- `/documental/`: La aplicación (app) principal del negocio. Contiene toda la lógica del módulo de documentos, expedientes, convocatorias, y postulantes.
  - `models.py`: Esquemas de datos relacionales en Base de Datos (Postulantes, Documentos Requeridos, Convocatoria).
  - `views.py`: Controladores o ViewSets de la API manejando las peticiones y dando respuesta JSON.
  - `serializers.py`: Capa de serialización que transforma la DB a JSON útil para el frontend.
- `/accounts/`: Aplicación independiente dedicada al manejo de autenticación de usuarios y perfiles personalizados.

### 📚 Documentación (`/docs/`)

- Directorio de recursos de documentación extra, manuales técnicos o imágenes de apoyo del repositorio.

---

## Enlaces del Frontend (Rutas / Vistas)

A continuación se detallan las rutas principales de navegación de la aplicación en React/Vite, donde se gestionan los distintos modelos (CRUDs):

| Módulo / Acción              | Ruta en Frontend               | Descripción                                                                  |
| ---------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| **Autenticación**            | `/login`                       | Pantalla de inicio de sesión de usuarios.                                    |
| **Dashboard**                | `/`                            | Panel principal e inicio de la aplicación.                                   |
| **Convocatorias**            | `/convocatorias`               | Listado y gestión principal (CRUD) de convocatorias.                         |
| **Convocatoria (Nueva)**     | `/convocatorias/nueva`         | Formulario para la creación de una nueva convocatoria.                       |
| **Convocatoria (Detalles)**  | `/convocatorias/:id`           | Vista detallada e información particular de una convocatoria.                |
| **Convocatorias Archivadas** | `/convocatorias/archivadas`    | Vista de convocatorias en estado archivado.                                  |
| **Documentos & Requisitos**  | `/documentos`                  | Gestión de documentos (incluye CRUD de Documento Requerido / Documentos).    |
| **Doc. Semáforo**            | `/documentos/semaforo/:status` | Filtrado de documentos por estado de alerta/semáforo dependiendo del avance. |
| **Postulantes**              | `/portal-postulante`           | Portal y registro de postulantes.                                            |
| **Expedientes**              | `/expedientes`                 | Listado y CRUD general de expedientes de los aspirantes/postulantes.         |
| **Usuarios**                 | `/usuarios`                    | Gestión y CRUD de usuarios del sistema.                                      |

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

| Modelo              | Endpoint Principal Base       |
| ------------------- | ----------------------------- |
| **Postulantes**     | `/api/postulantes/`           |
| **Convocatorias**   | `/api/convocatorias/`         |
| **Doc. Requeridos** | `/api/documentos-requeridos/` |
| **Documentos**      | `/api/documentos/`            |
| **Usuarios Perfil** | `/api/usuarios-perfil/`       |
| **Expedientes**     | `/api/expedientes/`           |

### Endpoints Especiales / Adicionales

- **Dashboard Stats:** `GET /api/dashboard/stats/` (Métricas y conteos para la vista de estadísticas de la landing).
- **Health Check:** `GET /api/health/` (Verificar la salud y si se encuentra encendida la API).
- **Alias Requisitos (Crear):** `POST /api/requisitos/` (Atajo para creación de documentos requeridos).
- **Alias Postulantes (Crear):** `POST /api/postulantes/` (Atajo para creación de postulantes).

