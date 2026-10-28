LOVORA CONSOLIDATED DEVELOPMENT PACKAGE — AUDITED

This package consolidates the current LOVORA web app files and proposed additive SQL migrations.

Included website files: index.html, style.css, app.js, config.js, lovora-ui.js.
Included migrations: 03_chat_read_receipts.sql, 04_lovora_platform_features.sql, 05_communities_notifications_functions.sql.

Audited fixes in this package:
- Navigation clicks now route through the community/notification/wallet integration layer.
- Community-message read policy explicitly checks the message row community ID.
- Flat, non-glossy gold coin icon styling beside the balance.
- Notification button is kept visible on narrow mobile screens.
- Fixed a recursive row-level-security policy in the community membership table by using a SECURITY DEFINER membership helper.
- Direct client inserts into community messages are disabled; use the validated send-message RPC.
- Excluded legacy SQL scripts that assume a different database schema.

IMPORTANT LIMITS:
This is not a fully production-complete dating platform. The web JavaScript syntax and archive structure were checked, but these migrations have NOT been run against your live Supabase project. Apply them only after review and testing in a separate/staging project. Do not upload over your live site until end-to-end testing passes.

Already present: profile/discovery/matching/direct-message foundation and UI. Community create/join/leave and notification read actions are wired to the proposed database RPCs/tables. Group-chat screen flow, realtime subscriptions, secure coin ledger/gift transactions, real payment webhooks, identity verification provider/review, voice/video calling, and production moderation still need implementation/integration and testing.

Configuration: config.js contains only the Supabase project URL and publishable/anon key. Never put a service-role key in browser code.

Suggested staging test order:
1. Back up the live database and clone to a staging Supabase project.
2. Review and apply 04_lovora_platform_features.sql.
3. Review and apply 05_communities_notifications_functions.sql.
4. Apply 03_chat_read_receipts.sql only if read receipts are desired and not already installed.
5. Test with two test accounts: signup, profile creation, mutual matches, direct messages, community creation/join/leave/group messages, notification permissions/read state, blocking, and mobile layout.
6. Deploy to Netlify only after tests pass.


CURRENT BUILD NOTE: This package adds the community group-chat UI, starter community seed data, join/leave controls, and notification refresh hooks. Payment is excluded. See FINAL_RELEASE_STATUS.txt before deployment; migrations must be tested in staging first.


COMMUNITY WORKFLOW UPDATE (2026-10-27)
- This package includes 06_private_community_workflows.sql for private join requests, owner/moderator approval/rejection, invitations, invite acceptance/decline, and server-side notifications.
- Gold communities are discoverable in the directory, but join/request/invite acceptance is gated by active premium_until on the profile. Payment processing remains intentionally unconnected.
- Group chat uses membership-gated message functions and the community message notification trigger from migration 05.
- SQL order for a NEW TEST PROJECT: 04_lovora_platform_features.sql, 05_communities_notifications_functions.sql, then 06_private_community_workflows.sql. Existing live projects must compare current schema and policies first; do not blindly rerun on production.
- Current UI uses browser confirm/prompt dialogs for request review/invite entry; a polished custom management modal is a future UI refinement.
- No live Supabase end-to-end test was run during packaging.


UI + WALLET/GIFT UPDATE (2026-10-28)
- Removed the sign-up preview button and made the login/sign-up modal opaque so coin and notification controls are not visible behind it.
- Community group chat now slides in from the left as a full-screen panel with a light lavender message body. Sender names are clickable and open member profile details with report/block actions.
- Added 08_secure_wallet_gifts_messages.sql: seeds 500 welcome coins once for existing/new accounts, provides a server-read wallet balance, charges 1 coin per private message, rejects insufficient balance, and delivers gifts into the private chat with a gift notification.
- Before using the wallet changes, review and run migration 08 in Supabase SQL Editor AFTER the wallet, transaction, gifts, notifications, matches, messages and block tables already exist. Do not rerun older schema files blindly on the live project.
- Coin purchases are not enabled because no verified payment provider is connected. The 500 welcome coins are one-time starter coins; the browser cannot directly set a balance.
- JavaScript syntax checks passed while packaging. This archive has not been end-to-end tested against the live Supabase project; test with two accounts before deploying.
