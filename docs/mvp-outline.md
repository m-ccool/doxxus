# Doxxus MVP Outline

**Status:** Draft for implementation planning  
**Product:** Doxxus, a solo developer studio and client services portal  
**Primary domain:** https://doxxus.us/  
**Last reviewed:** 2026-09-08

## Objective

Evolve Doxxus from a creative portfolio into a sleek, low-friction sales and client-services system for small local businesses, new ventures, creators, and passion projects.

The site should make three things obvious:

1. What B McCool builds.
2. What a prospective client can buy.
3. How a client can track an active project after purchase.

The positioning is a technical liaison and launch manager: one person accountable from initial idea through design, build, integration, launch, and follow-up.

## Product Principles

- Keep the current dark, experimental DOXXUS identity, globe motif, motion, glass surfaces, and restrained rainbow accents.
- Keep the interface minimal and card-driven, using the Fitndex-style pill treatment for pricing add-ons.
- Show proof before making claims. Rabbit Habit is the flagship visual case study because its simple interface complements the existing Doxxus theme.
- Store only contact and project data required to operate the service.
- Use hosted payment pages and established authentication primitives. Never store card data or plaintext passwords.
- Keep the public website useful without requiring an account.
- Add operational complexity only when it supports a real client workflow or sale.

## Audience and Positioning

**Audience:** Small-time, new, local, and passion-project clients who need a reliable person to guide a website or application from idea to launch.

**Role:** Product guide, designer, developer, integration lead, and launch manager.

**Working message:**

> Clear scope. Thoughtful software. One person accountable from first conversation to launch.

## MVP Scope

### In scope

- Public portfolio and service site at `doxxus.us`
- Rabbit Habit flagship case study
- Three simple website packages with placeholder public pricing
- Add-on pill selector
- Paid 30-minute and 60-minute consultations
- Consultation preparation document emailed after successful payment
- Stripe-hosted one-time checkout
- Optional recurring maintenance subscription
- Client email/password login
- Client profile and contact information
- Active project cards with status indicators
- Invoice and payment reference panel
- Schedule-call button and contact email action
- Minimal private admin panel for clients, projects, status, invoices, and meeting links
- Canonical URL, metadata, link, and accessibility cleanup

### Explicitly deferred

- Native card form or local payment-card storage
- Google login
- In-portal chat or ticketing
- File uploads and credential storage
- Full project-management timelines and task boards
- Automated domain registration and DNS management
- Automated hosting provisioning
- Native Bitcoin subscriptions
- Multi-client marketplace or Stripe Connect
- Complex CRM, tax, or accounting automation
- Native mobile applications

## Public Website MVP

The public site is five pages:

| Page | Purpose |
| --- | --- |
| `index.html` | Splash, positioning, software tier teaser, condensed IT tier, portfolio, about |
| `services.html` | Full software spec sheet, package tier comparison, add-ons, consultation, IT tier |
| `build.html` | Package builder — assemble a package and send the request |
| `signin.html` | Client portal placeholder (no authentication yet) |
| `terms.html` | Terms and conditions |

Homepage order:

1. Splash and positioning statement
2. Stack marquee
3. Software design services tier with primary call to action
4. IT consultation and repair tier, visually quieter
5. Selected work
6. About and contact

Package tiers and add-ons live on `services.html` rather than the homepage, presented as a
terminal-style spec sheet and a diff-style comparison table instead of pricing cards.

The current visual shell should remain recognizable. The copy should shift from generic web-services language toward product delivery and launch management.

### Package Builder

`build.html` is a five-step builder: base package, add-ons, project details, contact details, review.

- A running estimate is shown while selecting, labelled as an estimate and never as a quote.
- Submission posts to the existing `ajax-form-store.php` contact endpoint using its field contract
  (`type`, `user`, `email`, `phone`, `websummary`); the package summary is packed into `websummary`
  and truncated on a line boundary to respect the 500-character limit.
- **Fail closed:** the confirmation state is shown only when the endpoint returns the literal
  `success` token. Every other response, including network failure, shows an error with the
  `dev@doxxus.us` fallback.
- After confirmation the client chooses **Client sign in** or **Contact the dev**.

### Portfolio Carousel Card Types

The `#projects` carousel on `index.html` mixes two card types:

- **Mobile app cards** — background mockup image plus an `.iphone-bezel` device frame showing
  one or more app screenshots (ACNH Live Editor, FITNDEX, A New Leaf, Forecast).
- **Code snippet cards** — a `.code-snippet-item` card rendering a live `<pre><code>` block
  instead of a device mockup, for projects better shown as code than as a UI screenshot
  (e.g. the Pokemon Cards holo carousel). Currently seeded with placeholder code pending the
  real snippet.

Both card types share the same `.noraidus` bottom glass title panel, active-slide sparkle
animation, and ring glow treatment so the carousel reads as one consistent system.

### Flagship: Rabbit Habit

Present Rabbit Habit as evidence of product thinking and shipping ability, not only as a habit tracker.

Case study content:

- What it is
- Who it helps
- The problem or motivation
- Interface preview
- Technical approach
- Live demo
- Repository link when appropriate
- What could be built next

### Package 1: Launch Site

**Placeholder price:** `$900`

For a focused, polished web presence.

Includes:

- One responsive website
- Up to five primary sections or pages
- Custom visual styling
- Mobile and desktop layouts
- Contact or inquiry form
- Basic search-engine metadata
- Analytics setup
- Accessibility baseline
- GitHub-based deployment or handoff
- One revision round
- Launch handoff document

Best for local services, artists, creators, and small organizations.

### Package 2: Growth Site

**Placeholder price:** `$1,800`

For a more complete business or project presence.

Includes everything in Launch Site, plus:

- Up to ten pages or major sections
- Custom content structure
- Scheduling or calendar API integration
- Email workflow integration
- Advanced interaction and animation
- Content-management guidance
- Two revision rounds
- Thirty days of launch support

Best for clients ready to collect leads, bookings, or registrations.

### Package 3: Product Site

**Placeholder price:** `$3,500+`

For a public-facing product with deeper integrations.

Includes everything in Growth Site, plus:

- Custom application interface
- External API integrations
- AI-assisted feature integration
- User-flow planning
- Authentication or e-commerce preparation
- Custom data-display components
- Technical documentation
- Deployment architecture plan
- Two revision rounds
- Sixty days of launch support

Authentication, e-commerce, custom databases, and complex application logic remain separately quoted additions.

### Domain policy

- Client-owned domain: setup included where technically practical.
- Doxxus-managed domain: domain cost plus a clearly disclosed handling fee and monthly renewal.
- The client remains the legal owner of a domain purchased for them.
- Renewal terms and consequences of non-payment must be shown before checkout.

## Add-On Pricing

Use compact selectable pills similar to the Fitndex pricing interface. Prices are starting points and advanced work should be labeled `starting at`.

| Add-on | Placeholder price |
| --- | ---: |
| Additional page | $150 |
| Scheduling integration | $175 |
| Contact or lead workflow | $150 |
| AI integration | $300+ |
| Authentication | $500+ |
| E-commerce checkout | $600+ |
| Custom database | $600+ |
| Domain setup | $75 plus domain cost |
| Monthly maintenance | $75/month |
| Priority support | $150/month |
| Additional consultation hour | $150 |

The selected package and add-ons must be summarized before checkout. Final pricing must never be calculated only in client-side code.

## Consultation Products

### 30-Minute Project-Plan Consultation

**Price:** `$150`

Covers project scope, priorities, integrations, launch steps, and risks. The client leaves with a plan they could hand to any developer. Deliberately priced to filter out unfocused meetings.

Payment is collected during booking. Use this explanation everywhere the fee appears:

> Your consultation fee is credited toward a website package purchased within 30 days.

After successful payment, email:

- Meeting link
- Calendar invitation
- Required preparation document
- Business hours
- Rescheduling policy
- Preparation checklist

The preparation checklist requests the project goal, audience, existing domain, desired launch date, reference sites, integrations, brand assets, budget range, and decision-maker contact.

Google Meet is the primary meeting option. Zoom and WhatsApp can be offered as alternate preferences without building separate integrations in the first release.

## IT Consultation and Repair

A secondary, client-only service tier. It exists so clients on an active software contract, a retainer, or a special arrangement can have their machines dealt with by the same person building their software.

### 30-Minute Diagnostic

**Price:** `$100`

Triage the problem, walk the options, agree on next steps. The fee is applied toward the resulting repair ticket.

### Quoted per job

- OS repair and restore
- Malware cleanup
- Security and data backup
- Hardware repair

Rules that must hold everywhere this tier appears:

- Every service is quoted individually; no public rate card.
- The client-only gate is stated in the copy.
- **IT fees are never credited toward a software project.** The diagnostic credit applies only to repair work.
- The tier is presented below the software tier and at lower visual weight.

## Commerce MVP

### Recommended payment provider

Use Stripe-hosted Checkout first. It supports one-time payments, recurring subscriptions, receipts, customer email prefill, hosted payment UI, and webhook-based fulfillment without exposing card data to the application.

Stripe currently lists standard domestic card pricing at `2.9% + 30 cents` per successful transaction and no setup or monthly fee for standard payments. Verify current pricing and account eligibility before launch.

### Payment flows

- Consultation checkout
- Full package checkout or deposit checkout
- Add-on selection before checkout
- Optional monthly maintenance subscription
- Automatic receipt and invoice reference
- Success and cancellation states
- Server-side webhook confirmation
- Internal record of Stripe customer, checkout, invoice, and subscription IDs

Fulfillment must be driven by verified webhook events, not only by a browser redirect.

### Bitcoin phase

Defer native Bitcoin payment to a later phase. BTCPay Server offers self-hosted Bitcoin payments with no processor fee, but it introduces wallet management, deployment, exchange-rate, confirmation, refund, and maintenance responsibilities.

Later Bitcoin acceptance should use BTCPay Server or a managed BTCPay provider:

- One-time payments only at first
- Manual review until confirmation
- Explicit expired and underpaid invoice states
- No wallet private keys in the Doxxus application
- No recurring Bitcoin subscriptions in the MVP

## Client Portal MVP

Clients receive an account tied to the contact email used during consultation or checkout.

### Client view

- Contact information
- Active project cards
- Project name and short description
- Live URL where available
- Status indicator
- Invoice and payment history
- Subscription state where applicable
- Schedule-call button
- Contact button that opens email and shows business hours and business phone

### Status indicators

- Green: Live
- Yellow: In progress or updating
- Red: Issue or unavailable
- Gray, internal use: Not started or awaiting client information

The portal should remain a status and billing surface, not a full project-management application.

### Authentication requirements

- Passwords hashed with Argon2id or bcrypt
- Secure, HTTP-only session cookies
- Rate limiting and login-attempt protection
- Password reset flow
- Email verification
- CSRF protection where applicable
- No plaintext password storage
- No payment-card data storage

Google login is a later convenience feature, not an MVP dependency.

## Admin Panel MVP

The admin panel supports the liaison and manager workflow.

Required capabilities:

- Create and edit clients
- Create and edit projects
- Assign project status
- Add project descriptions and live URLs
- Add invoice and payment references
- Add meeting links
- View consultation bookings
- View payment and subscription state
- Send or resend preparation documents
- Disable client access

Keep the panel private and operational. Do not build a broad CRM or task-management suite.

## Data Boundary

Store only:

- Client name
- Contact email
- Phone number
- Business or project name
- Project metadata
- Project status
- Live URL
- Meeting URL
- Invoice and payment references
- Subscription state
- Created and updated timestamps

Do not store:

- Card numbers or security codes
- Wallet private keys
- Plaintext passwords
- Client credentials for third-party services
- Unnecessary identity documents
- Client files in the first release

Stripe stores payment details. Doxxus stores provider identifiers and payment status.

## Technical Direction

The current static site can remain the public frontend, but GitHub Pages alone cannot securely run private authentication, payment webhooks, secrets, or the admin panel.

Recommended low-complexity architecture:

- Frontend: existing HTML, CSS, and JavaScript
- Backend: Node.js with Express or a comparable small server runtime
- Database: PostgreSQL for production; SQLite is acceptable for an isolated early prototype
- Payments: Stripe Checkout and Stripe Billing
- Email: transactional email provider
- Scheduling: Google Calendar and Google Meet links
- Backend hosting: managed application host with environment secrets
- Public showcase hosting: GitHub Pages or the existing static host

Keep the public site and private API deployment separate so the showcase can remain stable while commerce features evolve.

## Delivery Phases

### Phase 1: Positioning and public site

- [x] Correct canonical URL, Open Graph URL, form endpoint, sitemap, and contact references to `doxxus.us`
- [ ] Replace generic service language with launch-manager positioning
- [x] Add package pricing section
- [x] Add add-on pill selector
- [x] Add consultation section and preparation expectations
- [ ] Make Rabbit Habit the flagship case study
- [ ] Remove dead `#0` links
- [ ] Replace inactive GitHub activity presentation with useful project evidence
- [ ] Update metadata, social preview image, footer year, and contact details
- [ ] Test mobile layout, keyboard navigation, reduced motion, and visible focus states

### Phase 2: Payment MVP

- [ ] Create Stripe products and prices
- [ ] Implement hosted consultation Checkout
- [ ] Implement package and deposit Checkout
- [ ] Add maintenance subscription
- [ ] Add success and cancellation pages
- [ ] Verify webhook signatures
- [ ] Generate or reference invoices and receipts
- [ ] Email preparation document after confirmed payment

### Phase 3: Client portal

- [ ] Create client account after confirmed payment or manual admin approval
- [ ] Implement secure email/password login
- [ ] Add profile view
- [ ] Add project cards and status indicators
- [ ] Add invoice and payment panel
- [ ] Add schedule-call and contact actions
- [ ] Add password reset and email verification

### Phase 4: Admin panel

- [ ] Add client management
- [ ] Add project management
- [ ] Add status updates
- [ ] Add meeting-link management
- [ ] Add invoice references
- [ ] Add consultation tracking
- [ ] Add payment visibility

### Phase 5: Payment expansion

- [ ] Evaluate BTCPay deployment or managed provider
- [ ] Add one-time Bitcoin invoices
- [ ] Add manual confirmation state
- [ ] Add refund and expiration handling
- [ ] Decide whether Bitcoin recurring payments justify the operational cost

## MVP Outline Status

- **Planning:** Defined
- **Public positioning:** Implemented — software tier leads, IT tier is a quiet client-only secondary
- **Public site:** Five pages live (`index`, `services`, `build`, `signin`, `terms`) on a shared design system
- **Package pricing:** Placeholder values selected for first market test
- **Consultation pricing:** `$150` software project-plan consult (credited) and `$100` IT diagnostic (applied to repair, never credited)
- **Package builder:** Implemented against the existing contact endpoint; fail-closed on submission
- **Commerce:** Stripe selected for MVP investigation and implementation
- **Bitcoin:** Deferred pending operational decision
- **Authentication:** Email/password required; Google login deferred. `signin.html` is a placeholder with no login fields.
- **Client portal:** Minimal profile, project, status, invoice, and scheduling scope defined
- **Admin panel:** Required for MVP operations; scope intentionally small
- **Data policy:** Contact and project metadata only
- **Implementation:** Phase 1 public surface complete; Node backend foundation started

## Shortest Path To Live UI Readback

1. ~~Update the public site copy, domain references, package tiers, add-ons, and consultation explanation.~~ Done.
2. Deploy the static public site and verify the live `doxxus.us` experience on desktop and mobile.
3. Add one Stripe test-mode consultation Checkout flow behind a small backend endpoint.
4. Verify the signed webhook and preparation-email flow in an isolated test environment.
5. Add package checkout only after the consultation flow is reliable.
6. Add client portal and admin features after a real payment record exists to drive the data model.

## Acceptance Checks

The MVP is ready when:

- A visitor understands who Doxxus helps within five seconds.
- A visitor can compare three packages without contacting you first.
- A visitor can book and pay for a consultation.
- The consultation fee credit is explained beside the price and in the confirmation email.
- The preparation document is delivered after confirmed payment.
- A visitor can purchase a package or deposit through Stripe Checkout.
- Payment status is confirmed server-side through a signed webhook.
- A client can log in without exposing payment or private data.
- A client can see project status and invoice references.
- You can create a client and project from the admin panel.
- All public links resolve correctly.
- No payment secrets exist in frontend code.
- Mobile layout, keyboard navigation, focus states, and reduced-motion behavior are usable.
- The live site uses `doxxus.us` consistently in canonical, Open Graph, sitemap, form, and contact references.

## Excluded Items and Reasons

- **README changes:** This outline is separate so the existing project README remains a technical repository summary. Add a README link only after the outline is approved.
- **Full hosting platform:** Hosting provisioning is outside the first sale and requires more infrastructure than the current service model needs.
- **In-portal chat and files:** Email and external meeting tools cover the initial communication workflow with less stored personal data.
- **Bitcoin subscriptions:** Confirmation and recurring-payment operations are not worth the initial complexity.
- **Google login:** Useful later, but email/password is sufficient for the first client account workflow.
