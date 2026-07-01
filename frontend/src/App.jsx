import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ── Configuración ──────────────────────────────────────────────────────────
// Cambia esta URL por la de tu Azure App Service
const API_BASE = "https://mes-api.azurewebsites.net/api";

// ── Datos de ejemplo (reemplaza con fetch a tu API Node.js) ────────────────
function generarTendencia() {
  const ahora = new Date();
  return Array.from({ length: 20 }, (_, i) => {
    const t = new Date(ahora - (19 - i) * 3 * 60000);
    return {
      time: `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`,
      real: Math.round(88 + (Math.random() - 0.5) * 24),
      plan: 90,
    };
  });
}

const MAQUINAS = [
  { id: "M-01", nombre: "Línea Ensamble A",  estado: "corriendo",    eficiencia: 92, piezas: 1240, meta: 1350 },
  { id: "M-02", nombre: "Prensa Hidráulica", estado: "corriendo",    eficiencia: 85, piezas:  682, meta:  800 },
  { id: "M-03", nombre: "CNC Fresadora",     estado: "falla",        eficiencia:  0, piezas:  240, meta:  500 },
  { id: "M-04", nombre: "Línea Ensamble B",  estado: "corriendo",    eficiencia: 78, piezas:  918, meta: 1180 },
  { id: "M-05", nombre: "Robot Soldador",    estado: "en_espera",    eficiencia:  0, piezas:  440, meta:  440 },
  { id: "M-06", nombre: "Insp. Calidad",     estado: "corriendo",    eficiencia: 97, piezas: 3520, meta: 3660 },
];

const ORDENES = [
  { id: "ORD-0891", producto: "Conjunto Motor A12",    qty: 500,  hecho: 324, hora: "16:00", estado: "en_tiempo"  },
  { id: "ORD-0892", producto: "Carcasa Freno B7",      qty: 800,  hecho: 240, hora: "18:00", estado: "retrasada"  },
  { id: "ORD-0893", producto: "Eje Transmisión C3",    qty: 200,  hecho: 200, hora: "12:00", estado: "completa"   },
  { id: "ORD-0894", producto: "Pistón Hidráulico D9",  qty: 350,  hecho:  50, hora: "20:00", estado: "en_riesgo"  },
  { id: "ORD-0895", producto: "Válvula Control E5",    qty: 1200, hecho: 980, hora: "14:30", estado: "en_tiempo"  },
];

// ── Gauge OEE (semicírculo SVG) ────────────────────────────────────────────
function GaugeOEE({ valor }) {
  const cx = 100, cy = 92, r = 68;
  const angulo = Math.PI - (valor / 100) * Math.PI;
  const ex = +(cx + r * Math.cos(angulo)).toFixed(2);
  const ey = +(cy - r * Math.sin(angulo)).toFixed(2);
  const color = valor >= 70 ? "#10b981" : valor >= 50 ? "#f59e0b" : "#ef4444";
  const arcFondo = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`;
  const arcValor = valor > 0 ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${ex} ${ey}` : null;

  return (
    <svg viewBox="0 0 200 112" style={{ width: "100%" }}>
      <path d={arcFondo} fill="none" stroke="#1e293b" strokeWidth="13" strokeLinecap="round" />
      {arcValor && (
        <path d={arcValor} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
        fontSize="30" fontWeight="700" fontFamily="monospace">{valor}%</text>
      <text x={cx} y={cy + 15} textAnchor="middle" fill="#64748b"
        fontSize="11" fontFamily="system-ui">OEE</text>
      <text x={cx - r + 4} y={cy + 15} textAnchor="middle" fill="#334155" fontSize="9">0</text>
      <text x={cx + r - 4} y={cy + 15} textAnchor="middle" fill="#334155" fontSize="9">100</text>
    </svg>
  );
}

// ── Tarjeta KPI ────────────────────────────────────────────────────────────
function TarjetaKPI({ etiqueta, valor, unidad = "%", tendencia }) {
  const positivo = tendencia > 0;
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{etiqueta}</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 30, fontFamily: "monospace", fontWeight: 700, color: "#f8fafc" }}>{valor}</span>
        <span style={{ fontSize: 13, color: "#64748b", marginBottom: 3 }}>{unidad}</span>
      </div>
      {tendencia !== undefined && (
        <span style={{ fontSize: 11, color: positivo ? "#34d399" : "#f87171" }}>
          {positivo ? "▲" : "▼"} {Math.abs(tendencia).toFixed(1)}% vs turno anterior
        </span>
      )}
    </div>
  );
}

// ── Tarjeta de Máquina ─────────────────────────────────────────────────────
const CFG_ESTADO = {
  corriendo:  { punto: "#10b981", etiqueta: "Corriendo",   color: "#10b981" },
  en_espera:  { punto: "#f59e0b", etiqueta: "En espera",   color: "#f59e0b" },
  falla:      { punto: "#ef4444", etiqueta: "Falla",        color: "#ef4444" },
  mantenimiento: { punto: "#3b82f6", etiqueta: "Mantenimiento", color: "#3b82f6" },
};

function TarjetaMaquina({ maquina: m }) {
  const s = CFG_ESTADO[m.estado] || CFG_ESTADO.en_espera;
  const pct = Math.min(Math.round((m.piezas / m.meta) * 100), 100);
  const colorBarra = m.estado === "falla" ? "#ef4444" : pct >= 90 ? "#10b981" : "#3b82f6";
  const bordeColor = m.estado === "falla" ? "#7f1d1d" : "#1e293b";

  return (
    <div style={{ background: "#0f172a", border: `1px solid ${bordeColor}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#475569" }}>{m.id}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            backgroundColor: s.punto,
            boxShadow: m.estado === "falla" ? `0 0 6px ${s.punto}` : "none"
          }} />
          <span style={{ fontSize: 11, color: s.color }}>{s.etiqueta}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", marginBottom: 10, lineHeight: 1.3 }}>{m.nombre}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
        <span>Piezas</span>
        <span style={{ fontFamily: "monospace", color: "#cbd5e1" }}>
          {m.piezas.toLocaleString("es-MX")} / {m.meta.toLocaleString("es-MX")}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 9999, background: "#1e293b" }}>
        <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, backgroundColor: colorBarra, transition: "width .7s ease" }} />
      </div>
      {m.estado === "corriendo" && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
          Eficiencia <span style={{ color: "#f1f5f9", fontFamily: "monospace" }}>{m.eficiencia}%</span>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta de Orden ───────────────────────────────────────────────────────
const CFG_ORDEN = {
  en_tiempo: { bg: "#052e16", texto: "#4ade80", etiqueta: "En tiempo"  },
  retrasada:  { bg: "#431407", texto: "#fb923c", etiqueta: "Retrasada"  },
  completa:   { bg: "#172554", texto: "#60a5fa", etiqueta: "Completada" },
  en_riesgo:  { bg: "#450a0a", texto: "#f87171", etiqueta: "En riesgo"  },
};

function TarjetaOrden({ orden: o }) {
  const s = CFG_ORDEN[o.estado];
  const pct = Math.round((o.hecho / o.qty) * 100);
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b" }}>{o.id}</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600, backgroundColor: s.bg, color: s.texto }}>{s.etiqueta}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#f1f5f9", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {o.producto}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 6 }}>
        <span>{o.hecho.toLocaleString("es-MX")} / {o.qty.toLocaleString("es-MX")} pzas</span>
        <span>Ent. {o.hora}</span>
      </div>
      <div style={{ height: 4, borderRadius: 9999, background: "#0f172a" }}>
        <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, backgroundColor: s.texto }} />
      </div>
    </div>
  );
}

// ── Tooltip del gráfico ────────────────────────────────────────────────────
function TooltipGrafico({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: "#94a3b8", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#60a5fa" }}>Real: <strong style={{ color: "#fff" }}>{payload[0]?.value}</strong></div>
      <div style={{ color: "#475569" }}>Plan: <strong style={{ color: "#fff" }}>90</strong></div>
    </div>
  );
}

// ── Dashboard Principal ────────────────────────────────────────────────────
export default function MESDashboard() {
  const [tendencia, setTendencia] = useState(generarTendencia);
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setHora(new Date());
      setTendencia(prev => {
        const ahora = new Date();
        const nuevo = {
          time: `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`,
          real: Math.round(88 + (Math.random() - 0.5) * 26),
          plan: 90,
        };
        return [...prev.slice(1), nuevo];
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const pad = n => String(n).padStart(2, "0");
  const horaStr = `${pad(hora.getHours())}:${pad(hora.getMinutes())}:${pad(hora.getSeconds())}`;
  const fechaStr = hora.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div style={{ background: "#020817", minHeight: "100vh", color: "#f8fafc", padding: 16, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid #1e293b", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: "#f8fafc", margin: 0 }}>Planta Norte — MES Dashboard</h1>
          <p style={{ fontSize: 11, color: "#475569", margin: "3px 0 0" }}>Turno Matutino · 06:00 – 14:00</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, background: "#1a0606", border: "1px solid #7f1d1d" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1.2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fca5a5" }}>2 Alertas activas</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: "#f8fafc" }}>{horaStr}</div>
            <div style={{ fontSize: 11, color: "#475569" }}>{fechaStr}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, background: "#011a0c", border: "1px solid #14532d" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: 11, color: "#6ee7b7" }}>Azure SQL · Conectado</span>
          </div>
        </div>
      </header>

      {/* ── OEE + KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>OEE Global</span>
          <GaugeOEE valor={82} />
          <span style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Meta: 85%</span>
        </div>
        <TarjetaKPI etiqueta="Disponibilidad" valor="92"   tendencia={1.2}  />
        <TarjetaKPI etiqueta="Rendimiento"    valor="88"   tendencia={-0.5} />
        <TarjetaKPI etiqueta="Calidad"        valor="99.1" tendencia={0.3}  />
      </div>

      {/* ── Máquinas ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 11, fontWeight: 500, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Estado de Máquinas
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {MAQUINAS.map(m => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
      </div>

      {/* ── Gráfico + Órdenes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

        {/* Tendencia de producción */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", margin: 0 }}>Producción en Tiempo Real</h2>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#475569" }}>piezas/hora · actualiza cada 5 s</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={tendencia} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#1e293b" tick={{ fontSize: 10, fill: "#475569" }} interval={4} />
              <YAxis stroke="#1e293b" tick={{ fontSize: 10, fill: "#475569" }} domain={[55, 125]} />
              <Tooltip content={TooltipGrafico} />
              <Area type="monotone" dataKey="real" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBlue)" dot={false} />
              <Area type="monotone" dataKey="plan" stroke="#334155" strokeWidth={1.5} strokeDasharray="5 5" fill="none" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "#64748b" }}>
            <span><span style={{ color: "#3b82f6" }}>━</span> Real</span>
            <span><span style={{ color: "#475569" }}>- -</span> Plan</span>
          </div>
        </div>

        {/* Órdenes activas */}
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", margin: "0 0 12px" }}>Órdenes Activas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ORDENES.map(o => <TarjetaOrden key={o.id} orden={o} />)}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ marginTop: 16, textAlign: "center", fontFamily: "monospace", fontSize: 10, color: "#334155" }}>
        API: {API_BASE} · SignalR: Activo · v1.0.0
      </footer>
    </div>
  );
}
