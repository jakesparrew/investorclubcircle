# Circle.so vs InvestorClub — gap analysis & build plan (2026-09-18)

Research: ~230 Circle features (pricing table, all release notes Apr-2025 → Aug-2026, 574 help-center
articles, G2/Trustpilot/Capterra reviews) compared against a full inventory of this repo.
Skipped on purpose (irrelevant for one community): Discover marketplace, Studios, multi-community,
headless/member API billing, branded native apps (PWA + web push covers it), 6-language i18n (we're NL).

## Where we already beat Circle
| Us | Circle |
|---|---|
| Certificates + public verify page | none |
| Assignments with feedback/grading | none |
| Learning paths, prerequisites per lesson, per-question quiz review | drip by section only, MC quizzes only |
| Emoji reactions on posts/comments | likes only (top complaint) |
| Badges + daily streaks + check-in | points + 9 levels only |
| Event deposits (€1 refundable), waitlist auto-promote, check-in | one ticket price |
| Win-back cancel flow (pause/discount) | "prevent cancellation" toggle |
| Dutch UI | no Dutch |
| AI not paywalled (we pay tokens only) | agents/AI moderation = Plus (custom $$) |

## Gaps — ranked for InvestorClub

### Fase A — Core engagement (Circle basics we lack)
1. **Realtime chat** — replace 5s polling (SSE or Supabase/Neon-compatible pub/sub); **chat spaces/channels with threads**, chat reactions, chat search, mark-all-read, report message.
2. **Notifications that reach people** — web push (PWA/VAPID), email for replies/mentions/DMs, **weekly digest** (+ optional daily), per-space/per-channel preferences, unsubscribe.
3. **Posts** — edit post/comment, drafts + **scheduled posts**, image/file attachments, cover image, **@mention → notification**, topics/tags per space, follow/unfollow thread, close comments, space layouts (feed/list/cards).
4. **Profiles & directory** — **custom profile fields** (admin-defined), location + member map, "connect" requests, directory filters on fields.
5. **Moderation** — profanity/keyword filter, suspend/ban UI (`suspendedUntil` exists), per-space moderators, moderation queue with notes.

### Fase B — Live
**Beslissing 2026-09-18: YouTube blijft de host** (1 stream/week, ~100 live + 50 replay; link-delen is OK,
YouTube = gratis bandbreedte + opname). Gedaan: gewone YouTube-link volstaat, replay = zelfde URL,
"Nu live"-melding naar iedereen. Auto-detectie (`lib/youtube-live.ts`): gaat het kanaal (publiek) live,
dan maakt het platform zelf de stream aan + melding + rode banner; na afloop → opname. LiveKit/Cloudflare Stream enkel als gating ooit nodig wordt.
Nog te bouwen: eigen live-chat + Q&A naast de YouTube-embed (bij ons, niet YouTube-chat).
6. (Parked) Go Live from browser (host + co-hosts), backstage, live chat + reactions, **Q&A with upvotes**, spotlight message, rooms (everyone on camera), recording → R2 → replay, auto live/ended via webhook, "we're live" push, picture-in-picture, public webinar mode (guests via email = lead capture).

### Fase C — AI layer (our differentiator; Circle gates this at $$$)
7. **InvestorClub AI-assistent** — RAG over posts, lessons, podcast + live transcripts (pgvector), answers with citations, in DM + search; escalation to a human; admin inbox of AI chats.
8. **Transcripts** — podcast episodes, live recordings, lesson videos (speech-to-text: Whisper/Deepgram; Claude has no audio input) → searchable, timestamped, chapters, feed into #7.
9. **Summaries** — "Wat heb ik gemist?" (space/feed recap 7/30d), thread summaries, AI-written weekly digest per member.
10. **AI moderation** — flag scam/shill/financial-advice posts (crypto-specific!), explain reasons in the queue.
11. **Admin copilot** — ask analytics in plain language ("welke leden haken af?"), activity score 1-10 per member, suggested actions (daily brief).
12. **AI course builder** — lesson summary + quiz generation from lesson video/text.
13. **MCP server** for the platform (admin in Claude) — later.

### Fase D — Growth & operations
14. **Workflows engine** — triggers (joined, tier changed, payment failed, course/lesson done, event attended, post published, form submitted) → actions (email, DM, push, tag, points, grant access, webhook, delay). Circle's is linear; ours can branch.
15. **Email hub** — broadcasts to segments (field exists, unused), scheduling, templates, open/click tracking, automations, unsubscribe/list health.
16. **Forms & surveys** — builder, submissions → profile fields + workflow trigger.
17. **Events** — real recurrence engine (series exists, unused), multiple reminders (field exists), RSVP restricted by tier with upgrade CTA, guest RSVP, attendee export, in-person/online types.
18. **Monetization** — Bancontact/iDEAL/SEPA (Stripe config), installments, upfront fee, post-purchase upsells, checkout links with preselected price, gift/bundle UI (schema exists), affiliate payouts dashboard.
19. **Analytics** — video/listen analytics, per-course drop-off, content performance, MRR trend, cohort retention.
20. **Site/SEO** — public landing + event/course sales pages, OG/sitemap, custom CSS.
21. **Security & data** — 2FA (email OTP), session list/revoke, login rate limit, member self-export/delete (GDPR).
22. **Media manager** — R2 storage, usage, "used in", thumbnails.

## Circle weaknesses to exploit (from reviews)
Emoji reactions, real LMS (certs/assignments), DM control per tier, daily digest, branching workflows,
full data export, Dutch, AI without enterprise plan, live limits (15-20 room participants, 10 h/month),
restream to YouTube (LiveKit egress can), PayPal/EU payments.
