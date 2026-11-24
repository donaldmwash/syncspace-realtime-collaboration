# SyncSpace 2.0 implementation tracker

This tracker distinguishes database groundwork from user-facing, tested functionality. A database table does not mean its feature is implemented in the app.

## Current production baseline

- [x] Existing public realtime room, display names, message edit/delete, replies and 5 MB attachments (temporary in-memory storage).
- [x] Dedicated Supabase project created in the existing organisation (London region).
- [x] Initial relational schema and row-level security for accounts/profiles, conversations, memberships, messages, attachments, reactions and read/delivery receipts.
- [x] Additional schema groundwork for invites, pinned messages, Saved Messages, topics, polls, scheduled messages, blocks/reports, 24-hour statuses, call records, devices, drafts, folders and mentions.
- [x] Security advisor returned no findings after the schema changes.
- [ ] The current web app and realtime service are not yet connected to Supabase Auth or database persistence.
- [ ] Existing public chat still uses guest identities and in-memory messages/files. Do not treat it as a private or durable messaging service.

## Implementation phases

### Phase 1 — Identity, persistence and access control
- [ ] Supabase Auth signup, login, logout, email verification and password reset.
- [ ] Profile editing, usernames, avatar upload and account settings.
- [ ] Verify user JWTs in the realtime service; remove trust in client-supplied author IDs and display names.
- [ ] Persist messages, replies, edits, deletions, memberships and receipts in Postgres.
- [ ] Private storage bucket for attachments with membership-checked downloads.
- [ ] Migrate the existing public room without losing the currently running experience.
- [ ] Cross-browser and multi-user integration tests.

### Phase 2 — Direct messages, groups and channels
- [ ] One-to-one conversations and user discovery.
- [ ] Group and channel creation, roles, permissions and member management.
- [ ] Invite links with expiry/revocation and optional use limits.
- [ ] Announcements, broadcast channels and topic-based group discussions.
- [ ] Message forwarding, pinning and Saved Messages.

### Phase 3 — Everyday messaging
- [ ] Emoji reactions, typing indicators, online/last-seen privacy and presence.
- [ ] Sent/delivered/read receipts and unread counts.
- [ ] Message search, mentions, drafts, folders and shared-media/file views.
- [ ] Image/video/document previews, albums, voice notes and larger uploads.
- [ ] Link previews and contact/location sharing.
- [ ] Polls and scheduled messages.

### Phase 4 — Privacy and community safety
- [ ] Disappearing messages and status updates with expiry.
- [ ] Block/report, spam protection, admin moderation and audit trails.
- [ ] Session/device management and privacy settings.
- [ ] Backup/export and account recovery.
- [ ] Encryption design review; do not claim end-to-end encryption until independently tested.

### Phase 5 — Calls, automation and operations
- [ ] WebRTC audio/video calls with signaling, TURN/STUN and reconnect handling.
- [ ] Notifications and multi-device synchronization.
- [ ] Bot/automation API with scoped permissions and abuse controls.
- [ ] Channel analytics and operational dashboards.
- [ ] Load, security, accessibility and disaster-recovery testing.

## Release rule

A feature is only marked complete after its frontend, backend, authorization, persistence (where applicable), failure states and relevant automated/manual tests are implemented. Database schema alone is foundation work, not feature completion.
