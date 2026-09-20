#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
PROJECT_ROOT="${PROJECT_ROOT:-/root/inegi-perfilador}"
WORK_DIR="${INEGI_WORK_DIR:-/var/lib/ceipol/inegi/aguascalientes-2020}"
MIN_FREE_KB="${INEGI_MIN_FREE_KB:-5242880}"
GEOGRAPHY_ZIP="${WORK_DIR}/01_aguascalientes.zip"
CENSUS_ZIP="${WORK_DIR}/ageb_mza_urbana_01_cpv2020_csv.zip"
GEOGRAPHY_SHA256="744058229ebe6990140471605633926611b709476c85ba378892a55be0d169b7"
CENSUS_SHA256="cac8849a7f672b3aa8d2722f8bef078ab9984588c02a498c2a776461918d12e9"

usage() {
  printf '%s\n' \
    "Uso: $0 preflight|import" \
    "" \
    "Variables opcionales:" \
    "  PROJECT_ROOT     Raiz administrativa (default: /root/inegi-perfilador)" \
    "  INEGI_WORK_DIR   Directorio de artefactos (default: /var/lib/ceipol/inegi/aguascalientes-2020)" \
    "  DATABASE_URL     Conexion administrativa; por defecto usa postgres local sin password." \
    "" \
    "El script no ejecuta cambios de infraestructura, migraciones, rollback ni despliegues."
}

if [[ "${MODE}" != "preflight" && "${MODE}" != "import" ]]; then
  usage
  exit 2
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  printf '%s\n' "NOT_CONFIGURED: este runner administrativo requiere Linux." >&2
  exit 1
fi

for tool in node npm ogr2ogr ogrinfo unzip df; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    printf '%s\n' "NOT_CONFIGURED: ${tool} no esta disponible en PATH." >&2
    exit 1
  fi
done

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 18 )); then
  printf '%s\n' "NOT_CONFIGURED: se requiere Node.js 18 o superior." >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
node -e 'require.resolve("pg"); require.resolve("csv-parse")' >/dev/null

mkdir -p "${WORK_DIR}"
chmod 700 "${WORK_DIR}"
AVAILABLE_KB="$(df -Pk "${WORK_DIR}" | awk 'NR==2 {print $4}')"
if [[ ! "${AVAILABLE_KB}" =~ ^[0-9]+$ ]] || (( AVAILABLE_KB < MIN_FREE_KB )); then
  printf '%s\n' "NOT_CONFIGURED: espacio libre insuficiente en el work-dir; se requieren al menos ${MIN_FREE_KB} KiB." >&2
  exit 1
fi

unset PGPASSWORD
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres@127.0.0.1:5432/ceipol_perfilador}"

COMMON_ARGS=(
  --work-dir "${WORK_DIR}"
  --expected-geography-sha256 "${GEOGRAPHY_SHA256}"
  --expected-census-sha256 "${CENSUS_SHA256}"
)

if [[ "${MODE}" == "preflight" ]]; then
  node scripts/inegi/import-aguascalientes-2020.mjs \
    --preflight-only \
    --download \
    "${COMMON_ARGS[@]}"
  printf '%s\n' "Preflight concluido sin escrituras PostgreSQL. Revise PREFLIGHT_OK antes de importar."
  exit 0
fi

if [[ ! -f "${GEOGRAPHY_ZIP}" || ! -f "${CENSUS_ZIP}" ]]; then
  printf '%s\n' "NOT_CONFIGURED: faltan ZIP validados; ejecute primero el modo preflight." >&2
  exit 1
fi

node scripts/inegi/import-aguascalientes-2020.mjs \
  --geography-zip "${GEOGRAPHY_ZIP}" \
  --census-zip "${CENSUS_ZIP}" \
  "${COMMON_ARGS[@]}"

printf '%s\n' "Importacion administrativa finalizada; el JSON READY anterior contiene hashes y conteos comprometidos."
