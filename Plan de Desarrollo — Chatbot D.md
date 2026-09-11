# 🤖 Plan de Desarrollo — Chatbot Documental UNI SIGEA

---

# 1. Descripción General

Implementación de un chatbot documental inteligente dentro del portal del postulante del sistema UNI SIGEA.

La funcionalidad permitirá asistir a los usuarios durante el proceso de vinculación de personal, respondiendo consultas relacionadas exclusivamente con documentación requerida, validaciones y carga de archivos.

El chatbot estará disponible únicamente en el usuario con rol postulante:

```txt
/portal-postulante
```

---

# 2. Objetivo General

Desarrollar un asistente documental integrado al portal del postulante que permita:

- Reducir dudas frecuentes.
- Mejorar la experiencia del usuario.
- Disminuir carga operativa del área de recursos humanos.
- Guiar correctamente el proceso documental.

---

# 3. Alcance del Desarrollo

## Incluye

### Frontend
- Botón flotante.
- Ventana de chat.
- Historial temporal.
- Input interactivo.
- Indicador de carga.
- Scroll automático.
- Diseño responsive.

### Backend
- Endpoint API.
- Integración Gemini Flash.
- Validación de solicitudes.
- Restricción temática.
- Manejo de errores.

---

## No Incluye

- Persistencia de conversaciones.
- Base de datos para historial.
- Integración global del chatbot.
- Refactorización del sistema.
- Modificación de autenticación.
- Entrenamiento de IA.

---

# 4. Arquitectura General

```txt
Usuario
   ↓
Frontend Chatbot
   ↓
API Backend
   ↓
Servicio Gemini Flash
   ↓
Respuesta Documental
```

---

# 5. Estructura de Archivos

## Backend

```txt
backend/
├── services/
│   ├── __init__.py
│   └── gemini_service.py

├── api/
│   ├── views.py
│   └── urls.py
```

---

## Frontend

```txt
frontend/src/
├── components/
│   └── ChatBotDocumental.tsx

└── pages/
    └── PortalPostulante.tsx
```

---

# 6. Componentes del Frontend

## ChatBotDocumental

Responsabilidades:

- Mostrar botón flotante.
- Abrir/cerrar ventana del chat.
- Manejar mensajes temporales.
- Consumir endpoint backend.
- Renderizar respuestas.
- Mostrar indicador de escritura.
- Manejar auto-scroll.

---

# 7. Servicios Backend

## gemini_service

Responsabilidades:

- Configurar Gemini Flash.
- Enviar prompts.
- Limitar longitud de respuesta.
- Optimizar tokens.
- Retornar respuesta resumida.

---

## chatbot_view

Responsabilidades:

- Recibir mensajes del frontend.
- Validar payload.
- Consumir servicio Gemini.
- Retornar respuesta JSON.
- Manejar excepciones.

---

# 8. Endpoint API

## Endpoint Principal

```txt
POST /api/chatbot/
```

---

## Flujo del Endpoint

```txt
Frontend envía mensaje
        ↓
chatbot_view recibe request
        ↓
Validación del mensaje
        ↓
Llamado a Gemini Service
        ↓
Respuesta resumida
        ↓
JSON Response al frontend
```

---

# 9. Restricción Temática

El chatbot responderá únicamente preguntas relacionadas con:

- Cédula
- Hoja de vida
- Certificados laborales
- Certificados académicos
- RUT
- Antecedentes disciplinarios
- Antecedentes fiscales
- EPS
- Pensión
- Cuenta bancaria
- Diploma
- Acta de grado

---

# 10. Respuesta Fuera de Contexto

Si el usuario realiza preguntas fuera del alcance documental:

```txt
Solo puedo ayudarte con documentación del proceso de vinculación.
```

---

# 11. Configuración Gemini

## Parámetros

| Configuración | Valor |
|---|---|
| Modelo | Gemini Flash |
| Temperatura | Baja |
| Máximo tokens | 150 |
| Historial enviado | Limitado |
| Respuestas | Cortas |

---

# 12. Variables de Entorno

## Variables requeridas

```env
GEMINI_API_KEY=
```

---

# 13. Diseño UI/UX

## Características

- Diseño minimalista.
- Responsive.
- Botón flotante.
- Bordes redondeados.
- Animaciones suaves.
- Scroll moderno.
- Indicador visual de escritura.

---

# 14. Integración del Chatbot

El chatbot será importado únicamente dentro de:

```txt
PortalPostulante.tsx
```

No debe integrarse en:

- App.tsx
- Layout global
- Panel administrativo
- Otras vistas del sistema

---

# 15. Flujo Funcional

```txt
Usuario abre portal
        ↓
Visualiza botón flotante
        ↓
Abre chatbot
        ↓
Escribe consulta
        ↓
Frontend consume API
        ↓
Backend consulta Gemini
        ↓
Respuesta documental
        ↓
Renderizado en interfaz
```

---

# 16. Seguridad

## Consideraciones

- API Key protegida en variables de entorno.
- No exponer Gemini al frontend.
- No guardar conversaciones.
- No persistir historial.
- Validar solicitudes.

---

# 17. Manejo de Errores

## Casos contemplados

| Error | Acción |
|---|---|
| Error Gemini | Respuesta fallback |
| Timeout | Reintento |
| Payload inválido | Validación |
| API caída | Mensaje amigable |

---

# 18. Respuesta Fallback

```txt
No fue posible procesar tu consulta documental en este momento.
```

---

# 19. Fases de Desarrollo

## Fase 1 — Análisis
- Revisar arquitectura actual.
- Identificar frameworks.
- Ubicar portal postulante.

---

## Fase 2 — Backend
- Crear servicio Gemini.
- Crear endpoint chatbot.
- Configurar variables entorno.

---

## Fase 3 — Frontend
- Crear componente chatbot.
- Implementar interfaz flotante.
- Integrar consumo API.

---

## Fase 4 — UI/UX
- Responsive.
- Mejorar estilos.
- Loading states.
- Scroll automático.

---

## Fase 5 — Testing
- Validar flujo completo.
- Validar respuestas.
- Probar errores.
- Validar restricciones temáticas.

---

# 20. Checklist de Implementación

- Crear servicio Gemini.
- Configurar API Key.
- Crear endpoint backend.
- Registrar rutas.
- Crear componente chatbot.
- Integrar en portal postulante.
- Validar Tailwind.
- Probar endpoint.
- Realizar pruebas funcionales.

---

# 21. Resultado Esperado

UNI SIGEA contará con un chatbot documental inteligente integrado exclusivamente en el portal del postulante, permitiendo asistir a los usuarios en el proceso de carga y validación documental sin afectar la arquitectura existente del sistema.