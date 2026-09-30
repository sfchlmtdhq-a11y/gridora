---
name: Gridora authentication and data boundary
description: Durable auth and empty-first data rules for the Gridora product.
---

Gridora uses Clerk for browser sessions and Google/email authentication, with a PostgreSQL local-user bridge created from actual Clerk profile data on first authenticated API use. The local database is intentionally never seeded.

**Why:** The product requirement is a fresh social platform where every visible user, connection, message, post, and statistic must originate from real user activity.

Replit-managed Clerk enforces CAPTCHA and bot protection at the provider level; the application cannot disable these safeguards.

**Why:** The product requirement is a fresh social platform where every visible user, connection, message, post, and statistic must originate from real user activity. Clerk also owns anti-abuse controls for this managed tenant.

**How to apply:** Keep ownership derived from the Clerk session on the server. Only accepted connection pairs may access messages. Admin access must remain a server-side database role or server-only bootstrap configuration; never put an admin secret or role decision in frontend code. Preserve managed CAPTCHA and bot protections rather than trying to bypass them.