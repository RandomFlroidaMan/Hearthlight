# Deploying Hearthlight

Hearthlight runs a custom Node server (`server.ts`) that hosts a WebSocket
alongside Next.js, and stores its database and generated art/audio as files
on disk (SQLite + a local cache directory). That combination needs a host
that keeps one process running continuously with a persistent disk —
plain serverless platforms (default Vercel, Netlify) won't work here.

**Railway** is the recommended host: it detects a Node app automatically,
runs it as a long-lived process, and supports a persistent volume and a
free custom subdomain out of the box.

## One-time setup

1. **Merge or push this branch to whatever branch you'll deploy from.**
   Railway deploys straight from a GitHub branch.
2. **Create a Railway account** at railway.app (GitHub login is easiest).
3. **New Project → Deploy from GitHub repo** → pick `RandomFlroidaMan/Hearthlight`
   → pick the branch.
4. **Add a volume**: in the service's Settings → Volumes, add a volume and
   mount it at `/app/data`. This is where the SQLite file and every
   generated image/audio file live — without it, everything is wiped on
   every redeploy.
5. **Set environment variables** (service Settings → Variables):
   - `DATABASE_URL` = `file:/app/data/dev.db`
   - `HEARTHLIGHT_DATA_DIR` = `/app/data`
   - `OPENAI_API_KEY` = your real key (needs billing enabled on the OpenAI
     account this key belongs to — sheet import, art, story text, and
     narration all call this key)
   - `HEARTHLIGHT_MONTHLY_CAP_USD` = whatever spend cap you're comfortable
     with (optional, but recommended for a key that's now reachable from
     anywhere)
   - `NODE_ENV` = `production`
6. **Deploy.** Railway runs `npm install` (which also runs `prisma
   generate` via `postinstall`), then `npm run build`, then `npm start` —
   which now runs `prisma migrate deploy` first (via the `prestart` hook)
   to create the database tables on that fresh volume before the server
   starts.
7. Once it's up, Railway gives you a public `*.up.railway.app` URL under
   Settings → Networking → Generate Domain. Open it on your phone — same
   URL works for `/dm` and `/story` on any device, on any network, once
   this exists. A custom domain can be attached from the same screen if
   you own one.

## Updating after this first deploy

Every push to the connected branch triggers a new Railway deploy
automatically. The volume persists across deploys, so campaigns, saved
characters, and cached art/audio all survive.

## Notes / known rough edges

- `better-sqlite3` is a native module. Railway's build environment
  (Nixpacks) normally compiles or fetches the right prebuilt binary for
  Linux automatically, but if the first deploy fails on an install step
  mentioning `better-sqlite3` or `node-gyp`, that's the thing to
  investigate first.
- SQLite here means one server instance, not horizontally scaled — fine
  for a family app, not something to scale to multiple replicas without
  moving to a real database first.
- Nothing about the app code changed for this — the only production-vs-
  local differences are the two environment variables above pointing at
  the mounted volume instead of the local `./data` folder.
