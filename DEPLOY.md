# Despliegue de UNI-SIGEA (Vercel + Render)

Este proyecto son **dos aplicaciones**:

| Parte | Tecnología | Dónde se despliega |
| --- | --- | --- |
| `frontend/` | React + Vite (sitio estático) | **Vercel** |
| `backend/` | Django + DRF (API + admin) | **Render** (o Railway/Fly.io) + PostgreSQL |

Vercel solo ejecuta funciones serverless de corta duración y no ofrece disco persistente,
por eso el backend Django no se despliega ahí de forma confiable. La combinación
Vercel (frontend) + Render (backend) es la más simple y gratuita.

Archivos ya preparados en el repo:

- `frontend/vercel.json`: build de Vite y rewrites para que funcionen rutas como `/convocatorias/3`.
- `render.yaml`: blueprint del backend (build, gunicorn, PostgreSQL, variables).
- `backend/requirements.txt`: incluye `gunicorn`, `whitenoise`, `psycopg` y `dj-database-url`.

---

## 0. Antes de empezar

1. Verifica que el backend funciona en local:

   ```powershell
   cd backend
   ..\backend\.venv\Scripts\python.exe manage.py check
   ..\backend\.venv\Scripts\python.exe manage.py runserver
   ```

   Debe responder en `http://localhost:8000/api/health/`.

2. Sube los cambios a GitHub:

   ```powershell
   git add .
   git commit -m "Configuración de despliegue"
   git push origin main
   ```

3. (Recomendado) Deja de versionar entornos virtuales, caché y la base SQLite.
   No borra los archivos de tu disco, solo los saca del repositorio:

   ```powershell
   git rm -r --cached backend/venv backend/.venv
   git ls-files "backend/**/__pycache__/**" | ForEach-Object { git rm --cached $_ }
   git rm --cached backend/db.sqlite3
   git commit -m "Deja de versionar venv, __pycache__ y sqlite"
   git push origin main
   ```

   > Si haces esto, la base de producción empieza vacía. Los datos que tengas en
   > `db.sqlite3` no se migran solos.

---

## 1. Backend en Render

### Opción A — Blueprint (usa `render.yaml`)

1. Entra a <https://render.com> y crea una cuenta con GitHub.
2. **New +** → **Blueprint**.
3. Selecciona el repositorio `UNI-SIGEA` y la rama `main`.
4. Render detecta `render.yaml` y muestra el servicio `uni-sigea-api` y la base
   `uni-sigea-db`. Confirma con **Apply**.
5. Cuando pida las variables marcadas como `sync: false`, complétalas:

   | Variable | Valor |
   | --- | --- |
   | `CORS_ALLOWED_ORIGINS` | `https://TU-PROYECTO.vercel.app` (sin `/` final) |
   | `CSRF_TRUSTED_ORIGINS` | `https://TU-PROYECTO.vercel.app,https://uni-sigea-api.onrender.com` |
   | `FRONTEND_URL` | `https://TU-PROYECTO.vercel.app` |
   | `GEMINI_API_KEY` | tu clave de Gemini (opcional, chatbot) |
   | `POWER_AUTOMATE_UPLOAD_URL` | URL del flujo (opcional) |
   | `POWER_AUTOMATE_IDENTITY_UPLOAD_URL` | URL del flujo de identidad (opcional) |
   | `POWER_AUTOMATE_IDENTITY_REQUIREMENT_IDS` | IDs separados por coma (opcional) |
   | `POWER_AUTOMATE_BEARER_TOKEN` | token (opcional) |

   Si aún no tienes la URL de Vercel, despliega primero el frontend (paso 2) y
   luego vuelve aquí: **Environment** → edita → **Save changes** (Render redeploya).

### Opción B — Manual

1. **New +** → **Postgres**. Plan free, misma región. Copia la
   **Internal Database URL**.
2. **New +** → **Web Service** → tu repo.
3. Configura:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - **Start Command**:
     ```bash
     gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
     ```
   - **Health Check Path**: `/api/health/`
4. En **Environment** agrega:

   ```env
   PYTHON_VERSION=3.13.7
   DJANGO_DEBUG=False
   DJANGO_SECRET_KEY=<cadena larga y aleatoria>
   ALLOWED_HOSTS=.onrender.com
   DATABASE_URL=<Internal Database URL de Render>
   CORS_ALLOWED_ORIGINS=https://TU-PROYECTO.vercel.app
   CSRF_TRUSTED_ORIGINS=https://TU-PROYECTO.vercel.app,https://uni-sigea-api.onrender.com
   FRONTEND_URL=https://TU-PROYECTO.vercel.app
   SERVE_MEDIA_FILES=true
   GEMINI_API_KEY=<opcional>
   ```

   Genera la clave con:
   `python -c "import secrets; print(secrets.token_urlsafe(50))"`

### Crear el superusuario

En Render: **Shell** del servicio y ejecuta:

```bash
python manage.py createsuperuser
```

El admin queda en `https://uni-sigea-api.onrender.com/admin/`.

### Comprobar el backend

Abre `https://uni-sigea-api.onrender.com/api/health/`. Debe responder:

```json
{"status": "ok", "message": "API G-Doc operativa", "version": "2.0"}
```

> En el plan free el servicio se suspende por inactividad: la primera petición
> puede tardar ~50 segundos.

---

## 2. Frontend en Vercel

1. Entra a <https://vercel.com> → **Add New…** → **Project**.
2. Importa el repositorio `UNI-SIGEA`.
3. Configura:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. En **Environment Variables** agrega (entorno Production y Preview):

   ```env
   VITE_API_BASE_URL=https://uni-sigea-api.onrender.com/api
   ```

   Sin esta variable, el frontend llama a `/api` en el dominio de Vercel y
   devolverá 404.
5. **Deploy**. Copia la URL final, por ejemplo `https://uni-sigea.vercel.app`.

### Conectar ambos servicios

Vuelve a Render → `uni-sigea-api` → **Environment** y actualiza:

```env
CORS_ALLOWED_ORIGINS=https://uni-sigea.vercel.app
CSRF_TRUSTED_ORIGINS=https://uni-sigea.vercel.app,https://uni-sigea-api.onrender.com
FRONTEND_URL=https://uni-sigea.vercel.app
```

Guarda: Render redeploya solo. Si cambias la URL, no olvides el `/api` final en
`VITE_API_BASE_URL`.

### Alternativa sin CORS (proxy en Vercel)

Si prefieres que el navegador solo hable con Vercel, deja
`VITE_API_BASE_URL=/api` y añade antes del rewrite de SPA en
`frontend/vercel.json`:

```json
{
  "source": "/api/(.*)",
  "destination": "https://uni-sigea-api.onrender.com/api/$1"
}
```

---

## 3. Verificación final

1. `https://TU-API.onrender.com/api/health/` → `200`.
2. `https://TU-APP.vercel.app/login` → inicia sesión con el superusuario.
3. Recarga una ruta interna (`/convocatorias`, `/expedientes`) — no debe dar 404.
4. Sube un documento y comprueba que la URL del archivo responde.
5. Abre el admin de Django y verifica los datos.

---

## 4. Problemas frecuentes

| Síntoma | Causa / solución |
| --- | --- |
| `DisallowedHost` | Añade el dominio a `ALLOWED_HOSTS` (`.onrender.com` cubre subdominios). |
| Error CORS en el navegador | `CORS_ALLOWED_ORIGINS` debe ser el origen exacto, con `https://` y sin `/` final. Redeploya. |
| El frontend llama a `vercel.app/api` | Falta `VITE_API_BASE_URL` o se cambió sin redeployar. |
| 404 al recargar una ruta | Debe existir el rewrite de `frontend/vercel.json` y el **Root Directory** debe ser `frontend`. |
| Admin sin estilos | Falta `collectstatic` en el build o `whitenoise` en `MIDDLEWARE`. |
| `no such table` / error de BD | `DATABASE_URL` no está definida o las migraciones no corrieron en el build. |
| Los archivos subidos desaparecen | El disco de Render es efímero. Para persistencia usa S3, Cloudinary o un disco de pago. |
| La primera petición tarda ~50 s | Suspensión del plan free de Render. |
| Error al iniciar sesión en producción | Revisa `CORS_ALLOWED_ORIGINS`, que el backend responda `/api/health/` y la consola/red del navegador. |

---

## 5. Seguridad y datos

- `backend/.env` **no** se sube al repo (está en `.gitignore`). Configura todo en
  el dashboard del hosting.
- `DJANGO_SECRET_KEY` distinta en producción; nunca la del código.
- `DJANGO_DEBUG=False` en producción.
- `db.sqlite3` versionado contiene datos reales/locales: retíralo del repo.
- El plan free de Render/Neon puede expirar o limitar conexiones; para un entorno
  permanente usa un plan pago o Supabase/Neon.
