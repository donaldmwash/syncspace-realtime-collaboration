# SyncSpace

SyncSpace is a real-time messaging and collaboration workspace.

## Current implementation branch

The `feature/syncspace-2-auth-foundation` branch connects the web client to the dedicated Supabase project for authentication, persistent conversations, messages and private attachments. The existing Socket.IO service remains in the repository for the legacy public room; the new web client uses Supabase Realtime and Postgres directly.

### Implemented in this branch

- Email/password signup, sign-in, sign-out, email-confirmation redirect handling and password recovery.
- Editable display name, unique username and profile-picture upload.
- Shared Community Lounge for new accounts.
- Private direct conversations, groups and announcement channels.
- Username-based member discovery and group/channel membership.
- Persistent messages, replies, sender-only edits/deletes, reactions and read receipts.
- Typing indicators and online presence.
- Private conversation file storage (50 MB per file), with membership-checked access and image/video/audio previews.
- Saved-message insertion and admin-only message pinning.

Some controls are intentionally not presented as finished features yet: invite-link management, Saved Messages browsing, pinned-message management, polls, scheduled sending, topics, status stories, voice-note recording, calls, bots, moderation dashboards, device management, export/backup and end-to-end encryption remain outstanding.

## Local setup

Use Node.js 22 or newer.

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   These are public client values. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or commit it to Git.

3. In Supabase Authentication URL Configuration:
   - Set the Site URL to the public app URL you intend to use.
   - Add `http://localhost:3000/**` for local testing.
   - Add the relevant Vercel preview URLs (a wildcard such as `https://*.vercel.app/**` is useful for branch previews).

4. Run the web client:

   ```bash
   npm run dev
   ```

The realtime database, RLS policies, private conversation-files bucket and public avatars bucket must be present in the connected Supabase project. The current SyncSpace Supabase project is in the London region.

## Deployment status

The new web client is deployed to a Vercel preview from this feature branch for build validation. The production alias is still on the previous guest-chat implementation; do not direct participants to production as though this new authenticated version has been released. Production cutover requires successful multi-account testing and the Auth redirect allowlist above.

## Security notes

- Client access uses only the Supabase publishable key; authorization is enforced by Postgres RLS and Storage policies.
- Private attachment paths include the conversation ID and uploader ID. Downloads use short-lived signed URLs.
- Channel message inserts are restricted to conversation owners/admins at the database policy layer.
- The app does not claim end-to-end encryption. Messages are protected by authenticated access and database/storage authorization, not E2EE.
