# Repository Guidelines

## Project Structure & Module Organization
`backend/` contains the FastAPI app, data pipeline, and ML code. API entrypoints live in `backend/api/`, Polygon integration is in `backend/polygon/`, pipeline stages are in `backend/pipeline/`, and training/inference code is in `backend/ml/`. `frontend/` is a Vite + React + TypeScript client; reusable UI lives in `frontend/src/components/`. `docs/` stores demo assets. Large local artifacts such as `pokieticker.db.gz` and `models.tar.gz` support quick startup and should only be replaced intentionally.

## Build, Test, and Development Commands
Backend setup:
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.api.main:app --reload
```
Frontend setup:
```bash
cd frontend
npm install
npm run dev
npm run build
npm run lint
```
Data refresh commands are manual and hit external services: `python -m backend.bulk_fetch`, `python -m backend.batch_submit --top 50`, `python -m backend.batch_collect <batch_id>`, and `python -m backend.weekly_update`.

## Coding Style & Naming Conventions
Follow the existing style in each side of the repo: Python uses 4-space indentation, snake_case modules, and straightforward function names; TypeScript uses 2-space indentation, PascalCase React components, and camelCase hooks/state. Keep backend modules focused by domain (`routers/`, `pipeline/`, `ml/`). Use the frontend ESLint config in `frontend/eslint.config.js` as the baseline before opening a PR.

## Testing Guidelines
This repository does not currently include a dedicated `tests/` package or frontend test runner. At minimum, contributors should run `npm run lint`, `npm run build`, and start the FastAPI server locally to verify the affected flow. For backend logic changes, add narrow validation scripts or module-level checks where practical, and document manual verification steps in the PR.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects such as `Improve header responsiveness on mobile devices` and `Add compressed database for zero-config quick start`. Keep commits scoped and descriptive. PRs should include: a concise summary, affected areas (`backend/api`, `frontend/src/components`, etc.), setup or migration notes, linked issues if applicable, and screenshots or GIFs for visible UI changes.

## Security & Configuration Tips
Copy `.env.example` to `.env` for local secrets. Never commit API keys, generated databases, or model outputs unless the change explicitly updates the bundled sample artifacts. Treat production-facing routes conservatively; changes to data-fetching or AI-processing endpoints should document cost and security impact.
