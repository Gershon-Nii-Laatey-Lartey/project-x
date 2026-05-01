# Telegram Connector

Self-contained Telegram integration running entirely in Supabase. Uses the **Telegram User API (MTProto)** via GramJS to read channels you're subscribed to — no bot required.

## Architecture

```
Supabase Edge Functions:
├── telegram-auth     → Phone verification flow (one-time setup)
├── telegram-poll     → Fetches new messages from tracked channels (every 60s)
├── telegram-manage   → Add/remove/toggle channels
└── telegram-save     → Save Telegram images to subject folders (papers table)

Supabase Database:
├── telegram_sessions  → Stores MTProto StringSession
├── telegram_channels  → Tracked channels list
└── telegram_messages  → Fetched messages + media

Supabase Storage:
└── papers bucket      → telegram/{channel}/ for media, {subject}/ for saved papers
```

## Setup

### 1. Get Telegram API Credentials

1. Go to [my.telegram.org](https://my.telegram.org)
2. Log in with your phone number
3. Go to "API development tools"
4. Create a new application
5. Copy your **API ID** and **API Hash**

### 2. Set Supabase Secrets

```bash
supabase secrets set TELEGRAM_API_ID=your_api_id
supabase secrets set TELEGRAM_API_HASH=your_api_hash
```

### 3. Run the Database Migration

```bash
supabase db push
```

### 4. Deploy Edge Functions

```bash
supabase functions deploy telegram-auth
supabase functions deploy telegram-poll
supabase functions deploy telegram-manage
supabase functions deploy telegram-save
```

### 5. Authenticate in the App

1. Open the Casio Web App
2. Click the Telegram icon in the header
3. Enter your phone number → receive code on Telegram → enter code
4. Done! Your session is stored securely.

### 6. Set Up Polling (Optional)

To auto-poll every 60 seconds, create a pg_cron job:

```sql
SELECT cron.schedule(
  'telegram-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/telegram-poll',
    headers := '{"Authorization": "Bearer your-anon-key"}'::jsonb
  );
  $$
);
```

Or trigger manually by calling the function URL.

## Environment Variables

| Variable | Description | Where |
|----------|-------------|-------|
| `TELEGRAM_API_ID` | From my.telegram.org | Supabase Secrets |
| `TELEGRAM_API_HASH` | From my.telegram.org | Supabase Secrets |
| `SUPABASE_URL` | Auto-injected by Supabase | Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase | Edge Functions |

## API Reference

### telegram-auth
- `GET /` — Check auth status
- `POST / { action: "send-code", phone: "+1..." }` — Send verification code
- `POST / { action: "verify-code", phone, code, phone_code_hash }` — Complete sign-in

### telegram-manage
- `GET /` — List all channels
- `POST / { action: "add", username: "@channel" }` — Add a channel
- `POST / { action: "remove", channel_id: "uuid" }` — Remove a channel
- `POST / { action: "toggle", channel_id: "uuid", is_active: bool }` — Toggle channel

### telegram-poll
- `GET /` or `POST /` — Trigger a poll of all active channels

### telegram-save
- `POST / { message_id: "uuid", subject: "Physics" }` — Save media to subject folder
