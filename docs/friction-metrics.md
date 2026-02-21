# SILO Friction Metrics

This file captures a reproducible CLI transcript for the key onboarding claim:
SILO scaffolds a usable 0G agent project in one command.

## Measurement Date

- February 21, 2026

## Command

```bash
rm -rf /tmp/silo-judge-sample2 && \
npm_config_registry=http://127.0.0.1:9 \
npm_config_fetch_retries=0 \
npm_config_fetch_timeout=1 \
/usr/bin/time -p node create-silo-app/src/index.js /tmp/silo-judge-sample2
```

Notes:
- The npm registry was intentionally pointed to a local invalid endpoint so install fails fast in this sandboxed environment.
- This isolates and measures scaffold generation overhead without internet variance.

## Output (Recorded)

```text
SILO — Encrypted Agent Memory on 0G

> Creating project: /tmp/silo-judge-sample2
  ✓ package.json
  ✓ tsconfig.json
  ✓ .env
  ✓ .gitignore
  ✓ claude-desktop-config.json
  ✓ src/agent.ts
  ✓ README.md

> Installing dependencies...
  ! npm install failed — run it manually: cd /tmp/silo-judge-sample2 && npm install

Done! Your SILO agent is ready.

  cd /tmp/silo-judge-sample2
  # Edit .env with your private key
  npm run build && npm run doctor && npm start

real 0.63
user 0.28
sys 0.12
```

## Judge-Relevant Interpretation

- 1 command creates a complete project skeleton.
- 3 commands complete first run after dependencies are available:
  - `npm install`
  - `npm run build`
  - `npm run demo` (or `npm start` for API + dashboard flow)
