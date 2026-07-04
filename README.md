# C&B Law Radar — Backend

Next.js 15 API layer that scrapes Vietnamese C&B (Compensation & Benefits)
law sources, summarizes/categorizes them with an LLM via OpenRouter, stores
results in MongoDB, and serves the frontend.

## Stack

- Next.js 15 App Router (API routes only, no UI)
- TypeScript strict mode
- MongoDB Atlas + Mongoose
- axios + cheerio (HTML scraping), rss-parser (RSS)
- OpenRouter (OpenAI-compatible REST API, called via axios) with
  `liquid/lfm-2.5-1.2b-instruct:free` — the lightest free instruct model
  available on OpenRouter, used for JSON summarization/categorization
- p-limit for AI call concurrency
- Vercel Cron for scheduling

## Setup

### 1. MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com.
2. Create a database user and allow network access (0.0.0.0/0 for Vercel, or
   use Atlas's Vercel integration for scoped IPs).
3. Copy the connection string — it looks like
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db-name>`.

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
MONGODB_URI=mongodb+srv://user:password@cluster0.mongodb.net/cb_law_radar
OPENROUTER_API_KEY=sk-or-v1-...
CRON_SECRET=<a long random string, e.g. `openssl rand -hex 32`>
```

Get an OpenRouter key at https://openrouter.ai/keys. The model used
(`liquid/lfm-2.5-1.2b-instruct:free`) is free-tier, but free models are
rate-limited per OpenRouter account — if you see 429s under load, either
wait or swap `AI_MODEL` in `lib/ai/client.ts` for a paid/higher-limit model.

### 3. Install & run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
vercel deploy
```

Add the three env vars above in the Vercel project settings (Production +
Preview). `vercel.json` already declares the cron schedule
(`*/30 * * * *` — every 30 minutes) hitting `/api/cron/scrape`.

Vercel Cron sends a **GET** request and automatically attaches
`Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set as an env var,
so no extra configuration is needed. The route also accepts POST with the
same header for manual triggering.

### 5. First manual cron trigger

After deploying and setting env vars, trigger the scrape once manually to
populate the database:

```bash
curl -X POST https://<your-app>.vercel.app/api/cron/scrape \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response shape:

```json
{ "scraped": 42, "new": 17, "errors": [], "cleaned_up": 3 }
```

## API Routes

- `GET /api/documents?category=&sort=newest|effective|impact&search=&limit=&cursor=`
- `GET /api/documents/upcoming` — documents with a future `effective_date`, grouped by year-month
- `GET /api/favorites?user_id=xxx`
- `POST /api/favorites` — `{ user_id, doc_id, note? }` (upsert)
- `DELETE /api/favorites/:doc_id?user_id=xxx`
- `PATCH /api/favorites/:doc_id?user_id=xxx` — `{ note }`
- `POST|GET /api/cron/scrape` — requires `Authorization: Bearer $CRON_SECRET`

## Scraper notes

Selectors were reverse-engineered from the live sites (2026-07-04) and may
drift if the sites redesign:

- **chinhphu.vn**: homepage mixes general news, so items are filtered by
  `CB_KEYWORDS` before fetching detail pages.
- **baohiemxahoi.gov.vn**: SharePoint-based; category is hardcoded to `BHXH`
  regardless of AI classification.
- **thuvienphapluat.vn**: detail pages sit behind a Cloudflare bot challenge
  and often 403 on server-side fetches. The scraper falls back to the listing
  title/metadata as `raw_content` instead of failing the document.
- **luatvietnam.vn**: the "Áp dụng" (effective date) column is locked for
  non-members on the listing page, so `effective_date` is primarily derived
  by the AI summarizer from whatever detail-page text is accessible.
- **vnexpress-rss.ts**: RSS gives titles/links; full body is fetched from
  `.fck_detail` on each article page, with the RSS description as fallback.

All scrapers catch and log their own errors — a single failing source never
aborts the others or crashes the cron job (`Promise.allSettled` in
`lib/scrapers/index.ts`).
