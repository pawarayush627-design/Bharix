# Bharix AI

A mobile-first AI chat starter built with Next.js 15, React 19, OpenRouter, and optional Supabase Google sign-in/cloud history.

## Features in this starter
- Lavender-first responsive interface, dark mode, custom SVG logo
- Streaming AI responses through OpenRouter
- Markdown and code formatting, copy response, regenerate, stop generation
- Local chat history, new chats, history search, export Markdown/JSON
- File attachment text extraction for TXT, MD, CSV, JSON; images can be sent to vision-capable OpenRouter models
- Optional OpenRouter web-search plugin
- Browser speech input where supported
- Optional Google sign-in and cloud chat storage via Supabase
- Settings with Creator label and YouTube channel link `@ytinspirevault`
- Shareable links can be created explicitly after Supabase is configured

## 1. Run locally
Install Node.js 20+ and run:
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000. Add `OPENROUTER_API_KEY` to `.env.local`. Never put provider keys in `NEXT_PUBLIC_*` variables.

## 2. OpenRouter
1. Visit https://openrouter.ai/keys and create a key.
2. Add it as `OPENROUTER_API_KEY`.
3. Optional: set `OPENROUTER_MODEL` to a model available to your account. The default is `openai/gpt-4o-mini`.
4. Web search is requested through OpenRouter's web plugin and may incur provider/search costs depending on account and model availability.
5. Vision depends on the selected model supporting image inputs. File size and model limits apply.

## 3. Supabase + Google login
1. Create a project at https://supabase.com/.
2. Open Project Settings > API and copy Project URL and anon/public key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Authentication > Providers, enable Google and follow Supabase's Google OAuth setup to configure Google Cloud client ID/secret.
4. In Authentication > URL Configuration, set Site URL to your deployed URL. Add redirect URLs for `http://localhost:3000/auth/callback` and `https://YOUR-SITE-DOMAIN/auth/callback`.
5. In Supabase SQL Editor, run `supabase/schema.sql`.
6. Restart the app after changing environment variables.
7. Google login and cloud history only appear when Supabase environment variables are set. The browser keeps a local copy as a fallback.

## 4. Netlify deployment
1. Push this project to your GitHub `bharix-v1` branch.
2. In Netlify, create a branch deploy for `bharix-v1` or use a separate preview site. Keep production branch set to `main` until preview works.
3. Add environment variables under Site configuration > Environment variables: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (optional), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`.
4. Trigger a deploy. Verify the build log before merging to `main`.

## Security and limitations
- Never commit `.env.local` or secret keys.
- The client UI is not a replacement for server-side abuse protection. Add provider spend limits and production rate limiting before public launch.
- Browser local history is stored on that device and is not encrypted.
- Supabase chat persistence is enabled for signed-in users. Verify RLS policies before production use.
- The share function is explicitly opt-in. Anyone with the generated link can view a shared conversation; do not share sensitive content.
- Speech recognition depends on browser/device support.
- PDF extraction is not included in this starter. Text, Markdown, CSV, JSON and image attachments are supported.
- This is a complete starter foundation, not a claim of audited or production-tested software. Run `npm install` and `npm run build`, then test sign-in, model access, sharing and deployment in your own environment.
