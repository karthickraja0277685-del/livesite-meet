# LiveSite Meet — Full-Stack MVP

## 4. README: Setup, Environment Variables, Docker, Testing & Security Checklist

### Required Accounts & Domain Setup

1. **Supabase Account ([Supabase Docs](https://supabase.com/docs)):**
   - Create a new Supabase project.
   - Enable **Email/Password** and **Google OAuth** under **Authentication → Providers** ([Supabase Auth Guide](https://supabase.com/docs/guides/auth)).
   - Copy your database connection strings (`DATABASE_URL` and `DIRECT_URL`), project URL (`NEXT_PUBLIC_SUPABASE_URL`), public anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), and server-only `SUPABASE_SERVICE_ROLE_KEY`.
   - After pushing the Prisma schema, paste and run `prisma/rls_policies.sql` in the **Supabase SQL Editor** to enable Row Level Security on every table and create the private `meeting-sites` storage bucket.
2. **LiveKit Account ([LiveKit Cloud](https://docs.livekit.io/intro/overview/)):**
   - Create a free LiveKit Cloud project and copy `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`.
3. **Vercel Account & Wildcard Domain ([Vercel Wildcard Domains](https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains)):**
   - Deploy the repository to Vercel.
   - Attach your main app domain (e.g., `app.example.com`) and a **separate** wildcard domain for isolated attendee sessions (e.g., `*.sites.example.com`) so presented websites never share a parent cookie scope with the main app.
   - In local development, `*.sites.localhost:3000` works automatically in modern Chromium, Firefox, and macOS/Linux resolvers without purchasing a domain.

### Environment Variables (`.env`)

Create a `.env` file in the project root with the following variables:

```ini
# PostgreSQL connection strings from Supabase (Settings -> Database)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.supabase.co:5432/postgres"

# Public App & Wildcard Subdomain Hostnames
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SITES_BASE_DOMAIN="sites.localhost:3000"

# Supabase Auth & Private Storage Keys
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-public-anon-key"
# SECURITY: Never prefix SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY="your-private-service-role-key"

# LiveKit WebRTC Credentials
NEXT_PUBLIC_LIVEKIT_URL="wss://your-project.livekit.cloud"
LIVEKIT_API_KEY="your-livekit-api-key"
LIVEKIT_API_SECRET="your-livekit-api-secret"

# Keep "false" in production; set to "true" only when running automated Playwright tests
ALLOW_E2E_TEST_AUTH="false"
```

### How the Docker Setup Works (In Simple Words)

- **`Dockerfile`:** Starts from an official lightweight Node.js 20 Linux image (`node:20-alpine`), installs `openssl` so Prisma can communicate with PostgreSQL, installs npm packages, generates the typed Prisma client, and runs `npx prisma db push && npm run dev`.
- **`docker-compose.yml`:** Starts two local containers with a single command:
  1. `db`: A local PostgreSQL 15 database listening on port `5432` with a persistent volume (`pgdata`) and an automatic health check.
  2. `app`: Your Next.js application on port `3000`, which waits until `db` reports healthy before syncing the database schema and starting the server. Docker is used strictly for local app development—uploaded static sites are served via the wildcard proxy route, never inside Docker containers.

### Exact Commands to Install, Run, and Test

#### Option A: Run With Docker (Simplest Local Setup)

```bash
docker compose up --build
```

Open `http://localhost:3000` in your browser.

#### Option B: Run Without Docker (Node.js 20+ Installed Locally)

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma TypeScript client and push schema to PostgreSQL
npx prisma generate
npx prisma db push

# 3. Apply Row Level Security (RLS) policies in Supabase SQL Editor:
#    Paste the contents of prisma/rls_policies.sql into Supabase SQL Editor and click Run.

# 4. Start the Next.js development server
npm run dev
```

#### Running the Automated Playwright End-to-End Tests

Playwright ([Playwright Docs](https://playwright.dev/docs/intro)) runs all 3 required security and multi-browser isolation tests automatically:

```bash
# 1. Install the Chromium browser binary for Playwright (first time only)
npx playwright install chromium

# 2. Run the E2E test suite
npm run test:e2e
```

### 3-Browser Manual Test Checklist

Use this step-by-step checklist to verify session isolation manually across 3 browser windows:

1. **Create a Test ZIP:** Create a folder containing an `index.html` file with an `<input placeholder="Your name" />` and a button that saves to `localStorage.setItem("demo", value)` and displays `localStorage.getItem("demo")`. Compress it into `demo-site.zip`.
2. **Browser 1 (Host — Chrome Regular Window):**
   - Go to `http://localhost:3000/login`, sign up or log in, and create a meeting on `/dashboard`.
   - Copy the meeting link (`http://localhost:3000/meet/{meetingId}`), open the meeting room, join as `"Host"`, and upload `demo-site.zip`.
   - Confirm the upload status message shows the file count and size, and the site loads inside the main area.
3. **Browser 2 (Attendee 1 — Chrome Incognito Window):**
   - Open the join link, enter `"Attendee 1"`, and click **Join Meeting**.
   - Check the badge at the top of the workspace: note the unique origin (`s-xxxxxx`).
   - Inside the presented website, type `"Alice's Private Data"` into the input field and click Save to store it in `localStorage`.
4. **Browser 3 (Attendee 2 — Firefox or Second Incognito Profile):**
   - Open the same join link, enter `"Attendee 2"`, and click **Join Meeting**.
   - Confirm the badge displays a **different** isolated origin (`s-yyyyyy`).
   - Verify the input box inside the presented website is completely blank and `localStorage.getItem("demo")` is `null`.
5. **End Meeting Cleanup:**
   - In Browser 1 (Host), click **End Meeting**.
   - Verify all 3 browsers immediately transition to the `"Meeting Ended"` screen and the uploaded files in the `meeting-sites` bucket are deleted.

### Security Checklist (Database Tables, Storage & Access Matrix)

| Resource / Table | RLS Enabled | Anon / Guest Access | Authenticated Attendee Access | Authenticated Host Access | Server API (`service_role`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.users` | Yes | None | Read/Update **only own** user row (`auth.uid() = id`) | Read/Update **only own** user row (`auth.uid() = id`) | Full access (server-only) |
| `public.meetings` | Yes | Read **only** the meeting matching their `x-session-id` join row | Read **only** meetings where they have a session row (`attendee_sessions`) | Full CRUD (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on **own** meetings (`auth.uid() = host_id`) | Full access (server-only) |
| `public.site_uploads` | Yes | None | None (files are streamed via session subdomain proxy) | Full CRUD on uploads where `auth.uid() = host_id` | Full access for ZIP extraction & 24h auto-delete |
| `public.attendee_sessions` | Yes | Read **only** own session row via `x-session-id` | Read **only** own session row (`user_id = auth.uid()`) | Read sessions belonging to their own hosted meetings | Creates isolated session subdomains on join |
| `public.waitlist` | Yes | `INSERT` only (email length 5–254). **Zero `SELECT` access** (cannot scrape emails) | `INSERT` only. **Zero `SELECT` access** | `INSERT` only. **Zero `SELECT` access** | Inserts validated, rate-limited waitlist emails |
| `storage.objects` (`meeting-sites`) | Yes (`public: false`) | None (bucket is strictly private) | None | Read/Write/Delete **only** under `{auth.uid()}/*` folder prefix | Uploads validated ZIP assets & deletes on meeting end |

### Demo mode (local only)

To test the Host Dashboard and Meeting Room locally without configuring a Supabase project, set both flags to `"true"` in `.env`:

- `ALLOW_DEMO_LOGIN="true"` — Enables `POST /api/demo-login` and `DELETE /api/demo-login` on the server (automatically returns `404` when `NODE_ENV === "production"` or when the flag is not `"true"`).
- `NEXT_PUBLIC_DEMO_MODE="true"` — Shows the **Continue as Demo Host (local only)** button on `/login` and routes Log Out on `/dashboard` through `DELETE /api/demo-login`.

**Important:** Both `ALLOW_DEMO_LOGIN` and `NEXT_PUBLIC_DEMO_MODE` **must be `"false"` in production**.
