# SyncSpace 2.0 implementation tracker

This tracker distinguishes database groundwork from user-facing, tested functionality. A database table does not mean its feature is implemented in the app.

## Current production baseline

- [x] Existing Socket.IO public room remains available in the realtime service for the legacy frontend.
- [x] Dedicated Supabase project created in the existing organisation (London region).
- [x] Relational schema and RLS groundwork for profiles, conversations, members, messages, attachments, reactions, receipts and the extended feature set.
- [x] No exposed application tables are missing RLS policies.\n- [ ] Move the non-relocatable `pg_net` extension out of the `public` schema if the managed extension installation supports it; the security advisor currently reports this one extension-placement warning.
- [x] Authenticated Supabase-backed web workspace is implemented on `feature/syncspace-2-auth-foundation`.
- [ ] The new authenticated workspace has not been promoted to the production alias.
- [ ] Existing in-memory guest-room messages/files have not been migrated; they are not available to the new authenticated workspace.

## Phase 1 — Identity, persistence and access control

- [x] Email/password signup, sign-in, sign-out and session persistence.
- [x] Email-confirmation redirect and password-reset request/recovery UI.
- [x] Profile editing, unique usernames and profile-picture upload.
- [x] Persist messages, replies, sender edits/deletes and read receipts in Postgres.
- [x] Private Storage bucket for conversation attachments with membership-checked reads and uploader-scoped writes.
- [x] Database trigger creates a profile and adds each new account to the shared Community Lounge.
- [~] Realtime delivery uses Supabase Realtime with authenticated client sessions. The old Socket.IO service still has its original guest identity path and is not used by the new web workspace.
- [ ] Cross-browser, multi-account and failure-recovery integration tests.
- [ ] Production Auth redirect allowlist and final production environment configuration.

## Phase 2 — Direct messages, groups and channels

- [x] One-to-one conversation creation from username discovery.
- [x] Private group and announcement-channel creation.
- [x] Member discovery, add/remove, owner/admin/moderator/member role management.
- [x] Channel posting restricted to owners/admins by database policy.
- [x] Invite links with expiry, revocation and use limits; redemption is JWT-verified through a Supabase Edge Function.
- [ ] QR-code rendering for invite links.
- [ ] Ownership transfer and granular per-action permissions.
- [x] Topic labels and topic-scoped message creation.
- [x] Public channel discovery and self-service follow/join; channel posting remains admin-only.
- [x] Pinned-message management and Saved Messages browsing.
- [x] Forward text and attachment messages across conversations.

## Phase 3 — Everyday messaging

- [x] Emoji reactions.
- [x] Typing indicators and online presence in an open conversation.
- [x] Read receipts.
- [x] Full-text search across accessible message history using an RLS-respecting database function and GIN index.\n- [x] Per-conversation unread message counters.
- [x] Image, video, audio and file uploads with private storage and previews.
- [x] Browser voice-note recording and playback.
- [x] One-time location sharing.
- [ ] Albums, contact cards, live location sharing and link previews.
- [x] Personal conversation folders.
- [x] Draft synchronization across sessions.
- [x] Shared-media browser.
- [x] @username mentions with automatic membership-checked mention records and a mention inbox.
- [x] Poll creation/voting with single-choice enforcement in the database.
- [x] Scheduled text messages with an active one-minute Supabase Cron dispatcher.

## Phase 4 — Privacy and community safety

- [x] 24-hour image/video status updates with contact-scoped storage and automatic cleanup.
- [x] Conversation-level disappearing messages with scheduled storage cleanup.
- [~] Account blocking and report submission are implemented; report review queues, spam protection, admin moderation and audit trails remain outstanding.
- [x] Profile controls for online-presence and last-seen visibility.\n- [ ] Device/session management and server-side enforcement of last-seen visibility.
- [ ] Backup/export and account recovery hardening.
- [ ] Encryption design review; do not claim end-to-end encryption until independently tested.

## Phase 5 — Calls, automation and operations

- [ ] WebRTC audio/video calls with signaling, TURN/STUN and reconnect handling.
- [ ] Push notifications and multi-device synchronization.
- [ ] Bot/automation API with scoped permissions and abuse controls.
- [ ] Channel analytics and operational dashboards.
- [ ] Load, security, accessibility and disaster-recovery testing.

## Release rule

A feature is only marked complete after its frontend, backend, authorization, persistence (where applicable), failure states and relevant automated/manual tests are implemented. Database schema alone is foundation work, not feature completion. The current branch has a successful Vercel preview build, but live multi-user acceptance tests are still required before production release.
