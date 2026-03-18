// ============================================================
//  Worker: Sistema de Resultados de Golf
//  Proyecto independiente del sistema de inscripciones
// ============================================================
//
//  Variables de entorno (Cloudflare Dashboard → Settings → Variables):
//    ADMIN_USER, ADMIN_PASS - Credenciales para panel admin
//    INSCRIPCIONES_API_URL  - URL del worker de inscripciones (opcional, para sync)
//
//  Base de datos D1:
//    Ejecutar schema.sql para crear las tablas
// ============================================================

// Pars por defecto (típico campo par 72)
const DEFAULT_PARS = [4,4,3,5,4,4,3,4,5, 4,3,4,5,4,4,3,4,5];
const DEFAULT_YARDS = [380,420,165,510,390,405,175,430,545, 400,185,415,530,380,440,195,410,520];

// ============================================================
//  Utilidades
// ============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", ...corsHeaders() }
  });
}

function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}

function verificarBasicAuth(request, env) {
  const adminUser = env.ADMIN_USER || "admin";
  const adminPass = env.ADMIN_PASS || "golf2024";
  const authHeader = request.headers.get("Authorization") || "";
  
  if (!authHeader.startsWith("Basic ")) return { ok: false };
  
  try {
    const decoded = atob(authHeader.slice(6));
    const [user, ...passParts] = decoded.split(":");
    const pass = passParts.join(":");
    return { ok: user === adminUser && pass === adminPass };
  } catch {
    return { ok: false };
  }
}

// Calcular puntos Stableford
function calcularStableford(golpes, par, handicapStrokes = 0) {
  if (!golpes || golpes < 1) return 0;
  const netScore = golpes - handicapStrokes;
  const diff = netScore - par;
  if (diff <= -3) return 5; // Albatros o mejor
  if (diff === -2) return 4; // Eagle
  if (diff === -1) return 3; // Birdie
  if (diff === 0) return 2;  // Par
  if (diff === 1) return 1;  // Bogey
  return 0; // Doble bogey o peor
}

// ============================================================
//  Router Principal
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Proteger rutas /admin con Basic Auth
    if (url.pathname.startsWith("/admin")) {
      const authResult = verificarBasicAuth(request, env);
      if (!authResult.ok) {
        return new Response("Acceso no autorizado", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Admin Resultados Golf", charset="UTF-8"',
            ...corsHeaders()
          }
        });
      }
    }

    // ── API Routes ──
    
    // Configuración y eventos
    if (url.pathname === "/api/eventos")              return handleEventos(request, url, env);
    if (url.pathname === "/api/config")               return handleConfig(url, env);
    
    // Campos y hoyos
    if (url.pathname === "/api/campos")               return handleCampos(request, url, env);
    if (url.pathname === "/api/hoyos")                return handleHoyos(request, url, env);
    
    // Jugadores y grupos
    if (url.pathname === "/api/jugadores")            return handleJugadores(request, url, env);
    if (url.pathname === "/api/jugador")              return handleJugador(url, env);
    if (url.pathname === "/api/grupos")               return handleGrupos(request, url, env);
    if (url.pathname === "/api/sync-inscripciones")   return handleSyncInscripciones(request, env);
    
    // Scores
    if (url.pathname === "/api/scores")               return handleScores(request, url, env);
    if (url.pathname === "/api/submit-round")         return handleSubmitRound(request, env);
    
    // Visualización pública
    if (url.pathname === "/api/leaderboard")          return handleLeaderboard(url, env);
    if (url.pathname === "/api/scorecard")            return handleScorecard(url, env);
    if (url.pathname === "/api/stats")                return handleStats(url, env);
    if (url.pathname === "/api/salidas")              return handleSalidas(url, env);
    if (url.pathname === "/api/field")                return handleField(url, env);
    if (url.pathname === "/api/historial")            return handleHistorial(url, env);
    
    // Import/Export
    if (url.pathname === "/api/import")               return handleImport(request, env);
    if (url.pathname === "/api/export")               return handleExport(url, env);

    // ── Admin Routes ──
    if (url.pathname === "/admin/eventos")            return handleAdminEventos(request, url, env);
    if (url.pathname === "/admin/rondas")             return handleAdminRondas(request, url, env);

    // ── Servir assets estáticos ──
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetRes.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(assetRes.body, { status: assetRes.status, headers: newHeaders });
    }

    return new Response("Not Found", { status: 404 });
  }
};

// ============================================================
//  API: Eventos
// ============================================================

async function handleEventos(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // GET - Listar eventos
  if (request.method === "GET") {
    const activos = url.searchParams.get("activos") !== "false";
    const query = activos 
      ? `SELECT * FROM eventos WHERE activo = 1 ORDER BY fecha_inicio DESC`
      : `SELECT * FROM eventos ORDER BY fecha_inicio DESC`;
    
    const result = await env.DB.prepare(query).all();
    return json({ ok: true, eventos: result.results || [] });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

async function handleAdminEventos(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // GET - Listar todos
  if (request.method === "GET") {
    const result = await env.DB.prepare(`SELECT * FROM eventos ORDER BY created_at DESC`).all();
    return json({ ok: true, eventos: result.results || [] });
  }

  // POST - Crear/actualizar evento
  if (request.method === "POST") {
    const body = await request.json();
    const { slug, titulo, campo_slug, formato_juego, num_rondas, fecha_inicio, fecha_fin, 
            usa_handicap, corte_activo, corte_posicion, live_scoring, categorias } = body;

    if (!slug || !titulo) {
      return json({ ok: false, error: "Faltan slug y titulo." }, 400);
    }

    const existe = await env.DB.prepare(`SELECT id FROM eventos WHERE slug = ?`).bind(slug).first();

    if (existe) {
      await env.DB.prepare(`
        UPDATE eventos SET 
          titulo = ?, campo_slug = ?, formato_juego = ?, num_rondas = ?,
          fecha_inicio = ?, fecha_fin = ?, usa_handicap = ?, corte_activo = ?,
          corte_posicion = ?, live_scoring = ?, categorias_json = ?, updated_at = datetime('now')
        WHERE slug = ?
      `).bind(
        titulo, campo_slug || null, formato_juego || 'stroke_play', num_rondas || 1,
        fecha_inicio || null, fecha_fin || null, usa_handicap ? 1 : 0, corte_activo ? 1 : 0,
        corte_posicion || null, live_scoring ? 1 : 0, JSON.stringify(categorias || []), slug
      ).run();
      
      return json({ ok: true, message: "Evento actualizado.", slug });
    }

    await env.DB.prepare(`
      INSERT INTO eventos (slug, titulo, campo_slug, formato_juego, num_rondas, fecha_inicio, 
        fecha_fin, usa_handicap, corte_activo, corte_posicion, live_scoring, categorias_json, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(
      slug, titulo, campo_slug || null, formato_juego || 'stroke_play', num_rondas || 1,
      fecha_inicio || null, fecha_fin || null, usa_handicap ? 1 : 0, corte_activo ? 1 : 0,
      corte_posicion || null, live_scoring ? 1 : 0, JSON.stringify(categorias || [])
    ).run();

    // Crear rondas automáticamente
    for (let i = 1; i <= (num_rondas || 1); i++) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO rondas (evento_slug, numero, estado) VALUES (?, ?, 'pendiente')
      `).bind(slug, i).run();
    }

    return json({ ok: true, message: "Evento creado.", slug });
  }

  // DELETE
  if (request.method === "DELETE") {
    const { slug } = await request.json();
    if (!slug) return json({ ok: false, error: "Falta slug." }, 400);
    
    await env.DB.prepare(`UPDATE eventos SET activo = 0 WHERE slug = ?`).bind(slug).run();
    return json({ ok: true, message: "Evento desactivado." });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

// ============================================================
//  API: Configuración
// ============================================================

async function handleConfig(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const eventoDb = await env.DB.prepare(`
    SELECT * FROM eventos WHERE slug = ? AND activo = 1 LIMIT 1
  `).bind(evento).first();

  if (!eventoDb) return json({ ok: false, error: "Evento no encontrado." }, 404);

  // Obtener pars del campo
  let pars = DEFAULT_PARS;
  let yards = DEFAULT_YARDS;
  
  if (eventoDb.campo_slug) {
    const hoyos = await env.DB.prepare(`
      SELECT hoyo, par, yardas_blanco FROM hoyos WHERE campo_slug = ? ORDER BY hoyo ASC
    `).bind(eventoDb.campo_slug).all();
    
    if (hoyos.results?.length === 18) {
      pars = hoyos.results.map(h => h.par);
      yards = hoyos.results.map(h => h.yardas_blanco || 400);
    }
  }

  // Obtener rondas
  const rondas = await env.DB.prepare(`
    SELECT numero, fecha, estado FROM rondas WHERE evento_slug = ? ORDER BY numero ASC
  `).bind(evento).all();

  // Obtener categorías
  let categorias = [];
  try { categorias = JSON.parse(eventoDb.categorias_json || "[]"); } catch {}

  return json({
    ok: true,
    slug: eventoDb.slug,
    titulo: eventoDb.titulo,
    formato: eventoDb.formato_juego || 'stroke_play',
    num_rondas: eventoDb.num_rondas || 1,
    usa_handicap: eventoDb.usa_handicap === 1,
    live_scoring: eventoDb.live_scoring === 1,
    fecha_inicio: eventoDb.fecha_inicio,
    fecha_fin: eventoDb.fecha_fin,
    pars,
    yards,
    rondas: rondas.results || [],
    categorias
  });
}

// ============================================================
//  API: Campos y Hoyos
// ============================================================

async function handleCampos(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  if (request.method === "GET") {
    const result = await env.DB.prepare(`SELECT * FROM campos WHERE activo = 1 ORDER BY nombre`).all();
    return json({ ok: true, campos: result.results || [] });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { slug, nombre, ciudad, pais, par_total, slope_rating, course_rating } = body;

    if (!slug || !nombre) return json({ ok: false, error: "Faltan slug y nombre." }, 400);

    await env.DB.prepare(`
      INSERT INTO campos (slug, nombre, ciudad, pais, par_total, slope_rating, course_rating, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(slug) DO UPDATE SET 
        nombre = excluded.nombre, ciudad = excluded.ciudad, pais = excluded.pais,
        par_total = excluded.par_total, slope_rating = excluded.slope_rating, 
        course_rating = excluded.course_rating
    `).bind(slug, nombre, ciudad || null, pais || 'Chile', par_total || 72, 
            slope_rating || null, course_rating || null).run();

    return json({ ok: true, message: "Campo guardado.", slug });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

async function handleHoyos(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const campo = url.searchParams.get("campo");
  if (!campo) return json({ ok: false, error: "Falta parámetro campo." }, 400);

  if (request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT * FROM hoyos WHERE campo_slug = ? ORDER BY hoyo
    `).bind(campo).all();
    return json({ ok: true, hoyos: result.results || [] });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { hoyos } = body; // Array de { hoyo, par, handicap_index, yardas_* }

    if (!Array.isArray(hoyos)) return json({ ok: false, error: "Falta array de hoyos." }, 400);

    for (const h of hoyos) {
      if (h.hoyo < 1 || h.hoyo > 18) continue;
      
      await env.DB.prepare(`
        INSERT INTO hoyos (campo_slug, hoyo, par, handicap_index, yardas_negro, yardas_azul, 
                          yardas_blanco, yardas_amarillo, yardas_rojo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(campo_slug, hoyo) DO UPDATE SET
          par = excluded.par, handicap_index = excluded.handicap_index,
          yardas_negro = excluded.yardas_negro, yardas_azul = excluded.yardas_azul,
          yardas_blanco = excluded.yardas_blanco, yardas_amarillo = excluded.yardas_amarillo,
          yardas_rojo = excluded.yardas_rojo
      `).bind(campo, h.hoyo, h.par || 4, h.handicap_index || h.hoyo, 
              h.yardas_negro || null, h.yardas_azul || null, h.yardas_blanco || null,
              h.yardas_amarillo || null, h.yardas_rojo || null).run();
    }

    return json({ ok: true, message: "Hoyos guardados." });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

// ============================================================
//  API: Rondas
// ============================================================

async function handleAdminRondas(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const evento = url.searchParams.get("evento");
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);

  if (request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT * FROM rondas WHERE evento_slug = ? ORDER BY numero
    `).bind(evento).all();
    return json({ ok: true, rondas: result.results || [] });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { numero, fecha, estado } = body;

    await env.DB.prepare(`
      INSERT INTO rondas (evento_slug, numero, fecha, estado)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(evento_slug, numero) DO UPDATE SET
        fecha = excluded.fecha, estado = excluded.estado
    `).bind(evento, numero, fecha || null, estado || 'pendiente').run();

    return json({ ok: true, message: "Ronda guardada." });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

// ============================================================
//  API: Jugadores
// ============================================================

async function handleJugadores(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const evento = url.searchParams.get("evento");
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);

  if (request.method === "GET") {
    const ronda = parseInt(url.searchParams.get("ronda") || "1");
    
    // Obtener jugadores
    const jugadores = await env.DB.prepare(`
      SELECT * FROM jugadores WHERE evento_slug = ? AND estado = 'confirmado'
      ORDER BY apellido_paterno, nombres
    `).bind(evento).all();

    // Obtener scores de esta ronda
    const scoresDb = await env.DB.prepare(`
      SELECT jugador_rut, hoyo, golpes, putts, fairway, penalidades 
      FROM scores WHERE evento_slug = ? AND ronda = ?
    `).bind(evento, ronda).all();

    // Agrupar scores por jugador - devolver solo golpes para compatibilidad
    const scoresMap = {};
    for (const s of (scoresDb.results || [])) {
      if (!scoresMap[s.jugador_rut]) scoresMap[s.jugador_rut] = {};
      scoresMap[s.jugador_rut][s.hoyo] = s.golpes;
    }

    return json({
      ok: true,
      jugadores: jugadores.results || [],
      scores: scoresMap,
      ronda
    });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { rut, nombres, apellido_paterno, apellido_materno, club, handicap, categoria } = body;

    if (!rut || !nombres || !apellido_paterno) {
      return json({ ok: false, error: "Faltan datos requeridos." }, 400);
    }

    const rutLimpio = rut.replace(/[^0-9kK]/gi, "").toUpperCase();

    await env.DB.prepare(`
      INSERT INTO jugadores (evento_slug, rut, nombres, apellido_paterno, apellido_materno, 
                            club, handicap, categoria, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmado')
      ON CONFLICT(evento_slug, rut) DO UPDATE SET
        nombres = excluded.nombres, apellido_paterno = excluded.apellido_paterno,
        apellido_materno = excluded.apellido_materno, club = excluded.club,
        handicap = excluded.handicap, categoria = excluded.categoria
    `).bind(evento, rutLimpio, nombres, apellido_paterno, apellido_materno || null,
            club || null, handicap || null, categoria || null).run();

    return json({ ok: true, message: "Jugador agregado." });
  }

  if (request.method === "DELETE") {
    const { rut } = await request.json();
    if (!rut) return json({ ok: false, error: "Falta rut." }, 400);

    await env.DB.prepare(`
      UPDATE jugadores SET estado = 'retirado' WHERE evento_slug = ? AND rut = ?
    `).bind(evento, rut).run();

    return json({ ok: true, message: "Jugador retirado." });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

async function handleJugador(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  const rut = (url.searchParams.get("rut") || "").replace(/[^0-9kK]/gi, "").toUpperCase();
  
  if (!evento || !rut) return json({ ok: false, error: "Faltan parámetros." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // Buscar jugador
  const jugador = await env.DB.prepare(`
    SELECT * FROM jugadores WHERE evento_slug = ? AND rut LIKE ? AND estado = 'confirmado'
  `).bind(evento, `%${rut}%`).first();

  if (!jugador) return json({ ok: false, error: "Jugador no encontrado en este torneo." }, 404);

  // Obtener evento info
  const eventoDb = await env.DB.prepare(`
    SELECT titulo, campo_slug, num_rondas FROM eventos WHERE slug = ?
  `).bind(evento).first();

  // Obtener pars
  let pars = DEFAULT_PARS;
  let yards = DEFAULT_YARDS;
  if (eventoDb?.campo_slug) {
    const hoyos = await env.DB.prepare(`
      SELECT par, yardas_blanco FROM hoyos WHERE campo_slug = ? ORDER BY hoyo
    `).bind(eventoDb.campo_slug).all();
    if (hoyos.results?.length === 18) {
      pars = hoyos.results.map(h => h.par);
      yards = hoyos.results.map(h => h.yardas_blanco || 400);
    }
  }

  // Determinar ronda actual
  const rondaActual = await env.DB.prepare(`
    SELECT numero FROM rondas WHERE evento_slug = ? 
    AND estado IN ('en_curso', 'pendiente') ORDER BY numero ASC LIMIT 1
  `).bind(evento).first();
  const ronda = rondaActual?.numero || 1;

  // Obtener scores del jugador
  const scoresDb = await env.DB.prepare(`
    SELECT hoyo, golpes, putts, fairway, penalidades FROM scores 
    WHERE evento_slug = ? AND ronda = ? AND jugador_rut = ?
  `).bind(evento, ronda, jugador.rut).all();

  const scores = {};
  for (const s of (scoresDb.results || [])) {
    scores[s.hoyo] = {
      golpes: s.golpes,
      putts: s.putts || 2,
      fairway: s.fairway,
      penalties: s.penalidades || 0
    };
  }

  return json({
    ok: true,
    jugador: { ...jugador, evento_titulo: eventoDb?.titulo },
    scores,
    pars,
    yards,
    ronda
  });
}

// ============================================================
//  API: Sync con sistema de inscripciones
// ============================================================

async function handleSyncInscripciones(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Método no permitido." }, 405);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const body = await request.json();
  const { evento, inscripciones } = body;

  if (!evento || !Array.isArray(inscripciones)) {
    return json({ ok: false, error: "Faltan datos." }, 400);
  }

  let count = 0;
  for (const i of inscripciones) {
    if (!i.rut || !i.nombres) continue;

    const rutLimpio = i.rut.replace(/[^0-9kK]/gi, "").toUpperCase();

    await env.DB.prepare(`
      INSERT INTO jugadores (evento_slug, rut, nombres, apellido_paterno, apellido_materno, 
                            club, handicap, categoria, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmado')
      ON CONFLICT(evento_slug, rut) DO NOTHING
    `).bind(evento, rutLimpio, i.nombres, i.apellido_paterno || '', i.apellido_materno || null,
            i.club || null, i.handicap || i.indice || null, i.categoria || null).run();
    count++;
  }

  return json({ ok: true, message: `Sincronizados ${count} jugadores.`, count });
}

// ============================================================
//  API: Grupos de Salida
// ============================================================

async function handleGrupos(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const evento = url.searchParams.get("evento");
  const ronda = parseInt(url.searchParams.get("ronda") || "1");
  
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);

  if (request.method === "GET") {
    const grupos = await env.DB.prepare(`
      SELECT * FROM grupos WHERE evento_slug = ? AND ronda = ? ORDER BY hora ASC
    `).bind(evento, ronda).all();

    const result = [];
    for (const g of (grupos.results || [])) {
      const jugadores = await env.DB.prepare(`
        SELECT j.nombres, j.apellido_paterno, j.club, j.handicap
        FROM grupo_jugadores gj
        JOIN jugadores j ON gj.jugador_rut = j.rut AND j.evento_slug = ?
        WHERE gj.grupo_id = ?
        ORDER BY gj.orden
      `).bind(evento, g.id).all();

      result.push({
        id: g.id,
        hora: g.hora,
        hoyo_salida: g.hoyo_salida,
        jugadores: jugadores.results || []
      });
    }

    return json({ ok: true, grupos: result, ronda });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const { hora, hoyo_salida, jugadores } = body;

    if (!hora) return json({ ok: false, error: "Falta hora." }, 400);

    // Crear grupo
    const result = await env.DB.prepare(`
      INSERT INTO grupos (evento_slug, ronda, hora, hoyo_salida) VALUES (?, ?, ?, ?)
    `).bind(evento, ronda, hora, hoyo_salida || 1).run();

    const grupoId = result.meta?.last_row_id;

    // Agregar jugadores al grupo
    if (Array.isArray(jugadores) && grupoId) {
      for (let i = 0; i < jugadores.length; i++) {
        const rut = jugadores[i].replace(/[^0-9kK]/gi, "").toUpperCase();
        await env.DB.prepare(`
          INSERT INTO grupo_jugadores (grupo_id, jugador_rut, orden) VALUES (?, ?, ?)
        `).bind(grupoId, rut, i + 1).run();
      }
    }

    return json({ ok: true, message: "Grupo creado.", grupo_id: grupoId });
  }

  if (request.method === "DELETE") {
    const { grupo_id } = await request.json();
    if (!grupo_id) return json({ ok: false, error: "Falta grupo_id." }, 400);

    await env.DB.prepare(`DELETE FROM grupo_jugadores WHERE grupo_id = ?`).bind(grupo_id).run();
    await env.DB.prepare(`DELETE FROM grupos WHERE id = ?`).bind(grupo_id).run();

    return json({ ok: true, message: "Grupo eliminado." });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

// ============================================================
//  API: Scores
// ============================================================

async function handleScores(request, url, env) {
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // GET - Obtener scores de un jugador
  if (request.method === "GET") {
    const evento = url.searchParams.get("evento");
    const ronda = parseInt(url.searchParams.get("ronda") || "1");
    const rut = url.searchParams.get("rut");

    if (!evento || !rut) return json({ ok: false, error: "Faltan parámetros." }, 400);

    const scores = await env.DB.prepare(`
      SELECT hoyo, golpes, putts, fairway, penalidades FROM scores
      WHERE evento_slug = ? AND ronda = ? AND jugador_rut = ?
      ORDER BY hoyo
    `).bind(evento, ronda, rut).all();

    return json({ ok: true, scores: scores.results || [] });
  }

  // POST - Guardar scores
  if (request.method === "POST") {
    const body = await request.json();
    const { evento, ronda, jugador_rut, scores, ingresado_por } = body;

    if (!evento || !ronda || !jugador_rut || !scores) {
      return json({ ok: false, error: "Faltan parámetros requeridos." }, 400);
    }

    const source = ingresado_por || 'admin';

    // Guardar cada hoyo
    for (const [hoyo, data] of Object.entries(scores)) {
      const hoyoNum = parseInt(hoyo);
      if (hoyoNum < 1 || hoyoNum > 18) continue;

      const golpes = typeof data === 'object' ? data.golpes : data;
      const putts = typeof data === 'object' ? (data.putts || null) : null;
      const fairway = typeof data === 'object' ? (data.fairway || null) : null;
      const penalties = typeof data === 'object' ? (data.penalties || 0) : 0;

      if (!golpes || golpes < 1) continue;

      await env.DB.prepare(`
        INSERT INTO scores (evento_slug, ronda, jugador_rut, hoyo, golpes, putts, fairway, penalidades, ingresado_por, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(evento_slug, ronda, jugador_rut, hoyo) 
        DO UPDATE SET golpes = excluded.golpes, putts = excluded.putts, 
                      fairway = excluded.fairway, penalidades = excluded.penalidades,
                      ingresado_por = excluded.ingresado_por, updated_at = datetime('now')
      `).bind(evento, ronda, jugador_rut, hoyoNum, golpes, putts, fairway, penalties, source).run();
    }

    // Actualizar totales
    await actualizarTotales(env, evento, ronda, jugador_rut);

    return json({ ok: true, message: "Scores guardados." });
  }

  return json({ ok: false, error: "Método no permitido." }, 405);
}

async function actualizarTotales(env, evento, ronda, jugador_rut) {
  // Obtener pars
  const eventoDb = await env.DB.prepare(`SELECT campo_slug FROM eventos WHERE slug = ?`).bind(evento).first();

  let pars = DEFAULT_PARS;
  if (eventoDb?.campo_slug) {
    const hoyos = await env.DB.prepare(`SELECT par FROM hoyos WHERE campo_slug = ? ORDER BY hoyo`).bind(eventoDb.campo_slug).all();
    if (hoyos.results?.length === 18) {
      pars = hoyos.results.map(h => h.par);
    }
  }

  // Obtener scores del jugador
  const scoresDb = await env.DB.prepare(`
    SELECT hoyo, golpes FROM scores WHERE evento_slug = ? AND ronda = ? AND jugador_rut = ?
  `).bind(evento, ronda, jugador_rut).all();

  let totalBruto = 0;
  let stablefordBruto = 0;
  let thru = 0;
  let totalParJugado = 0;

  for (const s of (scoresDb.results || [])) {
    if (s.golpes && s.golpes > 0) {
      totalBruto += s.golpes;
      totalParJugado += pars[s.hoyo - 1];
      stablefordBruto += calcularStableford(s.golpes, pars[s.hoyo - 1]);
      thru++;
    }
  }

  const totalPar = thru > 0 ? totalBruto - totalParJugado : 0;
  const estado = thru === 18 ? 'finalizado' : thru > 0 ? 'en_curso' : 'no_iniciado';

  await env.DB.prepare(`
    INSERT INTO totales (evento_slug, ronda, jugador_rut, total_bruto, total_par, stableford_bruto, thru, estado, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(evento_slug, ronda, jugador_rut)
    DO UPDATE SET total_bruto = excluded.total_bruto, total_par = excluded.total_par,
                  stableford_bruto = excluded.stableford_bruto, thru = excluded.thru,
                  estado = excluded.estado, updated_at = datetime('now')
  `).bind(evento, ronda, jugador_rut, totalBruto || null, totalPar, stablefordBruto, thru, estado).run();
}

async function handleSubmitRound(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Método no permitido." }, 405);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const body = await request.json();
  const { evento, ronda, jugador_rut, scores, confirmado } = body;

  if (!evento || !ronda || !jugador_rut) {
    return json({ ok: false, error: "Faltan parámetros." }, 400);
  }

  // Guardar scores si vienen
  if (scores) {
    for (const [hoyo, data] of Object.entries(scores)) {
      const hoyoNum = parseInt(hoyo);
      if (hoyoNum < 1 || hoyoNum > 18) continue;
      
      const golpes = typeof data === 'object' ? data.golpes : data;
      const putts = typeof data === 'object' ? (data.putts || null) : null;
      const fairway = typeof data === 'object' ? (data.fairway || null) : null;
      const penalties = typeof data === 'object' ? (data.penalties || 0) : 0;

      if (!golpes) continue;

      await env.DB.prepare(`
        INSERT INTO scores (evento_slug, ronda, jugador_rut, hoyo, golpes, putts, fairway, penalidades, ingresado_por, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'jugador', datetime('now'))
        ON CONFLICT(evento_slug, ronda, jugador_rut, hoyo) 
        DO UPDATE SET golpes = excluded.golpes, putts = excluded.putts,
                      fairway = excluded.fairway, penalidades = excluded.penalidades,
                      ingresado_por = 'jugador', updated_at = datetime('now')
      `).bind(evento, ronda, jugador_rut, hoyoNum, golpes, putts, fairway, penalties).run();
    }
  }

  // Marcar como finalizado si confirmado
  if (confirmado) {
    await env.DB.prepare(`
      UPDATE totales SET estado = 'finalizado', updated_at = datetime('now')
      WHERE evento_slug = ? AND ronda = ? AND jugador_rut = ?
    `).bind(evento, ronda, jugador_rut).run();
  }

  await actualizarTotales(env, evento, ronda, jugador_rut);

  return json({ ok: true, message: "Ronda enviada." });
}

// ============================================================
//  API: Leaderboard
// ============================================================

async function handleLeaderboard(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  const ronda = url.searchParams.get("ronda");
  const formato = url.searchParams.get("formato") || "stroke";
  const categoria = url.searchParams.get("categoria") || "";
  
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // Obtener evento
  const eventoDb = await env.DB.prepare(`
    SELECT titulo, num_rondas, formato_juego, fecha_inicio, fecha_fin FROM eventos WHERE slug = ?
  `).bind(evento).first();

  if (!eventoDb) return json({ ok: false, error: "Evento no encontrado." }, 404);

  // Query base - acumular totales por rondas
  let whereClause = `WHERE t.evento_slug = ?`;
  const params = [evento];

  if (ronda) {
    whereClause += ` AND t.ronda = ?`;
    params.push(parseInt(ronda));
  }

  if (categoria) {
    whereClause += ` AND j.categoria = ?`;
    params.push(categoria);
  }

  const query = `
    SELECT 
      t.jugador_rut,
      j.nombres, j.apellido_paterno, j.club, j.handicap, j.categoria,
      SUM(t.total_bruto) as total_bruto,
      SUM(t.total_par) as total_par,
      SUM(t.stableford_bruto) as stableford,
      MAX(t.thru) as thru,
      MAX(t.ronda) as ultima_ronda,
      t.estado
    FROM totales t
    LEFT JOIN jugadores j ON t.jugador_rut = j.rut AND t.evento_slug = j.evento_slug
    ${whereClause}
    GROUP BY t.jugador_rut
    ORDER BY ${formato === "stableford" ? "stableford DESC, total_bruto ASC" : "total_par ASC, total_bruto ASC"}
  `;

  // Bind params dynamically
  let stmt = env.DB.prepare(query);
  if (params.length === 1) stmt = stmt.bind(params[0]);
  else if (params.length === 2) stmt = stmt.bind(params[0], params[1]);
  else if (params.length === 3) stmt = stmt.bind(params[0], params[1], params[2]);

  const results = await stmt.all();

  // Calcular posiciones
  const leaderboard = [];
  let pos = 0;
  let lastScore = null;
  let tied = 0;

  for (const r of (results.results || [])) {
    const score = formato === "stableford" ? r.stableford : r.total_par;
    if (score !== lastScore) {
      pos = pos + 1 + tied;
      tied = 0;
      lastScore = score;
    } else {
      tied++;
    }

    leaderboard.push({
      posicion: pos,
      rut: r.jugador_rut,
      nombre: r.nombres,
      apellido: r.apellido_paterno,
      club: r.club,
      handicap: r.handicap,
      categoria: r.categoria,
      total_bruto: r.total_bruto,
      total_par: r.total_par,
      stableford: r.stableford,
      thru: r.thru,
      estado: r.estado
    });
  }

  return json({
    ok: true,
    evento: {
      slug: evento,
      titulo: eventoDb.titulo,
      formato: eventoDb.formato_juego || 'stroke_play',
      num_rondas: eventoDb.num_rondas,
      fecha_inicio: eventoDb.fecha_inicio,
      fecha_fin: eventoDb.fecha_fin
    },
    leaderboard
  });
}

// ============================================================
//  API: Scorecard individual
// ============================================================

async function handleScorecard(url, env) {
  const evento = url.searchParams.get("evento");
  // Aceptar tanto "rut" como "jugador" como parámetro
  const rutParam = url.searchParams.get("rut") || url.searchParams.get("jugador") || "";
  const rut = rutParam.replace(/[^0-9kK]/gi, "").toUpperCase();
  const ronda = url.searchParams.get("ronda"); // null = todas las rondas
  
  if (!evento || !rut) return json({ ok: false, error: "Faltan parámetros." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // Obtener jugador
  const jugador = await env.DB.prepare(`
    SELECT * FROM jugadores WHERE evento_slug = ? AND rut LIKE ?
  `).bind(evento, `%${rut}%`).first();

  if (!jugador) return json({ ok: false, error: "Jugador no encontrado." }, 404);

  // Obtener pars
  const eventoDb = await env.DB.prepare(`SELECT campo_slug, titulo FROM eventos WHERE slug = ?`).bind(evento).first();
  let pars = DEFAULT_PARS;
  if (eventoDb?.campo_slug) {
    const hoyos = await env.DB.prepare(`SELECT par FROM hoyos WHERE campo_slug = ? ORDER BY hoyo`).bind(eventoDb.campo_slug).all();
    if (hoyos.results?.length === 18) pars = hoyos.results.map(h => h.par);
  }

  // Obtener scores
  let scoresQuery = `SELECT ronda, hoyo, golpes, putts FROM scores WHERE evento_slug = ? AND jugador_rut = ?`;
  const queryParams = [evento, jugador.rut];
  
  if (ronda) {
    scoresQuery += ` AND ronda = ?`;
    queryParams.push(parseInt(ronda));
  }
  scoresQuery += ` ORDER BY ronda, hoyo`;

  let stmt = env.DB.prepare(scoresQuery);
  if (queryParams.length === 2) stmt = stmt.bind(queryParams[0], queryParams[1]);
  else stmt = stmt.bind(queryParams[0], queryParams[1], queryParams[2]);

  const scoresDb = await stmt.all();

  // Organizar por ronda
  const rondas = {};
  for (const s of (scoresDb.results || [])) {
    if (!rondas[s.ronda]) rondas[s.ronda] = { holes: {}, stats: { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0 } };
    rondas[s.ronda].holes[s.hoyo] = s.golpes;
    
    const diff = s.golpes - pars[s.hoyo - 1];
    if (diff <= -2) rondas[s.ronda].stats.eagles++;
    else if (diff === -1) rondas[s.ronda].stats.birdies++;
    else if (diff === 0) rondas[s.ronda].stats.pars++;
    else if (diff === 1) rondas[s.ronda].stats.bogeys++;
    else rondas[s.ronda].stats.doubles++;
  }

  // Obtener totales
  const totales = await env.DB.prepare(`
    SELECT ronda, total_bruto, total_par, stableford_bruto, thru, estado
    FROM totales WHERE evento_slug = ? AND jugador_rut = ? ORDER BY ronda
  `).bind(evento, jugador.rut).all();

  return json({
    ok: true,
    jugador: {
      rut: jugador.rut,
      nombre: jugador.nombres,
      apellido: jugador.apellido_paterno,
      club: jugador.club,
      handicap: jugador.handicap,
      categoria: jugador.categoria
    },
    evento: eventoDb?.titulo,
    pars,
    rondas,
    totales: totales.results || []
  });
}

// ============================================================
//  API: Estadísticas por hoyo
// ============================================================

async function handleStats(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  const ronda = parseInt(url.searchParams.get("ronda") || "0");
  
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  // Obtener pars
  const eventoDb = await env.DB.prepare(`SELECT campo_slug FROM eventos WHERE slug = ?`).bind(evento).first();
  let pars = DEFAULT_PARS;
  if (eventoDb?.campo_slug) {
    const hoyos = await env.DB.prepare(`SELECT par FROM hoyos WHERE campo_slug = ? ORDER BY hoyo`).bind(eventoDb.campo_slug).all();
    if (hoyos.results?.length === 18) pars = hoyos.results.map(h => h.par);
  }

  // Estadísticas por hoyo
  const stats = [];
  for (let i = 1; i <= 18; i++) {
    const par = pars[i - 1];
    
    let statsQuery = `SELECT AVG(golpes) as promedio, COUNT(*) as total FROM scores WHERE evento_slug = ? AND hoyo = ?`;
    const params = [evento, i];
    if (ronda) {
      statsQuery += ` AND ronda = ?`;
      params.push(ronda);
    }

    let stmt = env.DB.prepare(statsQuery);
    if (params.length === 2) stmt = stmt.bind(params[0], params[1]);
    else stmt = stmt.bind(params[0], params[1], params[2]);
    
    const row = await stmt.first();

    // Distribución
    let distQuery = `SELECT golpes, COUNT(*) as cnt FROM scores WHERE evento_slug = ? AND hoyo = ?`;
    if (ronda) distQuery += ` AND ronda = ?`;
    distQuery += ` GROUP BY golpes`;
    
    let distStmt = env.DB.prepare(distQuery);
    if (params.length === 2) distStmt = distStmt.bind(params[0], params[1]);
    else distStmt = distStmt.bind(params[0], params[1], params[2]);
    
    const dist = await distStmt.all();
    
    let eagles = 0, birdies = 0, parsCount = 0, bogeys = 0, dobles = 0;
    for (const d of (dist.results || [])) {
      const diff = d.golpes - par;
      if (diff <= -2) eagles += d.cnt;
      else if (diff === -1) birdies += d.cnt;
      else if (diff === 0) parsCount += d.cnt;
      else if (diff === 1) bogeys += d.cnt;
      else dobles += d.cnt;
    }

    stats.push({
      hoyo: i,
      par,
      promedio: parseFloat(row?.promedio?.toFixed(2)) || par,
      total_scores: row?.total || 0,
      eagles,
      birdies,
      pars: parsCount,
      bogeys,
      dobles_mas: dobles
    });
  }

  // Ranking de dificultad
  const sorted = [...stats].sort((a, b) => b.promedio - a.promedio);
  stats.forEach(s => {
    s.ranking_dificultad = sorted.findIndex(x => x.hoyo === s.hoyo) + 1;
  });

  return json({ ok: true, stats, pars });
}

// ============================================================
//  API: Salidas (Tee Times)
// ============================================================

async function handleSalidas(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  const ronda = parseInt(url.searchParams.get("ronda") || "1");
  
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const grupos = await env.DB.prepare(`
    SELECT id, hora, hoyo_salida FROM grupos WHERE evento_slug = ? AND ronda = ? ORDER BY hora ASC
  `).bind(evento, ronda).all();

  const result = [];
  for (const g of (grupos.results || [])) {
    const jugadores = await env.DB.prepare(`
      SELECT j.nombres, j.apellido_paterno as apellido, j.club, j.handicap
      FROM grupo_jugadores gj
      JOIN jugadores j ON gj.jugador_rut = j.rut AND j.evento_slug = ?
      WHERE gj.grupo_id = ?
      ORDER BY gj.orden
    `).bind(evento, g.id).all();

    result.push({
      hora: g.hora,
      hoyo_salida: g.hoyo_salida,
      jugadores: jugadores.results || []
    });
  }

  return json({ ok: true, grupos: result, ronda: `Ronda ${ronda}` });
}

// ============================================================
//  API: Field
// ============================================================

async function handleField(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const jugadores = await env.DB.prepare(`
    SELECT nombres, apellido_paterno as apellido, club, handicap, categoria
    FROM jugadores WHERE evento_slug = ? AND estado = 'confirmado'
    ORDER BY apellido_paterno, nombres
  `).bind(evento).all();

  return json({ ok: true, jugadores: jugadores.results || [] });
}

// ============================================================
//  API: Historial
// ============================================================

async function handleHistorial(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const rondas = await env.DB.prepare(`
    SELECT numero, fecha, estado FROM rondas WHERE evento_slug = ? ORDER BY numero
  `).bind(evento).all();

  const result = [];
  for (const r of (rondas.results || [])) {
    const stats = await env.DB.prepare(`
      SELECT MIN(total_bruto) as mejor_score, AVG(total_bruto) as promedio, COUNT(*) as jugadores
      FROM totales WHERE evento_slug = ? AND ronda = ? AND estado = 'finalizado'
    `).bind(evento, r.numero).first();

    const lider = await env.DB.prepare(`
      SELECT j.nombres, j.apellido_paterno, t.total_bruto, t.total_par
      FROM totales t
      JOIN jugadores j ON t.jugador_rut = j.rut AND t.evento_slug = j.evento_slug
      WHERE t.evento_slug = ? AND t.ronda = ?
      ORDER BY t.total_par ASC LIMIT 1
    `).bind(evento, r.numero).first();

    result.push({
      numero: r.numero,
      fecha: r.fecha,
      completada: r.estado === 'finalizada',
      lider: lider ? `${lider.nombres} ${lider.apellido_paterno}` : null,
      mejor_score: stats?.mejor_score,
      promedio: stats?.promedio
    });
  }

  return json({ ok: true, rondas: result });
}

// ============================================================
//  API: Import/Export
// ============================================================

async function handleImport(request, env) {
  if (request.method !== "POST") return json({ ok: false, error: "Método no permitido." }, 405);
  
  // TODO: Implementar parsing de CSV/Excel
  return json({ ok: false, error: "Importación requiere configuración adicional." }, 501);
}

async function handleExport(url, env) {
  const evento = (url.searchParams.get("evento") || "").trim();
  const ronda = parseInt(url.searchParams.get("ronda") || "1");
  
  if (!evento) return json({ ok: false, error: "Falta parámetro evento." }, 400);
  if (!env.DB) return json({ ok: false, error: "Falta binding DB." }, 500);

  const scores = await env.DB.prepare(`
    SELECT s.jugador_rut, j.nombres, j.apellido_paterno, s.hoyo, s.golpes
    FROM scores s
    LEFT JOIN jugadores j ON s.jugador_rut = j.rut AND s.evento_slug = j.evento_slug
    WHERE s.evento_slug = ? AND s.ronda = ?
    ORDER BY j.apellido_paterno, j.nombres, s.hoyo
  `).bind(evento, ronda).all();

  // Agrupar por jugador
  const jugadores = {};
  for (const s of (scores.results || [])) {
    const key = s.jugador_rut;
    if (!jugadores[key]) {
      jugadores[key] = {
        rut: s.jugador_rut,
        nombre: `${s.nombres || ''} ${s.apellido_paterno || ''}`.trim(),
        scores: {}
      };
    }
    jugadores[key].scores[s.hoyo] = s.golpes;
  }

  // Generar CSV
  let csv = "RUT,Nombre,H1,H2,H3,H4,H5,H6,H7,H8,H9,OUT,H10,H11,H12,H13,H14,H15,H16,H17,H18,IN,TOTAL\n";
  
  for (const j of Object.values(jugadores)) {
    let out = 0, inn = 0;
    const row = [j.rut, `"${j.nombre}"`];
    
    for (let h = 1; h <= 9; h++) {
      const s = j.scores[h] || '';
      row.push(s);
      if (s) out += s;
    }
    row.push(out || '');
    
    for (let h = 10; h <= 18; h++) {
      const s = j.scores[h] || '';
      row.push(s);
      if (s) inn += s;
    }
    row.push(inn || '');
    row.push((out + inn) || '');
    
    csv += row.join(',') + '\n';
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': `attachment; filename="scores_${evento}_ronda${ronda}.csv"`,
      ...corsHeaders()
    }
  });
}
