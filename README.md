# SyncSpace

SyncSpace is a real-time messaging and collaboration workspace.

## Current implementation branch

The `feature/syncspace-2-auth-foundation` branch connects the web client to the dedicated Supabase project for authentication, persistent conversations, messages and private attachments. The existing Socket.IO service remains in the repository for the legacy public room; the new web client uses Supabase Realtime and Postgres directly.

### Implemented in this branch

- Email/password signup, sign-in, sign-out, email-confirmation redirect handling and password recovery.
- Editable display name, unique username and profile-picture upload.
- Shared Community Lounge for new accounts.
- Private direct conversations, groups, private announcement channels and discoverable public channels with follow/join support.
- Username-based member discovery, group/channel membership and owner-only ownership transfer.
- Persistent messages, replies, sender-only edits/deletes, reactions and read receipts.
- Typing indicators, online presence and profile-level presence privacy controls.
- Private conversation file storage (50 MB per file), multi-file image/video/file albums, membership-checked access and image/video/audio previews.
- Saved Messages browsing, admin-only pinned-message management, personal conversation folders and per-conversation unread counts.
- Message forwarding across conversations, including copying all attachment objects in an album into the destination conversation.
- Full-text search, @username mention inbox, per-conversation unread counts and database-enforced message rate limiting.
- Conversation-history JSON export (attachment metadata only) and device registration with sign-out-other-sessions.
- Browser microphone recording and delivery of voice messages.
- Shareable SyncSpace contact cards for members in the current conversation.
- User-initiated one-time location sharing through a Maps link.
- Group/channel invite links with 7-day expiry, a 50-join cap, revocation and JWT-verified Edge Function redemption.
- Topic labels, single/multiple-choice polls with database-enforced single-choice voting, scheduled text delivery via an active one-minute database job, basic channel analytics for admins and conversation-history export.
- Conversation-level disappearing messages (1 hour, 24 hours, 7 days or 30 days) with automatic database cleanup.
- 24-hour image/video status updates with contact-scoped private media and automatic expiry cleanup.
- Account blocking (direct-message restrictions and hidden blocked-user messages) and report submission.

Some controls are intentionally not presented as finished features yet: QR invite rendering, granular channel permissions, live location sharing and link previews, full report moderation, push notifications, WebRTC calls, bots, full device/session administration, complete backup/restore and end-to-end encryption remain outstanding. Automated and multi-account acceptance testing is also required before production release.

## Database migrations

Schema changes for full-text search, message mentions, direct-message block enforcement, public channel subscriptions, unread counters, message rate limiting, consolidated member-insert policies, secure conversation ownership transfer and contact-card message types are tracked under `supabase/migrations`. Apply migrations in timestamp order to a new Supabase project after the baseline schema has been provisioned.

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

A Vercel preview was successfully deployed from this feature branch. The latest branch source (including multi-file albums and album forwarding) also passed a clean Node 22 production build and TypeScript validation in a Vercel sandbox. New Vercel deployment creation is currently blocked by the team\u2019s 100-deployments-per-day API limit, so the most recent public preview URL does not yet contain the very latest commit. Preview deployments are protected by Vercel SSO and are not public participant links. The production alias is still on the previous guest-chat implementation; production Supabase environment variables are staged, but this branch has not been promoted; do not direct participants to production as though this new authenticated version has been released. Production cutover requires successful multi-account testing and the Auth redirect allowlist above.

## Security notes

- Client access uses only the Supabase publishable key; authorization is enforced by Postgres RLS and Storage policies.
- Private attachment paths include the conversation ID and uploader ID. Downloads use short-lived signed URLs.
- Channel message inserts are restricted to conversation owners/admins at the database policy layer.
- The app does not claim end-to-end encryption. Messages are protected by authenticated access and database/storage authorization, not E2EE.
