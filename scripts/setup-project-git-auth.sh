#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

git config --local user.name "bettercallmanav"
git config --local user.email "bettercallmanav@gmail.com"
git config --local credential.username "bettercallmanav"

# Override any global credential helper for this repo and use GitHub CLI instead.
git config --local --unset-all credential.helper || true
git config --local credential.helper "!gh auth git-credential"

git config --local remote.origin.url "https://github.com/bettercallmanav/repaste.git"

cat <<'EOF'
Configured repo-local git auth for Repaste:
  user.name  = bettercallmanav
  user.email = bettercallmanav@gmail.com
  credential.username = bettercallmanav
  credential.helper   = !gh auth git-credential

This only affects this repository.

Next step:
  1. Make sure 'gh auth status' shows bettercallmanav in this shell.
  2. Run: git push origin main
EOF
