LOVORA Stage 2 — Communities and Notifications

This package builds on the latest flat-coin/always-visible-notifications project.

WHAT IS WIRED IN THE FRONT END
- Community directory attempts to load public communities from Supabase after sign-in.
- Authenticated users can create communities through lovora_create_community.
- Join/leave actions call lovora_join_community and lovora_leave_community.
- Notifications attempt to load from lovora_notifications for the signed-in user.
- Each notification can be marked read through lovora_mark_notification_read.
- Mark all read calls the server function for each unread notification.
- If the migration is not installed or the user is signed out, existing preview cards remain available.

IMPORTANT
1. Keep a backup of the currently working LOVORA files.
2. Do not run supabase_schema.sql or lovora_coin_messaging.sql on the live project; they may not match its existing schema.
3. 04_lovora_platform_features.sql is a prerequisite for 05_communities_notifications_functions.sql. Review both against the live project before running them.
4. The SQL has NOT been executed against your live Supabase project. Test it in a separate Supabase project first, and inspect errors before production use.
5. The database migration adds server-side community create/join/leave/send functions and server-created notification records for direct messages, matches, and community messages. Community group message screen and live realtime subscriptions are still not fully connected in this stage.
6. Existing matching, signup, and send_lovora_message functions are not replaced by this migration. It adds triggers to the existing public.messages and public.matches tables, so verify the current trigger inventory before production use to avoid duplicate notifications.
7. Secure coin transactions, gift transfers, verified payment webhooks, identity verification review, and real voice/video calling remain separate integrations and are not complete in this package.

Suggested deployment sequence
1. Test these files and SQL in a separate/staging Supabase project.
2. Apply/review migration 04, then migration 05, only after checking policies, trigger inventory, and SQL errors.
3. Sign in and test creating a community, joining/leaving it, receiving notifications, and marking them read.
4. Only then replace the live Netlify files.
