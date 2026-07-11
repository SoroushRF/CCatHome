#!/usr/bin/env bash
# README clean-checkout smoke (remediation R7.7.1 / AGENTS §2.5).
# Run from a fresh clone or after `git clean -fdx` (destructive — not default).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci"
npm ci

echo "==> npm run build"
npm run build

echo "==> npm run lint"
npm run lint

echo "==> npm run typecheck"
npm run typecheck

echo "==> npm test"
npm test

echo "==> npm run test:adversarial"
npm run test:adversarial

echo "smoke-readme: ok"
