# Carpool & Commute Optimizer (CarShary)

## Quickstart (no env required)

1. Install dependencies (installs root + backend + frontend):
   - `npm install`
2. Run both apps:
   - `npm run dev`
3. (Optional) Production-style demo:
   - `npm run build`
   - `npm start` (backend serves `frontend/dist`)

### URLs

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5001/api/health` (falls back to next port if taken)

### Notes

- Backend uses an in-process memory store and persists to `backend/storage/data.json`.
- In dev, the frontend proxies `/api` + `/socket.io` to the backend (so the browser still calls `http://localhost:5173/api/...`).
- Maps UI uses OpenStreetMap tiles + Nominatim (search) + OSRM demo router (route + distance). Light demo usage only.
- Map clustering uses `leaflet.markercluster` (no React peer dependency issues with React 19).
- Default admin (demo): email `admin@carshary.local`, password `admin123`, route `http://localhost:5173/admin`.
- Admin has a “Generate 10 rides around me” demo button to seed rides for the map.
- Notifications center: `http://localhost:5173/notifications` (also accessible from the bell icon).

## AI (optional)

This repo includes demo AI features (works without any API key using heuristics).

If you want real LLM text generation, set:
- `OPENAI_API_KEY`
- Optional: `OPENAI_MODEL` (default: `gpt-4.1-mini`)

AI-powered demo UX:
- Match explanation (“Why recommended”) in the match results drawer
- Polite ride request message generator in join confirmation
- Chat quick-reply suggestions
- Eco coach tips in Eco Stats
- Admin safety insights summary (reports)
