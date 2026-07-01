-- ═════════════════════════════════════════════════════════════════════════════
-- MES — Esquema Azure SQL Database
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Máquinas ─────────────────────────────────────────────────────────────────
CREATE TABLE Maquinas (
  maquina_id  NVARCHAR(20)  NOT NULL PRIMARY KEY,
  nombre      NVARCHAR(100) NOT NULL,
  linea       NVARCHAR(50),
  tipo        NVARCHAR(50),
  activa      BIT           NOT NULL DEFAULT 1,
  creado_en   DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Estado histórico de máquinas (insert-only, no updates) ───────────────────
CREATE TABLE EstadoMaquina (
  id                 INT           IDENTITY(1,1) PRIMARY KEY,
  maquina_id         NVARCHAR(20)  NOT NULL REFERENCES Maquinas(maquina_id),
  estado             NVARCHAR(20)  NOT NULL
                     CHECK (estado IN ('corriendo','en_espera','falla','mantenimiento')),
  eficiencia         DECIMAL(5,2),
  piezas_producidas  INT           NOT NULL DEFAULT 0,
  piezas_meta        INT,
  actualizado_en     DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Métricas OEE por turno ────────────────────────────────────────────────────
CREATE TABLE OEEMetricas (
  id              INT           IDENTITY(1,1) PRIMARY KEY,
  maquina_id      NVARCHAR(20)  NOT NULL REFERENCES Maquinas(maquina_id),
  turno           NVARCHAR(20)  NOT NULL DEFAULT 'matutino',
  disponibilidad  DECIMAL(5,2)  NOT NULL,  -- 0–100
  rendimiento     DECIMAL(5,2)  NOT NULL,  -- 0–100
  calidad         DECIMAL(5,2)  NOT NULL,  -- 0–100
  registrado_en   DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Órdenes de producción ─────────────────────────────────────────────────────
CREATE TABLE OrdenesProduccion (
  orden_id             NVARCHAR(30)  NOT NULL PRIMARY KEY,
  producto             NVARCHAR(200) NOT NULL,
  cantidad_planificada INT           NOT NULL,
  cantidad_producida   INT           NOT NULL DEFAULT 0,
  hora_entrega         TIME,
  estado               NVARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','en_proceso','completa','retrasada','en_riesgo')),
  maquina_id           NVARCHAR(20)  REFERENCES Maquinas(maquina_id),
  creado_en            DATETIME2     NOT NULL DEFAULT GETDATE(),
  completado_en        DATETIME2
);

-- ── Registro de producción (granularidad de 5 min) ───────────────────────────
CREATE TABLE RegistroProduccion (
  id                 INT           IDENTITY(1,1) PRIMARY KEY,
  maquina_id         NVARCHAR(20)  NOT NULL REFERENCES Maquinas(maquina_id),
  piezas_producidas  INT           NOT NULL DEFAULT 0,
  piezas_rechazadas  INT           NOT NULL DEFAULT 0,
  tasa_planificada   INT,          -- piezas/hora esperadas
  registrado_en      DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ── Alertas ───────────────────────────────────────────────────────────────────
CREATE TABLE Alertas (
  alerta_id    INT           IDENTITY(1,1) PRIMARY KEY,
  maquina_id   NVARCHAR(20)  REFERENCES Maquinas(maquina_id),
  tipo         NVARCHAR(50)  NOT NULL,   -- 'falla', 'calidad', 'tiempo', etc.
  descripcion  NVARCHAR(500),
  severidad    NVARCHAR(10)  NOT NULL DEFAULT 'media'
               CHECK (severidad IN ('baja','media','alta','critica')),
  resuelta     BIT           NOT NULL DEFAULT 0,
  creado_en    DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- ═════════════════════════════════════════════════════════════════════════════
-- Índices para rendimiento en consultas frecuentes
-- ═════════════════════════════════════════════════════════════════════════════
CREATE INDEX IX_EstadoMaquina_maquina_fecha  ON EstadoMaquina(maquina_id, actualizado_en DESC);
CREATE INDEX IX_OEEMetricas_turno_fecha      ON OEEMetricas(turno, registrado_en DESC);
CREATE INDEX IX_RegistroProduccion_fecha     ON RegistroProduccion(registrado_en DESC);
CREATE INDEX IX_Alertas_resuelta_fecha       ON Alertas(resuelta, creado_en DESC);

-- ═════════════════════════════════════════════════════════════════════════════
-- Datos de ejemplo
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO Maquinas (maquina_id, nombre, linea, tipo) VALUES
  ('M-01', 'Línea Ensamble A',  'Línea A', 'Ensamble'),
  ('M-02', 'Prensa Hidráulica', 'Línea A', 'Prensa'),
  ('M-03', 'CNC Fresadora',     'Línea B', 'CNC'),
  ('M-04', 'Línea Ensamble B',  'Línea B', 'Ensamble'),
  ('M-05', 'Robot Soldador',    'Línea C', 'Soldadura'),
  ('M-06', 'Insp. Calidad',     'QA',      'Inspección');

INSERT INTO EstadoMaquina (maquina_id, estado, eficiencia, piezas_producidas, piezas_meta) VALUES
  ('M-01', 'corriendo',  92, 1240, 1350),
  ('M-02', 'corriendo',  85,  682,  800),
  ('M-03', 'falla',       0,  240,  500),
  ('M-04', 'corriendo',  78,  918, 1180),
  ('M-05', 'en_espera',   0,  440,  440),
  ('M-06', 'corriendo',  97, 3520, 3660);

INSERT INTO OrdenesProduccion (orden_id, producto, cantidad_planificada, cantidad_producida, hora_entrega, estado, maquina_id) VALUES
  ('ORD-2024-0891', 'Conjunto Motor A12',   500,  324, '16:00', 'en_proceso',  'M-01'),
  ('ORD-2024-0892', 'Carcasa Freno B7',     800,  240, '18:00', 'retrasada',   'M-02'),
  ('ORD-2024-0893', 'Eje Transmisión C3',   200,  200, '12:00', 'completa',    'M-04'),
  ('ORD-2024-0894', 'Pistón Hidráulico D9', 350,   50, '20:00', 'en_riesgo',   'M-01'),
  ('ORD-2024-0895', 'Válvula Control E5',  1200,  980, '14:30', 'en_proceso',  'M-06');
