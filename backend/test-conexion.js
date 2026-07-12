// ─────────────────────────────────────────────────────────────────────────────
// test-conexion.js — Verifica la conexión a Azure SQL Database
// Uso: node test-conexion.js
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const sql = require("mssql");

const dbConfig = {
  server:   process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  authentication: {
    type: "default",
    options: {
      userName: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
    },
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 15000,
  },
};

async function probarConexion() {
  console.log("🔄 Intentando conectar a Azure SQL...");
  console.log(`   Servidor: ${dbConfig.server}`);
  console.log(`   Base de datos: ${dbConfig.database}`);

  try {
    const pool = await sql.connect(dbConfig);
    console.log("✅ Conexión exitosa\n");

    // Prueba 1: contar máquinas
    const maquinas = await pool.request().query("SELECT COUNT(*) AS total FROM Maquinas");
    console.log(`📦 Máquinas en la base de datos: ${maquinas.recordset[0].total}`);

    // Prueba 2: traer una orden de ejemplo
    const orden = await pool.request().query("SELECT TOP 1 * FROM OrdenesProduccion");
    if (orden.recordset.length > 0) {
      console.log(`📋 Orden de ejemplo: ${orden.recordset[0].orden_id} — ${orden.recordset[0].producto}`);
    }

    // Prueba 3: timestamp del servidor (confirma que el round-trip funciona)
    const fecha = await pool.request().query("SELECT GETDATE() AS ahora");
    console.log(`🕐 Hora del servidor SQL: ${fecha.recordset[0].ahora}`);

    await pool.close();
    console.log("\n✅ Todo funciona correctamente. Puedes levantar el server.js con confianza.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Error de conexión:");
    console.error(`   ${err.message}\n`);

    if (err.message.includes("ENOTFOUND") || err.message.includes("getaddrinfo")) {
      console.error("💡 Sugerencia: revisa que AZURE_SQL_SERVER esté bien escrito (debe incluir .database.windows.net)");
    } else if (err.message.includes("Login failed")) {
      console.error("💡 Sugerencia: revisa AZURE_SQL_USER y AZURE_SQL_PASSWORD en tu .env");
    } else if (err.message.includes("firewall") || err.message.includes("blocked")) {
      console.error("💡 Sugerencia: agrega tu IP actual en el portal → Servidor SQL → Seguridad de red");
    } else if (err.message.includes("timeout") || err.code === "ETIMEOUT") {
      console.error("💡 Sugerencia: verifica tu conexión a internet o si hay un firewall corporativo bloqueando el puerto 1433");
    }
    process.exit(1);
  }
}

probarConexion();
