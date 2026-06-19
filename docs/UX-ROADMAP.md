# UX & feature improvement roadmap

From a deep multi-agent audit (2026-06-19) of every platform area: how each works, what it's for,
and where the friction is. Three cross-cutting themes drove the priorities:

1. **Surface the data we already have.** Points, enrollments, registrations, messages, revenue —
   all written, almost none shown back as signal ("am I improving? who's about to churn?").
2. **Light up dark features.** Badges, DM notifications, trial countdowns, purchase confirmations,
   and payment-failure alerts all exist in the schema but never reach the UI.
3. **No job/cron yet.** Anything time-triggered (event reminders, dunning, streak-at-risk) needs a
   Vercel Cron endpoint first — hence those are "bigger bets".

## Quick wins (high impact, S/M effort) — implement first

| # | Area | Improvement |
|---|------|-------------|
| 1 | Monetization | Trial countdown + renewal date/amount on dashboard |
| 2 | Shell | Past-due payment alert banner (recover silent churn) |
| 3 | Gamification | Render earned badges + award a badge on onboarding completion |
| 4 | Chat | In-app notification on every new DM/group message |
| 5 | Community | Feed sort options (recent / trending / hot) |
| 6 | Members | Directory sort + tier/role filter chips |
| 7 | Admin | Member search + tier/date/status filters + pagination |
| 8 | Admin | CSV export (members, revenue, segments, submissions) |
| 9 | Monetization | Order-success confirmation + "Mijn aankopen" page |
| 10 | Monetization | Personalize pricing page for logged-in members (current plan + upgrade delta) |
| 11 | Shell | Per-notification read + type filter on notifications page |
| 12 | Academy | Per-question quiz review + partial-credit breakdown |
| 13 | Events | Self-service registrant cancellation with auto-refund |
| 14 | Events | Waitlist auto-promotion on cancellation |
| 15 | Onboarding | Auto-mark onboarding steps when the user actually does them |
| 16 | Content | Cross-channel "Recent content" widget on dashboard |

## Bigger bets (high impact, L effort) — after quick wins

- `lastActiveAt` + engagement momentum + admin at-risk detection (retention ops)
- Per-course completion & lesson drop-off analytics
- Cron infrastructure → event reminders + dunning emails + streak-at-risk
- Revenue cohort analytics (MRR trend, churn by tier, LTV by cohort)
- Instructor self-service role with per-course ownership
- Block/mute + message edit/soft-delete + conversation search
- Content performance analytics (views/plays/opens) across channels
