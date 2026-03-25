# 🎛 Mission Control

A personal operations dashboard built on Next.js + Neon Postgres, deployed on Netlify. Tracks tasks, ticket flips, agent activity, deal scanning, chat, docs, and more — in one centralized interface.

---

## Prerequisites

- **Node.js** 18+ (Next.js 14 app router)
- **Neon DB** — a serverless Postgres database ([neon.tech](https://neon.tech))
- **Netlify** — hosting + serverless functions

---

## Environment Variables

Create a `.env.local` for local dev, or set these in Netlify's environment settings:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon connection string (`postgresql://user:pass@...neon.tech/neondb`) |
| `NEXT_PUBLIC_INSTANCE` | ✅ | Instance label — `personal` or `biz`. Controls feature visibility. |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables Telegram chat integration |

**Example `.env.local`:**
```env
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
NEXT_PUBLIC_INSTANCE=personal
```

---

## First-Time Setup

### 1. Deploy to Netlify

```bash
# Clone the repo
git clone <repo-url>
cd mission-control

# Install dependencies
npm install

# (Optional) Run locally
npm run dev
```

For production: connect the repo to a Netlify site, or deploy manually:
```bash
npx netlify-cli deploy --prod --site <your-site-id>
```

### 2. Set Environment Variables

In Netlify → Site Settings → Environment Variables, add `DATABASE_URL` and `NEXT_PUBLIC_INSTANCE`.

### 3. Bootstrap the Database

Visit `/setup` on your deployed site:

1. **Verify DB connection** — the status card should show "Connected"
2. **Click "Run Migration"** — creates all 22 `mc_` tables in your Neon DB
3. **Click "Seed Defaults"** — inserts base config rows (team roster, scanner rules, cron config, etc.)
4. All pages will now work correctly

---

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Overview cards — tasks, flips, agents, scanner status |
| Tasks | `/tasks` | Kanban-style task board with priorities |
| Flip Tracker | `/flips` | Ticket inventory — active positions, P&L, listings |
| Deal Scanner | `/scanner` | Automated deal scanner with ROI rules and auto-buy config |
| Factory | `/factory` | Sub-agent registry — spawned agents, status, task summaries |
| Inbox | `/inbox` | Agent-to-agent message inbox |
| Chat | `/chat` | Telegram chat history viewer |
| Projects | `/projects` | Project tracking |
| Docs | `/docs` | Document library (synced from workspace) |
| Memory | `/memory` | Workspace memory file viewer |
| Notes | `/notes` | Persistent scratchpad |
| Requests | `/requests` | Incoming request queue |
| R&D | `/rd` | Research memos and status |
| Team | `/team` | Agent team roster configuration |
| Setup | `/setup` | DB health check, migration, seeding |

---

## Creating a New Instance

To spin up a second instance (e.g. for a business account):

1. **Create a new Neon project** — get a fresh connection string
2. **Create a new Netlify site** — deploy this codebase to it
3. **Set env vars on the new site:**
   ```env
   DATABASE_URL=postgresql://...your-new-neon-db...
   NEXT_PUBLIC_INSTANCE=biz
   ```
4. **Visit `/setup` on the new site** → Run Migration → Seed Defaults
5. Done — fully independent instance with its own database

> **Biz instance note:** When `NEXT_PUBLIC_INSTANCE=biz`, scanner/ticket features are hidden from the UI to keep it clean for business use.

---

## Architecture

```
mission-control/
├── app/
│   ├── (dashboard)/          # All UI pages (layout with sidebar)
│   │   ├── setup/page.tsx    # DB health & migration UI
│   │   ├── flips/            # Flip Tracker
│   │   ├── scanner/          # Deal Scanner
│   │   └── ...
│   └── api/
│       ├── setup/
│       │   ├── route.ts          # GET /api/setup — legacy status
│       │   ├── status/route.ts   # GET /api/setup/status — table health
│       │   ├── migrate/route.ts  # POST /api/setup/migrate — create tables
│       │   └── seed/route.ts     # POST /api/setup/seed — insert defaults
│       ├── tasks/route.ts
│       ├── flips/route.ts
│       └── ...
├── lib/
│   └── db.ts                 # Neon connection helper
└── README.md
```

**Database:** All tables are prefixed `mc_` and live in a single Neon Postgres database. The 22 core tables cover tasks, flips, agents, scanner, chat, docs, memory, and more.

**API pattern:** All routes follow the same pattern — `getDb()` from `lib/db.ts`, tagged template literal queries, `NextResponse.json()`.

**Instances:** The same codebase runs multiple isolated instances. Each points to its own Neon DB via `DATABASE_URL`. `NEXT_PUBLIC_INSTANCE` controls UI feature flags.

---

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint check
```

---

## Database Tables

All 22 `mc_` tables are created by the migration endpoint:

| Table | Purpose |
|---|---|
| `mc_tasks` | Task board items |
| `mc_team` | Agent team config |
| `mc_factory_agents` | Spawned sub-agent registry |
| `mc_live_agents` | Currently active agents |
| `mc_agent_status` | Agent heartbeat status |
| `mc_agent_inbox` | Inter-agent message inbox |
| `mc_flips` | Ticket flip inventory |
| `mc_deal_log` | Scanner deal history |
| `mc_scanner` | Scanner runtime state |
| `mc_scanner_rules` | Scanner ROI/buy rules config |
| `mc_activity` | Activity feed events |
| `mc_chat_messages` | Telegram chat history |
| `mc_cron` | Cron job config |
| `mc_docs` | Document library |
| `mc_heartbeat` | System heartbeat records |
| `mc_memory_files` | Workspace memory files |
| `mc_notes` | Persistent notes |
| `mc_projects` | Project tracking |
| `mc_requests` | Request queue |
| `mc_rd_memos` | R&D memos |
| `mc_rd_status` | R&D status config |
| `mc_email_events` | Email event log |
