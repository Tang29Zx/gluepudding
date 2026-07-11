#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASES_DIR="${ROOT_DIR}/releases"
COMMIT_ID="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-${COMMIT_ID}"
STAGING_DIR="${RELEASES_DIR}/.staging-${RELEASE_ID}"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
CURRENT_LINK="${ROOT_DIR}/current"
NEXT_LINK="${ROOT_DIR}/current.next"
PREVIOUS_TARGET=""
PM2_BIN="${PM2_BIN:-/home/ubuntu/.npm-global/bin/pm2}"
DEPLOY_LOCK_FILE="/tmp/gluepudding-deploy-production.lock"

exec 9>"${DEPLOY_LOCK_FILE}"
if ! flock -n 9; then
  echo "Another gluepudding deployment is already running." >&2
  exit 1
fi

wait_for_fortune_ai_health() {
  local attempt

  for attempt in $(seq 1 40); do
    if curl --fail --silent --show-error --max-time 2 \
      http://127.0.0.1:3260/internal/health >/dev/null; then
      return 0
    fi

    sleep 0.5
  done

  return 1
}

wait_for_node_bin() {
  local executable_path="$1"
  local attempt

  for attempt in $(seq 1 40); do
    if [[ -x "${executable_path}" ]]; then
      return 0
    fi

    sleep 0.25
  done

  echo "Missing local executable after npm ci: ${executable_path}" >&2
  return 1
}

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

cleanup() {
  rm -rf "${STAGING_DIR}"
  rm -f "${NEXT_LINK}"
}
trap cleanup EXIT

mkdir -p "${STAGING_DIR}/frontend" "${STAGING_DIR}/fortune-ai-service"

(
  cd "${ROOT_DIR}/app/nav-world"
  npm ci
  wait_for_node_bin "${ROOT_DIR}/app/nav-world/node_modules/.bin/tsc"
  wait_for_node_bin "${ROOT_DIR}/app/nav-world/node_modules/.bin/vite"
  ./node_modules/.bin/tsc --noEmit
  VITE_FORTUNE_AI_API=true \
  VITE_STATIC_ASSET_VERSION="${RELEASE_ID}" \
  ./node_modules/.bin/vite build --emptyOutDir --outDir "${STAGING_DIR}/frontend"
)

(
  cd "${ROOT_DIR}/app/fortune-ai-service"
  npm ci
  npm test
  npm run build
  cp -a dist package.json package-lock.json "${STAGING_DIR}/fortune-ai-service/"
)

(
  cd "${STAGING_DIR}/fortune-ai-service"
  npm ci --omit=dev
)

mv "${STAGING_DIR}" "${RELEASE_DIR}"
trap - EXIT

if [[ -L "${CURRENT_LINK}" ]]; then
  PREVIOUS_TARGET="$(readlink "${CURRENT_LINK}")"
fi

ln -s "releases/${RELEASE_ID}" "${NEXT_LINK}"
mv -Tf "${NEXT_LINK}" "${CURRENT_LINK}"

if ! "${SUDO[@]}" systemctl restart gluepudding-fortune-ai.service || \
   ! wait_for_fortune_ai_health; then
  if [[ -n "${PREVIOUS_TARGET}" ]]; then
    ln -s "${PREVIOUS_TARGET}" "${NEXT_LINK}"
    mv -Tf "${NEXT_LINK}" "${CURRENT_LINK}"
    "${SUDO[@]}" systemctl restart gluepudding-fortune-ai.service || true
  fi
  exit 1
fi

"${SUDO[@]}" nginx -t
"${SUDO[@]}" systemctl reload nginx

if [[ "$(id -u)" -eq 0 ]]; then
  sudo -u ubuntu -H "${PM2_BIN}" delete gluepudding || true
  sudo -u ubuntu -H "${PM2_BIN}" save --force
else
  "${PM2_BIN}" delete gluepudding || true
  "${PM2_BIN}" save --force
fi

mapfile -t OLD_RELEASES < <(
  find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d \
    ! -name '.staging-*' -printf '%T@ %p\n' | sort -rn | tail -n +4 | cut -d' ' -f2-
)
for old_release in "${OLD_RELEASES[@]}"; do
  rm -rf "${old_release}"
done

echo "${RELEASE_ID}"
