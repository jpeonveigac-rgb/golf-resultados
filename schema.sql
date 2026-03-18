-- ============================================================
-- SCHEMA: Sistema de Resultados de Golf (Independiente)
-- Ejecutar en Cloudflare D1
-- 
-- Crear base de datos:
--   wrangler d1 create golf-resultados-db
--
-- Ejecutar schema:
--   wrangler d1 execute golf-resultados-db --file=./schema.sql
-- ============================================================

-- Eventos/Torneos
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  campo_slug TEXT,
  formato_juego TEXT DEFAULT 'stroke_play' CHECK (formato_juego IN ('stroke_play', 'stableford', 'match_play', 'fourball')),
  num_rondas INTEGER DEFAULT 1,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  usa_handicap INTEGER DEFAULT 1,
  corte_activo INTEGER DEFAULT 0,
  corte_posicion INTEGER,
  live_scoring INTEGER DEFAULT 0,
  categorias_json TEXT DEFAULT '[]',
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Campos/Canchas
CREATE TABLE IF NOT EXISTS campos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  ciudad TEXT,
  pais TEXT DEFAULT 'Chile',
  hoyos INTEGER DEFAULT 18,
  par_total INTEGER DEFAULT 72,
  slope_rating REAL,
  course_rating REAL,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Hoyos del campo
CREATE TABLE IF NOT EXISTS hoyos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campo_slug TEXT NOT NULL,
  hoyo INTEGER NOT NULL CHECK (hoyo >= 1 AND hoyo <= 18),
  par INTEGER NOT NULL DEFAULT 4 CHECK (par >= 3 AND par <= 6),
  handicap_index INTEGER CHECK (handicap_index >= 1 AND handicap_index <= 18),
  yardas_negro INTEGER,
  yardas_azul INTEGER,
  yardas_blanco INTEGER,
  yardas_amarillo INTEGER,
  yardas_rojo INTEGER,
  UNIQUE(campo_slug, hoyo),
  FOREIGN KEY (campo_slug) REFERENCES campos(slug) ON DELETE CASCADE
);

-- Rondas del torneo
CREATE TABLE IF NOT EXISTS rondas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT NOT NULL,
  numero INTEGER NOT NULL CHECK (numero >= 1 AND numero <= 4),
  fecha TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'finalizada')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(evento_slug, numero),
  FOREIGN KEY (evento_slug) REFERENCES eventos(slug) ON DELETE CASCADE
);

-- Jugadores del torneo
CREATE TABLE IF NOT EXISTS jugadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT NOT NULL,
  rut TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT,
  club TEXT,
  handicap REAL,
  categoria TEXT,
  es_amateur INTEGER DEFAULT 1,
  es_socio INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'lista_espera', 'retirado', 'descalificado')),
  posicion_final INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(evento_slug, rut),
  FOREIGN KEY (evento_slug) REFERENCES eventos(slug) ON DELETE CASCADE
);

-- Grupos de salida (Tee Times)
CREATE TABLE IF NOT EXISTS grupos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT NOT NULL,
  ronda INTEGER NOT NULL,
  hora TEXT NOT NULL,
  hoyo_salida INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (evento_slug) REFERENCES eventos(slug) ON DELETE CASCADE
);

-- Jugadores en cada grupo
CREATE TABLE IF NOT EXISTS grupo_jugadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grupo_id INTEGER NOT NULL,
  jugador_rut TEXT NOT NULL,
  orden INTEGER DEFAULT 1,
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
);

-- Scores por hoyo
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT NOT NULL,
  ronda INTEGER NOT NULL,
  jugador_rut TEXT NOT NULL,
  hoyo INTEGER NOT NULL CHECK (hoyo >= 1 AND hoyo <= 18),
  golpes INTEGER CHECK (golpes >= 1 AND golpes <= 20),
  putts INTEGER CHECK (putts >= 0 AND putts <= 10),
  fairway TEXT CHECK (fairway IN ('hit', 'left', 'right', NULL)),
  gir INTEGER CHECK (gir IN (0, 1, NULL)),
  penalidades INTEGER DEFAULT 0,
  notas TEXT,
  ingresado_por TEXT DEFAULT 'admin',
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(evento_slug, ronda, jugador_rut, hoyo)
);

-- Totales por ronda (cache para leaderboard)
CREATE TABLE IF NOT EXISTS totales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT NOT NULL,
  ronda INTEGER NOT NULL,
  jugador_rut TEXT NOT NULL,
  total_bruto INTEGER,
  total_neto INTEGER,
  total_par INTEGER,
  stableford_bruto INTEGER,
  stableford_neto INTEGER,
  thru INTEGER DEFAULT 0,
  posicion INTEGER,
  posicion_anterior INTEGER,
  estado TEXT DEFAULT 'en_curso' CHECK (estado IN ('no_iniciado', 'en_curso', 'finalizado', 'retirado', 'descalificado')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(evento_slug, ronda, jugador_rut)
);

-- Configuración de puntos Stableford
CREATE TABLE IF NOT EXISTS config_stableford (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT,
  albatros INTEGER DEFAULT 5,
  eagle INTEGER DEFAULT 4,
  birdie INTEGER DEFAULT 3,
  par INTEGER DEFAULT 2,
  bogey INTEGER DEFAULT 1,
  doble_bogey INTEGER DEFAULT 0,
  otro INTEGER DEFAULT 0,
  UNIQUE(evento_slug)
);

-- Insertar config Stableford por defecto
INSERT OR IGNORE INTO config_stableford (evento_slug, albatros, eagle, birdie, par, bogey, doble_bogey, otro)
VALUES (NULL, 5, 4, 3, 2, 1, 0, 0);

-- Match Play brackets
CREATE TABLE IF NOT EXISTS match_play_brackets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_slug TEXT NOT NULL,
  ronda_bracket INTEGER NOT NULL,
  match_numero INTEGER NOT NULL,
  jugador1_rut TEXT,
  jugador2_rut TEXT,
  ganador_rut TEXT,
  resultado TEXT,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'finalizado')),
  UNIQUE(evento_slug, ronda_bracket, match_numero)
);

-- Auditoría de cambios
CREATE TABLE IF NOT EXISTS scores_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  score_id INTEGER,
  evento_slug TEXT,
  ronda INTEGER,
  jugador_rut TEXT,
  hoyo INTEGER,
  golpes_anterior INTEGER,
  golpes_nuevo INTEGER,
  modificado_por TEXT,
  motivo TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_scores_evento_ronda ON scores(evento_slug, ronda);
CREATE INDEX IF NOT EXISTS idx_scores_jugador ON scores(jugador_rut);
CREATE INDEX IF NOT EXISTS idx_totales_evento ON totales(evento_slug, ronda);
CREATE INDEX IF NOT EXISTS idx_totales_posicion ON totales(evento_slug, posicion);
CREATE INDEX IF NOT EXISTS idx_jugadores_evento ON jugadores(evento_slug);
CREATE INDEX IF NOT EXISTS idx_grupos_evento ON grupos(evento_slug, ronda);

-- ============================================================
-- DATOS DE EJEMPLO (opcional, comentar en producción)
-- ============================================================

-- Campo de ejemplo
INSERT OR IGNORE INTO campos (slug, nombre, ciudad, par_total) 
VALUES ('las-brisas', 'Las Brisas de Chicureo', 'Santiago', 72);

-- Hoyos del campo (pares típicos)
INSERT OR IGNORE INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_blanco) VALUES
('las-brisas', 1, 4, 7, 380),
('las-brisas', 2, 4, 3, 420),
('las-brisas', 3, 3, 15, 165),
('las-brisas', 4, 5, 1, 510),
('las-brisas', 5, 4, 9, 390),
('las-brisas', 6, 4, 5, 405),
('las-brisas', 7, 3, 17, 175),
('las-brisas', 8, 4, 11, 430),
('las-brisas', 9, 5, 13, 545),
('las-brisas', 10, 4, 8, 400),
('las-brisas', 11, 3, 16, 185),
('las-brisas', 12, 4, 4, 415),
('las-brisas', 13, 5, 2, 530),
('las-brisas', 14, 4, 10, 380),
('las-brisas', 15, 4, 6, 440),
('las-brisas', 16, 3, 18, 195),
('las-brisas', 17, 4, 12, 410),
('las-brisas', 18, 5, 14, 520);
