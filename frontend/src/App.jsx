import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ── Configuración ──────────────────────────────────────────────────────────
const API_BASE = "https://mes-api.azurewebsites.net/api";

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

// ── Datos de tendencia ─────────────────────────────────────────────────────
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

// ── Máquinas ───────────────────────────────────────────────────────────────
const MAQUINAS = [
  { id: "M-01", nombre: "Llenadora",           estado: "falla",      eficiencia:  0, piezas: 5100, meta: 9000 },
  { id: "M-02", nombre: "Tapadora",             estado: "corriendo",  eficiencia: 87, piezas: 7800, meta: 9000 },
  { id: "M-03", nombre: "Etiquetadora",         estado: "en_espera",  eficiencia:  0, piezas: 7600, meta: 9000 },
  { id: "M-04", nombre: "Codificadora",         estado: "corriendo",  eficiencia: 93, piezas: 7500, meta: 9000 },
  { id: "M-05", nombre: "Empacadora (Embalaje)",estado: "corriendo",  eficiencia: 89, piezas: 1240, meta: 1500 },
  { id: "M-06", nombre: "Shrink (Paletizado)",  estado: "corriendo",  eficiencia: 91, piezas: 1180, meta: 1500 },
];

// ── Órdenes ────────────────────────────────────────────────────────────────
const ORDENES = [
  { id: "ORD-1001", producto: "Bebida Gaseosa Lima 1.5 L",     qty: 5000, hecho: 3800, hora: "14:00", estado: "en_tiempo"  },
  { id: "ORD-1002", producto: "Bebida Gaseosa Toronja 1.75 L", qty: 4200, hecho: 1500, hora: "17:00", estado: "retrasada"  },
  { id: "ORD-1003", producto: "Bebida Gaseosa Cola 2 L",       qty: 6000, hecho: 6000, hora: "10:00", estado: "completa"   },
];

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
      <path
        d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${cx + r} ${sy}`}
        fill="none" stroke={C.border2} strokeWidth="14" strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        />
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
function TarjetaKPI({ etiqueta, valor, unidad = "%", tendencia }) {
  const positivo = tendencia > 0;
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{etiqueta}</span>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 30, fontFamily: "monospace", fontWeight: 700, color: C.gris }}>{valor}</span>
        <span style={{ fontSize: 13, color: C.textMuted, marginBottom: 3 }}>{unidad}</span>
      </div>
      {tendencia !== undefined && (
        <span style={{ fontSize: 11, color: positivo ? C.rojo : "#f87171" }}>
          {positivo ? "▲" : "▼"} {Math.abs(tendencia).toFixed(1)}% vs turno anterior
        </span>
      )}
    </div>
  );
}

// ── Tarjeta de Máquina ─────────────────────────────────────────────────────
const CFG_ESTADO = {
  corriendo:     { punto: "#10b981", etiqueta: "Corriendo",      color: "#10b981" },
  en_espera:     { punto: "#f59e0b", etiqueta: "En espera",      color: "#f59e0b" },
  falla:         { punto: C.rojo,    etiqueta: "Falla",          color: C.rojo    },
  mantenimiento: { punto: "#60a5fa", etiqueta: "Mantenimiento",  color: "#60a5fa" },
};

function TarjetaMaquina({ maquina: m }) {
  const s = CFG_ESTADO[m.estado] || CFG_ESTADO.en_espera;
  const pct = Math.min(Math.round((m.piezas / m.meta) * 100), 100);
  const colorBarra = m.estado === "falla" ? C.rojo : pct >= 90 ? "#10b981" : C.rojo;
  const bordeColor = m.estado === "falla" ? C.rojo : C.border;

  return (
    <div style={{ background: C.bgCard, border: `1px solid ${bordeColor}`, borderRadius: 12, padding: 12,
      boxShadow: m.estado === "falla" ? `0 0 10px ${C.rojo}44` : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: C.textMuted }}>{m.id}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            backgroundColor: s.punto,
            boxShadow: m.estado === "falla" ? `0 0 6px ${s.punto}` : "none"
          }} />
          <span style={{ fontSize: 11, color: s.color }}>{s.etiqueta}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.gris, marginBottom: 10, lineHeight: 1.3 }}>{m.nombre}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
        <span>Botellas</span>
        <span style={{ fontFamily: "monospace", color: C.gris }}>
          {m.piezas.toLocaleString("es-MX")} / {m.meta.toLocaleString("es-MX")}
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
  en_tiempo: { bg: "#0a2240", texto: "#10b981",  etiqueta: "En tiempo"  },
  retrasada: { bg: "#2d0a12", texto: C.rojo,     etiqueta: "Retrasada"  },
  completa:  { bg: "#0a1e3d", texto: "#60a5fa",  etiqueta: "Completada" },
  en_riesgo: { bg: "#2d0a12", texto: "#f87171",  etiqueta: "En riesgo"  },
};

function TarjetaOrden({ orden: o }) {
  const s = CFG_ORDEN[o.estado];
  const pct = Math.round((o.hecho / o.qty) * 100);
  return (
    <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textMuted }}>{o.id}</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 600, backgroundColor: s.bg, color: s.texto }}>{s.etiqueta}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.gris, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {o.producto}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted, marginBottom: 6 }}>
        <span>{o.hecho.toLocaleString("es-MX")} / {o.qty.toLocaleString("es-MX")} botellas</span>
        <span>Ent. {o.hora}</span>
      </div>
      <div style={{ height: 4, borderRadius: 9999, background: C.bgMain }}>
        <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, backgroundColor: s.texto }} />
      </div>
    </div>
  );
}

// ── Tooltip del gráfico ────────────────────────────────────────────────────
function TooltipGrafico({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bgCard2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ color: C.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ color: C.rojo }}>Real: <strong style={{ color: C.gris }}>{payload[0]?.value}</strong></div>
      <div style={{ color: C.textMuted }}>Plan: <strong style={{ color: C.gris }}>90</strong></div>
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
    <div style={{ background: C.bgMain, minHeight: "100vh", color: C.gris, padding: 16, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 16, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Franja de color de marca */}
          <div style={{ width: 4, height: 36, borderRadius: 2, background: C.rojo }} />
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: C.gris, margin: 0 }}>
              Planta Norte — MES Dashboard
            </h1>
            <p style={{ fontSize: 11, color: C.textMuted, margin: "3px 0 0" }}>
              Línea de Bebidas Gaseosas · Turno Matutino 06:00 – 14:00
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px",
            borderRadius: 8, background: "#2d0a12", border: `1px solid ${C.rojo}` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.rojo }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.rojo }}>1 Alerta activa</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "monospace", fontSize: 14, color: C.gris }}>{horaStr}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{fechaStr}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px",
            borderRadius: 8, background: "#051a30", border: `1px solid ${C.azul}` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: 11, color: C.textSub }}>Azure SQL · Conectado</span>
          </div>
        </div>
      </header>

      {/* ── OEE + KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16,
          display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            OEE Global
          </span>
          <GaugeOEE valor={82} />
          <span style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Meta: 85%</span>
        </div>
        <TarjetaKPI etiqueta="Disponibilidad" valor="92"   tendencia={1.2}  />
        <TarjetaKPI etiqueta="Rendimiento"    valor="88"   tendencia={-0.5} />
        <TarjetaKPI etiqueta="Calidad"        valor="99.1" tendencia={0.3}  />
      </div>

      {/* ── Máquinas ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: "uppercase",
          letterSpacing: "0.08em", marginBottom: 12 }}>
          Estado de Línea de Producción
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          {MAQUINAS.map(m => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
      </div>

      {/* ── Gráfico + Órdenes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

        {/* Tendencia */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: C.gris, margin: 0 }}>
              Producción en Tiempo Real
            </h2>
            <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textMuted }}>
              botellas/hora · actualiza cada 5 s
            </span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={tendencia} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="gradRojo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.rojo} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={C.rojo} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="time" stroke={C.border} tick={{ fontSize: 10, fill: C.textMuted }} interval={4} />
              <YAxis stroke={C.border} tick={{ fontSize: 10, fill: C.textMuted }} domain={[55, 125]} />
              <Tooltip content={TooltipGrafico} />
              <Area type="monotone" dataKey="real" stroke={C.rojo} strokeWidth={2} fill="url(#gradRojo)" dot={false} />
              <Area type="monotone" dataKey="plan" stroke={C.azul} strokeWidth={1.5} strokeDasharray="5 5" fill="none" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: C.textMuted }}>
            <span><span style={{ color: C.rojo }}>━</span> Real</span>
            <span><span style={{ color: C.azul }}>- -</span> Plan</span>
          </div>
        </div>

        {/* Órdenes */}
        <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: C.gris, margin: "0 0 12px" }}>
            Órdenes Activas
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ORDENES.map(o => <TarjetaOrden key={o.id} orden={o} />)}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer style={{ marginTop: 16, textAlign: "center", fontFamily: "monospace",
        fontSize: 10, color: C.border2 }}>
        API: {API_BASE} · v1.0.0
      </footer>
    </div>
  );
}
