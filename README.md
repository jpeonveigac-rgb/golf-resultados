# Sistema de Resultados de Golf

Sistema independiente para scoring y visualización de resultados de torneos de golf.

## 🚀 Instalación Rápida

### 1. Crear la base de datos D1

```bash
wrangler d1 create golf-resultados-db
```

Copia el `database_id` que te devuelve.

### 2. Actualizar wrangler.toml

Edita `wrangler.toml` y reemplaza `TU_DATABASE_ID_AQUI` con el ID que copiaste.

### 3. Ejecutar el schema SQL

```bash
wrangler d1 execute golf-resultados-db --file=./schema.sql
```

### 4. Desplegar

```bash
wrangler deploy
```

## 📁 Estructura del Proyecto

```
golf-resultados/
├── wrangler.toml        # Configuración del worker
├── schema.sql           # Tablas de la base de datos
├── src/
│   └── worker.js        # API endpoints
└── public/
    ├── index.html           # Lista de torneos
    ├── resultados.html      # Leaderboard público
    ├── scorecard.html       # Scorecard individual
    ├── livescoring.html     # Scoring móvil para jugadores
    ├── admin-eventos.html   # Crear/editar eventos
    └── admin-scoring.html   # Panel admin de scoring
```

## 🔗 URLs

| Página | URL |
|--------|-----|
| Inicio | `/` |
| Leaderboard | `/resultados.html?evento=SLUG` |
| Scorecard | `/scorecard.html?evento=SLUG&rut=12345678` |
| Live Scoring | `/livescoring.html?evento=SLUG` |
| Admin Eventos | `/admin-eventos.html` |
| Admin Scoring | `/admin-scoring.html?evento=SLUG` |

## 🔒 Autenticación Admin

Las rutas `/admin/*` están protegidas con Basic Auth.

**Credenciales por defecto:**
- Usuario: `admin`
- Contraseña: `golf2024`

Para cambiarlas, configura las variables de entorno en Cloudflare:
- `ADMIN_USER`
- `ADMIN_PASS`

## 📡 API Endpoints

### Públicos
- `GET /api/eventos` - Lista de eventos activos
- `GET /api/config?evento=SLUG` - Configuración del torneo
- `GET /api/leaderboard?evento=SLUG` - Tabla de posiciones
- `GET /api/scorecard?evento=SLUG&rut=XXX` - Scorecard individual
- `GET /api/stats?evento=SLUG` - Estadísticas por hoyo
- `GET /api/salidas?evento=SLUG` - Tee times
- `GET /api/field?evento=SLUG` - Lista de jugadores
- `GET /api/export?evento=SLUG` - Exportar CSV

### Requieren Auth
- `POST /admin/eventos` - Crear/editar eventos
- `POST /api/scores` - Guardar scores
- `POST /api/jugadores` - Agregar jugadores

## 🏌️ Formatos de Juego

- **Stroke Play** - Conteo tradicional de golpes
- **Stableford** - Sistema de puntos
- **Match Play** - Brackets de eliminación
- **Fourball** - Mejor bola

## 🔄 Sincronizar con Sistema de Inscripciones

Si tienes un sistema de inscripciones separado, puedes importar jugadores usando:

```bash
curl -X POST https://tu-worker.workers.dev/api/sync-inscripciones \
  -H "Content-Type: application/json" \
  -d '{
    "evento": "abierto-2025",
    "inscripciones": [
      {"rut": "12345678-9", "nombres": "Juan", "apellido_paterno": "Pérez"}
    ]
  }'
```

## 📱 Live Scoring

Los jugadores pueden ingresar sus scores desde el celular:

1. Habilita "Live Scoring" al crear el evento
2. Comparte el link: `/livescoring.html?evento=SLUG`
3. Cada jugador ingresa su RUT y registra sus golpes hoyo por hoyo

---

**Desarrollado para torneos de golf en Chile** 🇨🇱
