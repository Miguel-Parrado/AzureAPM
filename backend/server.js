// ─────────────────────────────────────────────────────────────────────────────
// MES API — Azure App Service + Azure SQL Database
// Instala dependencias: npm install
// Desarrollo local:      npm run dev
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const sql     = require("mssql");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Configuración Azure SQL ───────────────────────────────────────────────────
const dbConfig = {
  server:   process.env.AZURE_SQL_SERVER,   // e.g. "tu-servidor.database.windows.net"
  database: process.env.AZURE_SQL_DATABASE, // e.g. "mes_db"
  authentication: {
    type: "default",
    options: {
      userName: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
    },
  },
  options: {
    encrypt: true,               // Obligatorio para Azure SQL
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout:  30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

async function conectarDB() {
  try {
    pool = await sql.connect(dbConfig);
    console.log("✅ Conectado a Azure SQL Database");
  } catch (err) {
    console.error("❌ Error al conectar a Azure SQL:", err.message);
    process.exit(1);
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    database: pool?.connected ? "conectado" : "desconectado",
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/oee ──────────────────────────────────────────────────────────────
// Devuelve las métricas OEE del turno/fecha indicados
app.get("/api/oee", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT
        ROUND(AVG(CAST(eficiencia AS FLOAT)), 2)       AS disponibilidad,
        ROUND(AVG(CAST(eficiencia AS FLOAT)) * 0.95, 2) AS rendimiento,
        ROUND(AVG(CAST(eficiencia AS FLOAT)) * 0.99, 2) AS calidad,
        ROUND(
          AVG(CAST(eficiencia AS FLOAT)) *
          AVG(CAST(eficiencia AS FLOAT)) * 0.95 *
          AVG(CAST(eficiencia AS FLOAT)) * 0.99 / 10000.0
        , 2)                                            AS oee
      FROM (
        SELECT maquina_id, eficiencia
        FROM EstadoMaquina e1
        WHERE actualizado_en = (
          SELECT MAX(actualizado_en)
          FROM EstadoMaquina e2
          WHERE e2.maquina_id = e1.maquina_id
        )
        AND eficiencia > 0
      ) ultimos
    `);
    res.json(result.recordset[0] || { disponibilidad: 0, rendimiento: 0, calidad: 0, oee: 0 });
  } catch (err) {
    console.error("Error en GET /api/oee:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/maquinas ─────────────────────────────────────────────────────────
// Devuelve el estado actual de todas las máquinas
app.get("/api/maquinas", async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT
        m.maquina_id,
        m.nombre,
        m.linea,
        ms.estado,
        ms.eficiencia,
        ms.piezas_producidas,
        ms.piezas_meta,
        ms.actualizado_en
      FROM Maquinas m
      OUTER APPLY (
        SELECT TOP 1 *
        FROM EstadoMaquina
        WHERE maquina_id = m.maquina_id
        ORDER BY actualizado_en DESC
      ) ms
      ORDER BY m.maquina_id
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/maquinas/:id/estado ─────────────────────────────────────────────
// Actualiza el estado de una máquina (desde PLC / SCADA)
app.post("/api/maquinas/:id/estado", async (req, res) => {
  try {
    const { estado, eficiencia, piezas_producidas, piezas_meta } = req.body;
    await pool.request()
      .input("maquina_id",        sql.NVarChar(20), req.params.id)
      .input("estado",            sql.NVarChar(30), estado)
      .input("eficiencia",        sql.Decimal(5, 2), eficiencia)
      .input("piezas_producidas", sql.Int,           piezas_producidas)
      .input("piezas_meta",       sql.Int,           piezas_meta)
      .query(`
        INSERT INTO EstadoMaquina
          (maquina_id, estado, eficiencia, piezas_producidas, piezas_meta, actualizado_en)
        VALUES
          (@maquina_id, @estado, @eficiencia, @piezas_producidas, @piezas_meta, GETDATE())
      `);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error en POST /maquinas/:id/estado:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ordenes ──────────────────────────────────────────────────────────
// Devuelve las órdenes de producción activas
app.get("/api/ordenes", async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT
        orden_id,
        producto,
        cantidad_planificada,
        cantidad_producida,
        CONVERT(VARCHAR(5), hora_entrega, 108) AS hora_entrega,
        estado,
        maquina_id,
        creado_en
      FROM OrdenesProduccion
      WHERE estado IN ('pendiente', 'en_proceso', 'retrasada', 'en_riesgo', 'completa')
      ORDER BY hora_entrega ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/produccion/tendencia ─────────────────────────────────────────────
// Devuelve la tendencia de producción (para el gráfico en tiempo real)
app.get("/api/produccion/tendencia", async (req, res) => {
  try {
    const { horas = 1 } = req.query;
    const result = await pool.request()
      .input("horas", sql.Int, parseInt(horas))
      .query(`
        SELECT
          FORMAT(registrado_en, 'HH:mm')  AS time,
          SUM(piezas_producidas)           AS real,
          AVG(tasa_planificada)            AS plan
        FROM RegistroProduccion
        WHERE registrado_en >= DATEADD(HOUR, -@horas, GETDATE())
        GROUP BY
          DATEADD(MINUTE, DATEDIFF(MINUTE, 0, registrado_en) / 5 * 5, 0),
          FORMAT(registrado_en, 'HH:mm')
        ORDER BY 1
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/alertas ──────────────────────────────────────────────────────────
app.get("/api/alertas", async (_req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT TOP 20
        alerta_id, maquina_id, tipo, descripcion,
        severidad, resuelta, creado_en
      FROM Alertas
      WHERE resuelta = 0
      ORDER BY creado_en DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Inicio del servidor ───────────────────────────────────────────────────────
conectarDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 MES API corriendo en http://localhost:${PORT}`);
  });
});
