#!/usr/bin/env bash
#
# Regression check for the Project launcher handoff after a startup failure.
#
# The first launcher gets the real launcher lock and enters a fake
# `npm run dev`, then waits until this test releases it and exits non-zero.
# A second launcher is started while the first one owns the lock.  It must
# wait, acquire the released lock, and start the fake application exactly once.
#
# The fake application binds the test port, which also lets this check prove
# that the second launcher did not race into an EADDRINUSE failure.

set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/start-application-recovery.XXXXXX")"
FIRST_PID=""
SECOND_PID=""

cleanup() {
  touch "$TMP_DIR/release-first" 2>/dev/null || true
  if [[ -n "$FIRST_PID" ]] && kill -0 "$FIRST_PID" 2>/dev/null; then
    kill "$FIRST_PID" 2>/dev/null || true
  fi
  if [[ -n "$SECOND_PID" ]] && kill -0 "$SECOND_PID" 2>/dev/null; then
    kill "$SECOND_PID" 2>/dev/null || true
  fi
  wait "$FIRST_PID" 2>/dev/null || true
  wait "$SECOND_PID" 2>/dev/null || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

PORT="$(
  node -e '
    const net = require("net");
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      process.stdout.write(String(server.address().port));
      server.close();
    });
  '
)"

FAKE_BIN="$TMP_DIR/bin"
mkdir -p "$FAKE_BIN"

cat >"$FAKE_BIN/git" <<'EOF'
#!/usr/bin/env bash
# Keep the launcher test from changing the repository's local git config.
if [[ "${1:-}" == config ]]; then
  exit 0
fi
exit 1
EOF

cat >"$FAKE_BIN/npx" <<'EOF'
#!/usr/bin/env bash
# The real launcher only needs this command to complete before npm is called.
if [[ "$*" == *restore-rolling-episodes-from-db.ts* ]]; then
  exit 0
fi
echo "unexpected npx invocation: $*" >&2
exit 1
EOF

cat >"$FAKE_BIN/npm" <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != run || "${2:-}" != dev ]]; then
  echo "unexpected npm invocation: $*" >&2
  exit 1
fi

count_file="${START_APPLICATION_TEST_COUNT_FILE:?}"
count="$(cat "$count_file" 2>/dev/null || printf '0')"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
printf 'LAUNCH_%s\n' "$count" >>"${START_APPLICATION_TEST_EVENTS_FILE:?}"

if [[ "$count" -eq 1 ]]; then
  touch "${START_APPLICATION_TEST_FIRST_ENTERED:?}"
  while [[ ! -e "${START_APPLICATION_TEST_RELEASE_FIRST:?}" ]]; do
    sleep 0.05
  done
  printf 'FIRST_STARTUP_EXITED\n' >>"${START_APPLICATION_TEST_EVENTS_FILE:?}"
  exit 1
fi

if [[ "$count" -ne 2 ]]; then
  echo "unexpected duplicate launch number: $count" >&2
  exit 1
fi

exec node -e '
  const net = require("net");
  const fs = require("fs");
  const server = net.createServer((socket) => socket.end());
  server.on("error", (error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
  server.listen(Number(process.env.PORT), "127.0.0.1", () => {
    console.log("APPLICATION_READY");
    fs.writeFileSync(process.env.START_APPLICATION_TEST_APPLICATION_READY, "");
  });
'
EOF

chmod +x "$FAKE_BIN/git" "$FAKE_BIN/npx" "$FAKE_BIN/npm"

LOCK_FILE="$TMP_DIR/start-application.lock"
COUNT_FILE="$TMP_DIR/launch-count"
EVENTS_FILE="$TMP_DIR/events.log"
FIRST_ENTERED="$TMP_DIR/first-entered"
RELEASE_FIRST="$TMP_DIR/release-first"
APPLICATION_READY="$TMP_DIR/application-ready"
FIRST_LOG="$TMP_DIR/first.log"
SECOND_LOG="$TMP_DIR/second.log"

export PORT
export START_APPLICATION_LOCK_FILE="$LOCK_FILE"
export START_APPLICATION_TEST_COUNT_FILE="$COUNT_FILE"
export START_APPLICATION_TEST_EVENTS_FILE="$EVENTS_FILE"
export START_APPLICATION_TEST_FIRST_ENTERED="$FIRST_ENTERED"
export START_APPLICATION_TEST_RELEASE_FIRST="$RELEASE_FIRST"
export START_APPLICATION_TEST_APPLICATION_READY="$APPLICATION_READY"
export PATH="$FAKE_BIN:$PATH"

assert_file_eventually() {
  local file="$1"
  local description="$2"
  local deadline=$((SECONDS + 10))
  while [[ ! -e "$file" && $SECONDS -lt $deadline ]]; do
    sleep 0.05
  done
  if [[ ! -e "$file" ]]; then
    echo "FAIL: timed out waiting for $description" >&2
    echo "--- first launcher ---" >&2
    cat "$FIRST_LOG" 2>/dev/null >&2 || true
    echo "--- second launcher ---" >&2
    cat "$SECOND_LOG" 2>/dev/null >&2 || true
    exit 1
  fi
}

echo "Testing startup recovery on temporary port ${PORT}"

if ! grep -Fq 'runButton = "Project"' .replit; then
  echo 'FAIL: .replit does not use Project as the run button' >&2
  exit 1
fi
if ! grep -Fq 'args = "bash scripts/start-application.sh"' .replit; then
  echo 'FAIL: Project is not wired to scripts/start-application.sh' >&2
  exit 1
fi

PORT="$PORT" START_APPLICATION_LOCK_FILE="$LOCK_FILE" \
  bash scripts/start-application.sh >"$FIRST_LOG" 2>&1 &
FIRST_PID=$!
assert_file_eventually "$FIRST_ENTERED" "the controlled first startup to enter npm run dev"

PORT="$PORT" START_APPLICATION_LOCK_FILE="$LOCK_FILE" \
  bash scripts/start-application.sh >"$SECOND_LOG" 2>&1 &
SECOND_PID=$!

deadline=$((SECONDS + 10))
while ! grep -Fq 'another startup owns' "$SECOND_LOG" 2>/dev/null && [[ $SECONDS -lt $deadline ]]; do
  sleep 0.05
done
if ! grep -Fq 'another startup owns' "$SECOND_LOG"; then
  echo 'FAIL: waiting launcher never observed the startup lock' >&2
  exit 1
fi

touch "$RELEASE_FIRST"
if wait "$FIRST_PID"; then
  echo 'FAIL: controlled first startup unexpectedly succeeded' >&2
  exit 1
fi
FIRST_PID=""

assert_file_eventually "$APPLICATION_READY" "the recovered application to bind"

launch_count="$(cat "$COUNT_FILE" 2>/dev/null || printf '0')"
if [[ "$launch_count" != 2 ]]; then
  echo "FAIL: expected exactly two startup attempts (one failed, one recovered), got ${launch_count}" >&2
  exit 1
fi

launch_lines="$(grep -c '^LAUNCH_' "$EVENTS_FILE" 2>/dev/null || true)"
if [[ "$launch_lines" != 2 ]]; then
  echo "FAIL: expected exactly two launcher invocations, got ${launch_lines}" >&2
  exit 1
fi

if ! grep -Fq 'APPLICATION_READY' "$SECOND_LOG"; then
  echo 'FAIL: recovered launcher did not start the application' >&2
  exit 1
fi
ready_lines="$(grep -h -c '^APPLICATION_READY$' "$FIRST_LOG" "$SECOND_LOG" 2>/dev/null | awk '{total += $1} END {print total + 0}')"
if [[ "$ready_lines" != 1 ]]; then
  echo "FAIL: expected exactly one application bind, got ${ready_lines}" >&2
  exit 1
fi

if grep -Fqi 'EADDRINUSE' "$FIRST_LOG" "$SECOND_LOG"; then
  echo 'FAIL: launcher output contains EADDRINUSE' >&2
  exit 1
fi

echo 'PASS: failed startup released the lock and Project recovered with one application launch'