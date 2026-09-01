# Deploying InventDB Legal on Replit and Emergent

Companion to `Replit Prompt.txt` and `Emergent Prompt.txt` in the project root.
Those are what you paste. This is what to know before you do, and what to do when
it goes sideways.

Neither platform is connected to GitHub. Both take the same archive.

---

## The one-paragraph version

InventDB Legal is a **Flask API in front of InventDB, plus a React SPA**. There is
no database, no ORM, no user table and no session store — every record and every
login lives in InventDB's REST API, and the backend forwards the caller's bearer
token rather than holding one. Both agents will try to give you a database anyway.
That is the single biggest risk in this exercise, and it is why the prompts say so
three times in capital letters.

---

## Make the archive first

```powershell
cd "c:\InventDB Legal"
$out = "$([Environment]::GetFolderPath('Desktop'))\inventdb-legal-source.zip"
git archive --format=zip -o $out HEAD -- . ':(exclude)CA_Litigation_Practice_Dataset.xlsx'
```

- **~0.8 MB, 280 files.** With the sample workbook it is 11.2 MB — the app never
  reads it at runtime, so leave it out unless you plan to import it there too.
- `git archive` emits **tracked files only**, so `node_modules`, `.venv`, `dist`,
  `.env` and `e2e/.auth` cannot get in. That is the point of using it rather than
  zipping the folder.
- **It packages `HEAD`, not your working tree.** Run `git status` first. Anything
  uncommitted simply will not be there, and the symptom — a feature that exists on
  your machine and not in the container — wastes a lot of time.

---

## Where the two platforms differ

|  | Replit | Emergent |
|---|---|---|
| Services | **One.** Flask serves `frontend/dist` itself | **Two**, to match the ingress |
| Ports | `${PORT:-5000}`, mapped in `.replit` | API on `8001`, SPA on `3000` |
| Secrets | Replit **Secrets** — no `.env` | `/app/backend/.env` |
| Process manager | Repl run command | supervisor (`backend`, `frontend`) |
| Upload | Files pane → Upload file | VS Code → drag onto `/app` |

Everything else is identical, including all eight load-bearing oddities.

**Do not split Replit into two services.** The Flask app already serves the SPA
when `frontend/dist` exists; a second service and a proxy is work that buys
nothing. `"frontend_bundled": true` in `/api/health` confirms Flask found it.

**Do not merge Emergent into one.** Its ingress expects `/api → 8001` and
everything else → `3000`. On Emergent, `"frontend_bundled": true` is *not* proof
the SPA is being served — Flask still finds `../frontend/dist`, but the page comes
from port 3000. Check 3000 separately.

---

## The three things that will actually break

**1. The agent adds a database.** FastAPI + MongoDB is Emergent's default shape and
it will reach for it unprompted. If you see `MONGO_URL`, `pymongo`, `motor`,
SQLAlchemy or a `users` table, stop and revert — the app has been misread, not
extended. The grep in the "gates" section catches this.

**2. SSE gets killed at 30 seconds.** `/api/analyze/chat/stream` and
`/api/reports/templates/<id>/edit/stream` are long-lived relays that idle for
minutes while the agent reasons. Gunicorn's default sync worker times out at 30s
and cuts them mid-stream, so Analyze looks broken while everything else works.
`--timeout 0 --worker-class gthread --threads 8` is not optional.

**3. Playwright eats the container.** Run it with `--workers=2`. At default
parallelism the container runs out of memory and the suite is killed part-way,
which reads as a test failure and is not one. If Chromium will not launch at all,
it is missing system libraries — ask the agent to install them.

---

## Ports: why the defaults look odd

`backend/app/config.py` defaults `API_PORT` to **8010**, and the Vite dev server to
**5174**. Both are deliberately off the conventional 8000/5173, because a sibling
InventDB app uses those, and on Windows two servers can hold the same port with
neither erroring — requests then get split between them and every module answers
`404 Unknown entity`.

Neither default applies on Replit or Emergent, because gunicorn and vite are both
given their port explicitly. Tell the agent not to "correct" them, and leave
`_refuse_occupied_port` in `backend/app/main.py` alone — it guards the local dev
entrypoint and never runs under gunicorn.

---

## Verifying the build

Same numbers on both platforms:

```
cd backend  && python -m pytest            ->  1176 passed, 6 xfailed
cd frontend && npm run typecheck           ->  0 errors
cd frontend && npm run typecheck:e2e       ->  0 errors
npx playwright test --workers=2            ->  560 passed, 25 spec files
curl -s <api>/api/health                   ->  "ok": true, "namespace": "legal"
grep -rEi 'psycopg|sqlalchemy|sqlite|pymongo|motor|mongo' backend/ frontend/src/
                                           ->  no hits
```

The 6 `xfailed` are deliberate — they are documented known gaps in input
validation, each with the reasoning attached. A run reporting 1182 passed and 0
xfailed means someone "fixed" them without reading why they were marked.

The Playwright suite mocks `/api` at the browser boundary, so it needs neither the
Flask backend nor a live InventDB. The `api` project is the exception: it runs the
real Flask app over HTTP with InventDB stubbed in memory.

---

## Checking for drift

Both prompts have the agent commit a baseline before it configures anything, so
you can see exactly what it touched:

```
git show --stat HEAD
```

Anything under `backend/app/`, `frontend/src/` or `contract/` is **drift, not a
fix** — the application code was correct when you uploaded it. Revert it:

```
git checkout HEAD~1 -- backend/app frontend/src contract
```

Then re-run the gates. A configuration problem dressed up as a code change is the
most common way one of these builds ends up subtly different from the original.

---

## After it runs

- Delete the scaffold the agent generated: `rm -rf _scaffold` (Replit) or
  `rm -rf /app/_scaffold` (Emergent).
- Set `INVENTDB_BASE_URL` and nothing else. `backend/.env.example` documents the
  rest and their defaults; there is no reason to invent new variables.
- The namespace is `legal` and it is pinned server-side. It is created on first
  write, so pointing at a fresh instance gives you an empty app rather than an
  error — every module shows an empty list and the dashboard reads zero.

---

## What these prompts do *not* cover

They deploy the app as it stands at commit `84b0efb`. They are not feature
prompts — there is no "add saved views" or "add the import room" section, because
this app already has all of it. If you later want a change built on one of these
platforms, that wants its own prompt written against the actual diff, not a
generic one.
