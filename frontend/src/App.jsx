import { useState, useEffect } from "react";

// ── Configuración ──────────────────────────────────────────────────────────
const API_BASE = "https://jdm-mes.azurewebsites.net/api";
const API_ROOT = "https://jdm-mes.azurewebsites.net";

// ── Paleta de colores ──────────────────────────────────────────────────────
const C = {
  rojo:      "#f02d4d",
  azul:      "#0b3c6d",
  gris:      "#d9d9d9",
  bgMain:    "#040e1d",
  bgCard:    "#071a30",
  bgCard2:   "#0a2240",
  border:    "#0d2e52",
  border2:   "#0b3c6d",
  textMuted: "#6a8faa",
  textSub:   "#9ab0c4",
};

// ── Gauge OEE ──────────────────────────────────────────────────────────────
function GaugeOEE({ valor }) {
  const cx = 100, cy = 95, r = 65;
  const pct = Math.min(Math.max(valor, 0), 100) / 100;
  const sx = cx - r;
  const sy = cy;
  const angle = Math.PI * (1 - pct);
  const ex = +(cx + r * Math.cos(angle)).toFixed(2);
  const ey = +(cy - r * Math.sin(angle)).toFixed(2);
  const color = valor >= 70 ? C.rojo : valor >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%" }}>
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${cx + r} ${sy}`}
        fill="none" stroke={C.border2} strokeWidth="14" strokeLinecap="round" />
      {pct > 0 && (
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
        fontSize="28" fontWeight="700" fontFamily="monospace">{valor}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textMuted}
        fontSize="11" fontFamily="system-ui">OEE</text>
      <text x={sx + 4} y={cy + 16} textAnchor="middle" fill={C.border2} fontSize="9">0</text>
      <text x={cx + r - 4} y={cy + 16} textAnchor="middle" fill={C.border2} fontSize="9">100</text>
    </svg>
  );
}

// ── Tarjeta KPI ────────────────────────────────────────────────────────────
function TarjetaKPI({ etiqueta, valor, unidad = "%" }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{etiqueta}</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 30, fontFamily: "monospace", fontWeight: 700, color: C.gris }}>{valor}</span>
        <span style={{ fontSize: 13, color: C.textMuted, marginBottom: 3 }}>{unidad}</span>
      </div>
    </div>
  );
}

// ── Tarjeta de Máquina ─────────────────────────────────────────────────────
const CFG_ESTADO = {
  corriendo:     { punto: "#10b981", etiqueta: "Corriendo",     color: "#10b981" },
  en_espera:     { punto: "#f59e0b", etiqueta: "En espera",     color: "#f59e0b" },
  falla:         { punto: C.rojo,    etiqueta: "Falla",         color: C.rojo    },
  mantenimiento: { punto: "#60a5fa", etiqueta: "Mantenimiento", color: "#60a5fa" },
};

function TarjetaMaquina({ maquina: m }) {
  const s = CFG_ESTADO[m.estado] || CFG_ESTADO.en_espera;
  const piezas = m.piezas_producidas ?? 0;
  const meta   = m.piezas_meta ?? 1;
  const pct    = Math.min(Math.round((piezas / meta) * 100), 100);
  const colorBarra = m.estado === "falla" ? C.rojo : pct >= 90 ? "#10b981" : C.rojo;
  const bordeColor = m.estado === "falla" ? C.rojo : C.border;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${bordeColor}`, borderRadius: 12, padding: 12,
      boxShadow: m.estado === "falla" ? `0 0 10px ${C.rojo}44` : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textMuted }}>{m.maquina_id}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: s.punto,
            boxShadow: m.estado === "falla" ? `0 0 6px ${s.punto}` : "none" }} />
          <span style={{ fontSize: 11, color: s.color }}>{s.etiqueta}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gris, marginBottom: 10, lineHeight: 1.3 }}>{m.nombre}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
        <span>Botellas</span>
        <span style={{ fontFamily: "monospace", color: C.gris }}>
          {piezas.toLocaleString("es-MX")} / {meta.toLocaleString("es-MX")}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 9999, background: C.bgCard2 }}>
        <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, backgroundColor: colorBarra, transition: "width .7s ease" }} />
      </div>
      {m.estado === "corriendo" && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.textMuted }}>
          Eficiencia <span style={{ color: C.gris, fontFamily: "monospace" }}>{m.eficiencia}%</span>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de Orden ───────────────────────────────────────────────────────
const CFG_ORDEN = {
  en_tiempo:  { bg: "#0a2240", texto: "#10b981", etiqueta: "En tiempo"  },
  retrasada:  { bg: "#2d0a12", texto: C.rojo,    etiqueta: "Retrasada"  },
  completa:   { bg: "#0a1e3d", texto: "#60a5fa", etiqueta: "Completada" },
  en_riesgo:  { bg: "#2d0a12", texto: "#f87171", etiqueta: "En riesgo"  },
  en_proceso: { bg: "#0a2240", texto: "#10b981", etiqueta: "En proceso" },
  pendiente:  { bg: "#1a1a2d", texto: "#f59e0b", etiqueta: "Pendiente"  },
};

function TarjetaOrden({ orden: o }) {
  const s = CFG_ORDEN[o.estado] || CFG_ORDEN.pendiente;
  const hecho = o.cantidad_producida ?? 0;
  const qty   = o.cantidad_planificada ?? 1;
  const pct   = Math.round((hecho / qty) * 100);
  return (
    <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textMuted }}>{o.orden_id}</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600, backgroundColor: s.bg, color: s.texto }}>{s.etiqueta}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.gris, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {o.producto}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted, marginBottom: 6 }}>
        <span>{hecho.toLocaleString("es-MX")} / {qty.toLocaleString("es-MX")} botellas</span>
        <span>Ent. {o.hora_entrega}</span>
      </div>
      <div style={{ height: 4, borderRadius: 9999, background: C.bgMain }}>
        <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, backgroundColor: s.texto }} />
      </div>
    </div>
  );
}

// ── Esqueleto de carga ─────────────────────────────────────────────────────
function Skeleton({ height = 60 }) {
  return <div style={{ height, borderRadius: 12, background: C.bgCard2 }} />;
}

// ── Dashboard Principal ────────────────────────────────────────────────────
export default function MESDashboard() {
  const [hora, setHora]         = useState(new Date());
  const [maquinas, setMaquinas] = useState([]);
  const [ordenes, setOrdenes]   = useState([]);
  const [oee, setOee]           = useState({ disponibilidad: 0, rendimiento: 0, calidad: 0, oee: 0 });
  const [alertas, setAlertas]   = useState(0);
  const [dbStatus, setDbStatus] = useState("verificando");
  const [cargando, setCargando] = useState(true);

  // ── Fetch inicial y polling cada 30 s ──────────────────────────────────
  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const [resMaquinas, resOrdenes, resHealth, resOEE] = await Promise.all([
          fetch(`${API_BASE}/maquinas`),
          fetch(`${API_BASE}/ordenes`),
          fetch(`${API_ROOT}/health`),
          fetch(`${API_BASE}/oee`),
        ]);
        if (resMaquinas.ok) {
          const data = await resMaquinas.json();
          setMaquinas(data);
          setAlertas(data.filter(m => m.estado === "falla").length);
        }
        if (resOrdenes.ok) setOrdenes(await resOrdenes.json());
        if (resHealth.ok) {
          const h = await resHealth.json();
          setDbStatus(h.database === "conectado" ? "conectado" : "error");
        }
        if (resOEE.ok) {
          const data = await resOEE.json();
          setOee({
            disponibilidad: data.disponibilidad ?? 0,
            rendimiento:    data.rendimiento    ?? 0,
            calidad:        data.calidad        ?? 0,
            oee:            data.oee            ?? 0,
          });
        }
      } catch {
        setDbStatus("error");
      } finally {
        setCargando(false);
      }
    };
    fetchDatos();
    const intervaloAPI = setInterval(fetchDatos, 30000);
    return () => clearInterval(intervaloAPI);
  }, []);

  // ── Reloj ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const horaStr = `${pad(hora.getHours())}:${pad(hora.getMinutes())}:${pad(hora.getSeconds())}`;
  const fechaStr = hora.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div style={{ background: C.bgMain, minHeight: "100vh", color: C.gris, padding: 16, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 4, height: 36, borderRadius: 2, background: C.rojo }} />
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: C.gris, margin: 0 }}>Planta Norte — MES Dashboard</h1>
            <p style={{ fontSize: 11, color: C.textMuted, margin: "3px 0 0" }}>Línea de Bebidas Gaseosas · Turno Matutino 06:00 – 14:00</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {alertas > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px",
              borderRadius: 8, background: "#2d0a12", border: `1px solid ${C.rojo}` }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.rojo }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: C.rojo }}>
                {alertas} Alerta{alertas > 1 ? "s" : ""} activa{alertas > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: C.gris }}>{horaStr}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{fechaStr}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px",
            borderRadius: 8, background: "#051a30", border: `1px solid ${C.azul}` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%",
              background: dbStatus === "conectado" ? "#10b981" : dbStatus === "error" ? C.rojo : "#f59e0b" }} />
            <span style={{ fontSize: 11, color: C.textSub }}>
              Azure SQL · {dbStatus === "conectado" ? "Conectado" : dbStatus === "error" ? "Error" : "Verificando..."}
            </span>
          </div>
        </div>
      </header>

      {/* ── OEE + KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16,
          display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>OEE Global</span>
          <GaugeOEE valor={oee.oee} />
        </div>
        <TarjetaKPI etiqueta="Disponibilidad" valor={oee.disponibilidad} />
        <TarjetaKPI etiqueta="Rendimiento"    valor={oee.rendimiento}    />
        <TarjetaKPI etiqueta="Calidad"        valor={oee.calidad}        />
      </div>

      {/* ── Máquinas ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: "uppercase",
          letterSpacing: "0.08em", marginBottom: 12 }}>Estado de Línea de Producción</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {cargando
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={120} />)
            : maquinas.map(m => <TarjetaMaquina key={m.maquina_id} maquina={m} />)
          }
        </div>
      </div>

      {/* ── Órdenes ── */}
      <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: C.gris, margin: "0 0 12px" }}>Órdenes Activas</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {cargando
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={80} />)
            : ordenes.map(o => <TarjetaOrden key={o.orden_id} orden={o} />)
          }
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ marginTop: 16, textAlign: "center", fontFamily: "monospace", fontSize: 10, color: C.border2 }}>
        API: {API_BASE} · Actualiza cada 30 s · v1.2.0
      </footer>
    </div>
  );
}
