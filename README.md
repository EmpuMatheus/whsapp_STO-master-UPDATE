# WHS App - Starter

This zip contains a starter project (backend + frontend) for the WHS app.
- Backend: Node/Express (SQLite). Run `npm install` inside `backend` and `node server.js`.
- Frontend: Vite + React + Tailwind. Run `npm install` inside `frontend` and `npm run dev`.
- Default verifier: username `verifier` / password `password`.

Added endpoints:
- GET /api/whs/export/csv -> export CSV
- GET /api/whs/export/pdf -> export PDF

Note: install dependencies before running. For production, secure JWT secret and use a proper DB.
