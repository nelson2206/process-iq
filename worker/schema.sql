-- Repositorio central de procesos de ProcessIQ (Cloudflare D1, base "processiq-procesos").
-- Aplicar:  npx wrangler d1 execute processiq-procesos --remote --file=schema.sql
-- Idempotente: se puede volver a ejecutar sin perder datos.

-- Un registro por proceso, con su ULTIMA version. Las columnas sueltas
-- (industria, conteos...) existen para filtrar y analizar sin abrir el JSON;
-- el proceso completo (nodos, flujos, subprocesos, ficha) va en "datos".
CREATE TABLE IF NOT EXISTS procesos (
  id            TEXT PRIMARY KEY,          -- UUID
  nombre        TEXT NOT NULL,
  industria     TEXT,
  macroproceso  TEXT,
  cliente       TEXT,
  autor         TEXT,                      -- quien guardo la ultima version (nombre escrito por el usuario)
  version       INTEGER NOT NULL DEFAULT 1,
  nodos         INTEGER, actividades INTEGER, decisiones INTEGER, carriles INTEGER, subprocesos INTEGER,
  datos         TEXT NOT NULL,             -- JSON del proceso completo
  creado        TEXT NOT NULL,             -- ISO 8601 UTC
  actualizado   TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0 -- borrado logico: se oculta, no se pierde
);
CREATE INDEX IF NOT EXISTS idx_procesos_act ON procesos (borrado, actualizado DESC);
CREATE INDEX IF NOT EXISTS idx_procesos_ind ON procesos (industria, macroproceso);

-- Historial: cada guardado deja una copia (permite volver atras y, a futuro,
-- usar la evolucion de los procesos como material para otras herramientas).
CREATE TABLE IF NOT EXISTS versiones (
  proceso_id TEXT NOT NULL,
  version    INTEGER NOT NULL,
  autor      TEXT,
  fecha      TEXT NOT NULL,
  datos      TEXT NOT NULL,
  PRIMARY KEY (proceso_id, version)
);
