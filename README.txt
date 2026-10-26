LOVORA Full Platform Starter (Phase 1)

WHAT THIS ZIP INCLUDES
- Responsive dating-app UI for mobile and desktop, styled for phones first.
- Local preview mode with sample profiles, like/pass/super-like interactions, demo matches and browser-only demo messages before Supabase is configured.
- AI Matchmaker preference questionnaire and conversation-starter prompts (guided demo; no live AI model connected yet).
- Date Room screen (interface preview only; camera/microphone are not accessed and no calls are placed).
- Safety Center with verification request preview plus report/block logging stored only in the current browser before backend moderation is integrated.
- LOVORA Plus plans and feature presentation (prices are placeholders; no payments are processed).
- Supabase email/password sign-up and sign-in integration.
- Profile creation/editing.
- Discover profiles, like/super-like/pass, mutual-match detection.
- Basic chat UI and realtime refresh wiring.
- Likes, matches, premium plan screens, and starter report/block schema.
- Supabase SQL schema with row-level security starter policies.

SETUP (phone-friendly)
1. Create a NEW Supabase project for LOVORA. Do not reuse a production project with unrelated data.
2. In Supabase, open SQL Editor, create a new query, paste supabase_schema.sql, and run it.
3. Open Project Settings → API (or API Keys). Copy the Project URL and the anon/public key.
4. Edit config.js and replace the two PASTE... placeholders. Never use a service_role key in browser code.
5. Upload index.html, style.css, app.js, and config.js to a static host (Netlify, GitHub Pages, or similar). Keep supabase_schema.sql private to setup/admin.
6. In Supabase Authentication settings, configure the correct site URL and redirect URLs for your deployed website.
7. Sign up, confirm email if enabled, then create your profile. The discovery page will show profiles created by other test accounts.

IMPORTANT CURRENT LIMITATIONS
This is a feature-rich starter/prototype, not a launch-ready dating business. The preview profiles and browser-only interactions are fictional sample data and are not real members. A button or screen is not proof that its external service is connected. Premium buttons are placeholders and do not charge users. Do not advertise subscriptions until a payment provider such as Paystack is integrated using a trusted server-side verification flow.
- The starter does not yet include a production AI matching model, real video/voice calls, photo upload/storage, ID verification, mature admin permissions, automated content moderation, deletion/export workflows, or comprehensive anti-abuse controls. The new AI Matchmaker, Date Room, verification, report/block and payment screens are previews until the required services and secure backend workflows are implemented.
- Video/voice calls require a WebRTC/signaling service or provider and careful abuse/privacy controls.
- Use real age-gating (18+), consent, reporting/blocking UI, moderation queues, privacy/terms documents, secure rate limits, and independent security review before public launch.
- The SQL schema is a starting point and must be security-reviewed. Do not collect sensitive identity documents until a secure verification vendor and retention policy are in place.
- Public profile images should use an approved upload flow; don't allow arbitrary remote URLs in production without validation.


GOOGLE SIGN-IN SETUP
1. In Supabase Dashboard, open Authentication → Sign In / Providers → Google and enable Google.
2. Create a Google OAuth client in Google Cloud Console. Add the Supabase callback URL shown on the Supabase Google provider setup screen as an authorized redirect URI.
3. Paste the Google Client ID and Client Secret into Supabase's Google provider settings and save.
4. In Supabase Authentication → URL Configuration, set your deployed LOVORA website as the Site URL and add it to Redirect URLs.
5. The sign-in page includes a "Continue with Google" button. Google sign-in will not work until the provider and redirect URLs are configured.
