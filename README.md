# CodeMind AI

CodeMind reviews code with Groq and your team's enabled rules and Agent Memory. When Groq is not configured, the app stays usable with its local pattern checks.

## Run locally

1. Copy `.env.example` to `.env`.
2. Create an API key in [Groq Console](https://console.groq.com/keys) and set `GROQ_API_KEY` in `.env`.
3. Run `npm run dev` and open the URL printed by Vite, usually `http://localhost:5173`.

The Groq and Hindsight credentials are read by the local Express server only. Never add them to frontend code or commit `.env`. The default model is `openai/gpt-oss-120b`; override it with `GROQ_MODEL` if needed. Set `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY` when required by the deployment, and `HINDSIGHT_BANK_ID` to scope persistent review memory.

If no Groq key is configured, the server reports local mode and reviews use the limited deterministic checks. Groq reviews send submitted source code and enabled team rules/memories to the Groq API. When Hindsight is configured, relevant memories are recalled before each Groq review and normalized findings are retained for future reviews. Review results and workspace data are stored locally in the browser.

## Deploy to Vercel

1. Push this project to a Git repository and import it from the Vercel dashboard.
2. Keep the detected Vite framework settings; use `npm run build` as the build command and `dist` as the output directory.
3. In **Project Settings → Environment Variables**, add `GROQ_API_KEY` and optionally `GROQ_MODEL`, `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`, and `HINDSIGHT_BANK_ID` to both Preview and Production environments.
4. Deploy. `vercel.json` preserves client-side routes, while `api/health.ts` and `api/review.ts` run as server-side Vercel Functions.
5. Verify the deployment at `/api/health`; it should report `configured: true` and the selected model.

Do not prefix Groq environment variables with `VITE_`: Vite-prefixed values are exposed to client code. Do not commit `.env`; use Vercel Project Settings for production secrets.

## Checks

- `npm test` runs the local analyzer regression suite.
- `npm run build` type-checks and builds the web app and API server.

## API

- `GET /api/health` reports whether the server has a Groq key configured and which model it will use.
- `POST /api/review` accepts code, language, enabled rules, memories, and review preferences; the server returns a structured review.