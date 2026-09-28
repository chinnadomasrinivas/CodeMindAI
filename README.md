# CodeMind AI

CodeMind reviews code with Gemini and your team's enabled rules and Agent Memory. When Gemini is not configured, the app stays usable with its local pattern checks.

## Run locally

1. Copy `.env.example` to `.env`.
2. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in `.env`.
3. Run `npm run dev` and open the URL printed by Vite, usually `http://localhost:5173`.

The Gemini key is read by the local Express server only. Never add it to frontend code or commit `.env`. The default model is `gemini-3.8-flash`; on a temporary HTTP 503, the server retries once with `gemini-flash-latest`. Override either with `GEMINI_MODEL` or `GEMINI_FALLBACK_MODEL` if needed.

If no key is configured, the server reports local mode and reviews use the limited deterministic checks. Gemini reviews send submitted source code and enabled team rules/memories to Google's Gemini API. Review results and workspace data are stored locally in the browser.

## Deploy to Vercel

1. Push this project to a Git repository and import it from the Vercel dashboard.
2. Keep the detected Vite framework settings; use `npm run build` as the build command and `dist` as the output directory.
3. In **Project Settings → Environment Variables**, add `GEMINI_API_KEY`. Optionally add `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL`. Add them to both Preview and Production environments.
4. Deploy. `vercel.json` preserves client-side routes, while `api/health.ts` and `api/review.ts` run as server-side Vercel Functions.
5. Verify the deployment at `/api/health`; it should report `configured: true` and the selected model.

Do not prefix Gemini environment variables with `VITE_`: Vite-prefixed values are exposed to client code. Do not commit `.env`; use Vercel Project Settings for production secrets.

## Checks

- `npm test` runs the local analyzer regression suite.
- `npm run build` type-checks and builds the web app and API server.

## API

- `GET /api/health` reports whether the server has a Gemini key configured and which model it will use.
- `POST /api/review` accepts code, language, enabled rules, memories, and review preferences; the server returns a structured review.