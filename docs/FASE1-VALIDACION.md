# FASE 1 – Validación

## Resumen de lo construido

| Componente      | Ubicación                 | Descripción                                           |
| --------------- | ------------------------- | ----------------------------------------------------- |
| Proyecto Django | `backend/config/`         | Settings, URLs, CORS, DRF                             |
| App documental  | `backend/documental/`     | Endpoint `GET /api/health/`                           |
| Frontend React  | `frontend/src/`           | Vite + React + TS, cliente API en `src/api/client.ts` |
| Proxy           | `frontend/vite.config.ts` | `/api` → `http://127.0.0.1:8000`                      |

## Pasos para validar (en tu máquina)

### 1. Backend

```powershell
cd c:\Users\lball\Desktop\G-Doc\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate ----- En caso de error, instalar django-cors-headers con pip install django-cors-headers
python manage.py runserver
```

Debe quedar: `Starting development server at http://127.0.0.1:8000/`

### 2. Probar solo la API

- Abre en el navegador: **http://127.0.0.1:8000/api/health/**
- Debe verse un JSON:  
  `{"status":"ok","message":"API G-Doc operativa","version":"1.0"}`

### 3. Frontend

En **otra terminal**:

```powershell
cd c:\Users\lball\Desktop\G-Doc\frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. Debe mostrarse **"Conexión OK"** y el mismo JSON.

### 4. Confirmación

- [ ] Backend responde en `/api/health/`
- [ ] Frontend muestra "Conexión OK" sin errores de CORS
- [ ] No hay errores en la consola del navegador

Cuando todo esté marcado, la **FASE 1 está validada** y se puede continuar con la FASE 2 (modelo de datos y CRUD).
