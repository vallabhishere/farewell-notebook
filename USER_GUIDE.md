# Set up your own Farewell Notebook

This repository is a reusable website starter. Every person should make an independent copy and use their own hosting account, database, admin password, and optional email service.

## Five steps

### 1. Create a private working copy

Use GitHub's **Use this template** button after the public template is published. If you plan to add personal notes, keep your working repository private. A public repository makes every name and message in it readable by everyone.

### 2. Personalize the site

Edit `lib/site-config.ts`: author name, sign-off, introduction, message options, envelope wording, links, and optional project or stock idea sections. Generic personal paragraphs are already included. To address selected people individually, add entries to `lib/greetings.ts` in your private copy; leave that file empty to keep messages generic.

Visitor analytics are enabled by default so the private activity page can show visits and visitor journeys. Forms also save names and submitted replies. Review the privacy copy for your use case, tell visitors what you collect, and set `analyticsEnabled` to `false` in `lib/site-config.ts` if you do not want to collect activity.

### 3. Pick one database

Install dependencies, copy `.env.example` to `.env.local`, and set `DATABASE_PROVIDER` to `d1`, `firebase`, or `supabase`. Follow the matching instructions in the README and the SQL/rules file under `database/`. `local` is for development only. Keep database credentials in `.env.local` locally and as private environment variables on the host.

### 4. Add admin and optional email settings

Set a private `ADMIN_PASSWORD` and a different random `ADMIN_SESSION_SECRET` with at least 32 characters. Add `NOTIFY_EMAIL`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` only if you want an email notification for every suggestion. Verify the sender domain before relying on email delivery.

### 5. Deploy, check, and share

Choose a host that runs Next.js API routes on Node.js. Add the same provider and secret variables in the host settings, deploy, and visit `/admin/login` then `/activity`. Try a test form, confirm that the suggestion appears and email arrives, check the site on mobile, clear test records, and then share the public URL.

## What the site needs

The public pages can be rendered by Next.js, but forms, analytics, email notifications, and the admin dashboard use server API routes. A static-only website host is not enough by itself. Use a Node-capable Next.js host, while keeping the database with whichever supported provider you selected.
