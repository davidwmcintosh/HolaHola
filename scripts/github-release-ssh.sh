#!/usr/bin/env bash

# Shared, ephemeral SSH setup for the GitHub release scripts.
# The private key is never placed in a command argument or printed to output.

GITHUB_REPO_URL="git@github.com:davidwmcintosh/HolaHola.git"

prepare_github_ssh() {
  local raw_key="${1:-}"

  if [[ -z "$raw_key" ]]; then
    echo "ERROR: HOLAHOLA_GITHUB_DEPLOY_KEY secret is not set. Add it in Replit Secrets." >&2
    return 1
  fi

  # Replit may preserve an armored key as one line containing literal \n
  # sequences. Convert those sequences back to line breaks without logging
  # the secret. Also remove CR characters from pasted Windows-formatted keys.
  raw_key="${raw_key//$'\r'/}"
  raw_key="${raw_key//\\n/$'\n'}"
  raw_key="${raw_key//\\r/}"

  # Some secret stores remove the physical line breaks entirely. OpenSSH
  # accepts the base64 payload as one line, as long as the armor boundaries
  # are restored to their own lines.
  if [[ "$raw_key" != *$'\n'* ]]; then
    for key_type in OPENSSH RSA EC DSA ""; do
      raw_key="${raw_key//-----BEGIN ${key_type:+$key_type }PRIVATE KEY-----/-----BEGIN ${key_type:+$key_type }PRIVATE KEY-----$'\n'}"
      raw_key="${raw_key//-----END ${key_type:+$key_type }PRIVATE KEY-----/$'\n'-----END ${key_type:+$key_type }PRIVATE KEY-----}"
    done
  fi

  if [[ "$raw_key" != *"PRIVATE KEY-----"* ]]; then
    echo "ERROR: HOLAHOLA_GITHUB_DEPLOY_KEY does not contain an armored private key." >&2
    return 1
  fi

  # Use a fixed, trusted directory rather than caller-provided TMPDIR because
  # Git evaluates GIT_SSH_COMMAND through a shell.
  GITHUB_SSH_KEY_FILE="$(mktemp /tmp/holahola-github-key.XXXXXX)"
  GITHUB_KNOWN_HOSTS_FILE="$(mktemp /tmp/holahola-github-known-hosts.XXXXXX)"
  chmod 600 "$GITHUB_SSH_KEY_FILE" "$GITHUB_KNOWN_HOSTS_FILE"

  printf '%s\n' "$raw_key" > "$GITHUB_SSH_KEY_FILE"

  # GitHub's published SSH host keys, pinned here so a network attacker cannot
  # redirect ssh-keyscan and receive the repository deploy key.
  cat > "$GITHUB_KNOWN_HOSTS_FILE" <<'EOF'
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=
EOF

  printf -v GIT_SSH_COMMAND 'ssh -i %q -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=%q' "$GITHUB_SSH_KEY_FILE" "$GITHUB_KNOWN_HOSTS_FILE"
  export GIT_SSH_COMMAND
}

cleanup_github_ssh() {
  if [[ -n "${GITHUB_SSH_KEY_FILE:-}" ]]; then
    rm -f -- "$GITHUB_SSH_KEY_FILE"
  fi
  if [[ -n "${GITHUB_KNOWN_HOSTS_FILE:-}" ]]; then
    rm -f -- "$GITHUB_KNOWN_HOSTS_FILE"
  fi
}