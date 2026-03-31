# SafetyVision AI · Plataforma de Seguridad Industrial

> Detección de riesgos laborales con IA (Google Gemini Vision). Foto → Análisis → Alerta → Tarea correctiva. Stack idéntico a Nodo8 ESG.

## Arquitectura

- **Stack:** React + Vite + Tailwind (frontend) / Express + Node.js (backend) / PostgreSQL
- **IA:** Google Gemini (gemini-2.0-flash con fallback automático a otros modelos)
- **Auth:** JWT Bearer tokens con aislamiento por tenant
- **Deploy:** Vercel (serverless functions) + Vercel Postgres / Supabase / Neon
- **Alertas:** n8n webhooks → WhatsApp / Email

## Qué hace

1. 📸 El operario sube una foto desde el celular
2. 🤖 Gemini Vision analiza la imagen
3. ⚠️ Detecta riesgos (EPP faltante, condiciones inseguras, comportamientos)
4. 🧮 Clasifica gravedad (Alto → 4hs / Medio → 24hs / Bajo → 48hs)
5. 🚨 Genera alerta automática (n8n → WhatsApp/Email)
6. 📋 Crea tarea correctiva con responsable y plazo

## Setup Local

### 1. Clonar e instalar

```bash
git clone <repo>
cd safetyvision-ai
npm install
```

### 2. Base de datos (Docker)

```bash
docker compose up -d
```

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Editar `.env.local`:

```
GEMINI_API_KEY=tu_key_de_google_ai_studio
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/safetyvision
JWT_SECRET=un-secreto-de-al-menos-32-caracteres-random
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
SEED_ADMIN_EMAIL=admin@safetyvision.ai
SEED_ADMIN_PASSWORD=Admin123!
SEED_INSPECTOR_EMAIL=inspector@safetyvision.ai
SEED_INSPECTOR_PASSWORD=Inspector123!
```

### 4. Migrar y arrancar

```bash
npm run migrate   # Crea tablas + usuarios seed
npm run dev       # Arranca en http://localhost:3000
```

## Deploy en Vercel

1. Crear proyecto en Vercel, conectar repo
2. Agregar Vercel Postgres (o Neon/Supabase como DB)
3. Configurar variables de entorno en el panel de Vercel
4. Ejecutar `npm run migrate` contra la DB de producción (una sola vez)
5. Deploy automático

## API Reference

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login → JWT |
| GET | `/api/auth/me` | Sí | Perfil del usuario |
| GET | `/api/ping` | No | Health check |
| POST | `/api/inspections/analyze` | Sí | Enviar foto/texto → IA detecta riesgos |
| POST | `/api/inspections/create` | Sí | Guardar inspección con riesgos y tarea |
| GET | `/api/inspections/list` | Sí | Listar inspecciones del tenant |
| GET | `/api/inspections/:id` | Sí | Detalle de una inspección |
| POST | `/api/inspections/:id/update-task` | Sí | Actualizar estado de tarea correctiva |
| DELETE | `/api/inspections/:id` | Sí | Eliminar inspección (solo admin) |
| GET | `/api/dashboard` | Sí | Stats para el panel de control |
| POST | `/api/test-model` | Sí | Test de conectividad Gemini |

## Ejemplo curl: Flujo completo

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@safetyvision.ai","password":"Admin123!"}' | jq -r .token)

# 2. Analizar imagen (base64)
curl -X POST http://localhost:3000/api/inspections/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description":"Operario sin casco cerca de maquinaria pesada, cables en el piso","plant":"Planta Norte","sector":"Producción"}'

# 3. Dashboard
curl http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

## Estructura de archivos

```
safetyvision-ai/
├── api/                    # Backend (Express + Vercel serverless)
│   ├── _app.ts             # Express app factory
│   ├── _db.ts              # PostgreSQL connection
│   ├── _ai-engine.ts       # Gemini Vision analysis
│   ├── _store.ts           # Inspection CRUD (PostgreSQL)
│   ├── _notify.ts          # n8n webhook alerts
│   ├── _types.ts           # TypeScript types
│   ├── _migrate.ts         # Database migrations
│   ├── _auth/              # JWT auth (login, middleware, store)
│   ├── _inspections/       # Route handlers
│   └── index.ts            # Vercel entry point
├── components/             # React UI
│   ├── Layout.tsx
│   ├── LoginScreen.tsx
│   ├── Dashboard.tsx
│   ├── NewInspection.tsx
│   └── InspectionsList.tsx
├── contexts/
│   └── AuthContext.tsx
├── scripts/
│   └── server.ts           # Local dev server (Express + Vite)
├── App.tsx
├── index.tsx
├── index.html
├── index.css
├── vercel.json
├── package.json
├── docker-compose.yml
└── .env.example
```

## Modelo de negocio sugerido (SaaS)

| Segmento | Precio mensual |
|----------|---------------|
| Planta chica (1-2 usuarios) | USD 100–200 |
| Planta mediana (5-10 usuarios) | USD 300–800 |
| Empresa grande (multi-planta) | USD 1.000+ |
| Setup inicial | USD 300–1.000 |

## Stack heredado de Nodo8 ESG

- ✅ Express `createApiApp()` factory con CORS whitelist
- ✅ JWT auth con roles + tenant isolation
- ✅ PostgreSQL store con JSONB state
- ✅ Vercel serverless con cached app instance
- ✅ Vite + React + Tailwind frontend
- ✅ Gemini API con fallback chain automático
- ✅ n8n webhook notifications
- ✅ Docker Compose para desarrollo local
