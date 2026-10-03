# Return and Refund Tracker — Product and Build Plan

**Status:** Build brief for an implementation agent  
**Working name:** Return Tracker (replace after checking name availability)  
**Target:** A responsive web app for people who shop online  
**Core promise:** Never miss a return deadline, and never forget to check whether a refund arrived.

## 1. What to build

Build a consumer web app where a person can record an online purchase in under 30 seconds, receive reminders before its return deadline, and track a return until its refund is confirmed. The app must work well on a phone because people often check orders and receipts there.

The first release should be simple enough to trust. Users enter purchase details themselves; the app does **not** read their inbox, guess a store's policy, connect to a bank, or claim that a refund has arrived automatically. Those features need separate validation and explicit user consent.

### The problem

- Order confirmations and receipts are scattered across email, retailer accounts, and photos.
- Return deadlines differ by item and store, so people forget them.
- After shipping a return, people may forget to verify the refund.
- Proof such as order numbers, receipts, and tracking numbers is hard to find when needed.

### Who it serves

Start with frequent online shoppers who buy from several stores and occasionally return items. The app should be usable by anyone, without targeting one profession, country, or retailer. Initially write the interface in English, but design dates, currencies, and time zones so localization is possible later.

### Success definition for the first release

A new user can sign up, add a purchase, set its deadline, receive a reminder, mark an item as returned, set a refund expectation, and close it after confirming the refund. The same flow must be reliable on mobile and desktop.

## 2. Product scope

### MVP features — build these

1. **Account and onboarding**
   - Email-based sign-in; choose a well-supported secure auth solution.
   - Verify the email address before sending reminders.
   - On first use, show a short explanation and a prominent **Add purchase** action.
   - Ask for time zone during onboarding, detect a default from the browser, and let the user change it.

2. **Purchase tracking**
   - Required fields: item name, store name, purchase date, and return deadline.
   - Optional fields: order number, amount, currency, item URL, notes, receipt image/PDF, and tags.
   - Let users add more than one item from the same order. Each item has its own return deadline and status.
   - Allow editing, archiving, and deletion.
   - Display days remaining and an explicit date; do not rely on color alone.

3. **Deadline reminders**
   - Default reminders at 7 days, 2 days, and 1 day before the return deadline. Users may turn individual reminders off.
   - Send by email. Show an in-app notification center for upcoming and overdue items.
   - Respect the user's time zone and send at a reasonable local hour, such as 9:00 a.m.
   - Never send duplicate reminders if a scheduled job retries.
   - Stop return reminders once the item is marked returned, kept, or archived.

4. **Return and refund tracking**
   - Statuses: **Open**, **Return started**, **Returned**, **Refund pending**, **Refund received**, **Kept**, **Expired**.
   - For a return, optionally record return date, carrier, tracking number, proof image/PDF, expected refund amount, expected refund date, and notes.
   - Remind the user to check a pending refund on the expected date and again after a configurable interval if still pending.
   - Users confirm receipt of the refund manually; the app never states that money arrived without user confirmation.
   - Keep a visible event history of status changes and reminder events.

5. **Dashboard and search**
   - Sections: **Needs attention**, **Upcoming deadlines**, **Refunds pending**, and **All purchases**.
   - Search by item, store, or order number.
   - Filter by status and sort by nearest deadline or newest purchase.
   - Include clear empty states and a fast path to add another purchase.

6. **Account controls**
   - Change time zone and reminder preferences.
   - Export purchase data in a common format such as CSV or JSON.
   - Delete account and associated data, including uploaded files, through a clear user flow.
   - Provide a way to contact support and report a bug.

### Status and reminder rules

- **Open** is the default after adding an item. A user may move it to **Return started**, **Returned**, or **Kept**.
- **Return started** means the user has begun the retailer's process but has not handed over or shipped the item. The user may move it to **Returned** or back to **Open**.
- **Returned** means the item was handed over or shipped. It may move to **Refund pending** or **Refund received**. Allow **Kept** only after explicit confirmation because it changes the meaning of the history.
- **Refund pending** stays visible until the user marks **Refund received** or explicitly closes the case. A user may correct an accidental status change.
- **Expired** is a display state for an open item after its return deadline, not an irreversible action. Users may still update or correct it.
- Use the user's local calendar date for return deadlines. Treat the deadline as the end of that local day for display and overdue calculations. Do not claim the store accepts returns until midnight; store policies can have their own cutoff times.
- If an item is added after one or more reminder offsets have passed, schedule only future reminders. Do not send a burst of missed reminders. If the deadline is today, show a prominent in-app notice immediately.
- If a deadline or time zone changes, cancel or invalidate unsent reminders and calculate new send times. Keep prior delivery records for audit.
- If a user has not entered an expected refund date, offer a suggested check-in date 14 days after the return date, clearly labeled as a user-editable reminder rather than a retailer promise.
- If a refund remains pending after a check-in, offer a **Remind me again** action instead of sending repeated emails indefinitely. Default to one follow-up seven days later if the user chooses it.

### Defer until the MVP is used

- Inbox connection or automatic order email parsing.
- Browser extension, mobile native app, push notifications, and SMS.
- Automatic retailer return-policy lookup or AI-generated deadlines.
- Bank/card connections and automatic refund detection.
- Price-drop monitoring, warranty management, family sharing, and subscription tracking.
- Direct retailer integrations or initiating returns on a user's behalf.

These are possible later expansions, not hidden MVP requirements.

## 3. Key user journeys

### A. Add a purchase

1. User opens the app and taps **Add purchase**.
2. User enters an item name, store, purchase date, and return deadline.
3. App previews the reminder dates in the user's local time zone.
4. User saves; the item appears in **Upcoming deadlines**.
5. User can attach a receipt or add an order number later.

**Acceptance criteria:** A person can complete this flow on a phone with no more than four required fields. Invalid dates show helpful errors. A deadline before the purchase date is blocked unless the user explicitly confirms an exceptional case.

### B. Receive a deadline reminder

1. At the configured time, a background job finds eligible items.
2. User receives one email naming the item, store, deadline, and link to the item.
3. User can open the item and mark it **Kept**, **Return started**, or **Returned**.

**Acceptance criteria:** Delivery is attempted only once per item/reminder stage, even if a worker retries. Reminder links require sign-in and cannot expose another user's data.

### C. Track a refund

1. User marks an item **Returned** and adds the return date and optional tracking details.
2. User marks it **Refund pending** and optionally adds an expected refund date and amount.
3. App displays it in **Refunds pending** and sends a check-in reminder.
4. User checks their payment method and marks **Refund received**, recording the actual amount and date if desired.

**Acceptance criteria:** Pending refunds remain visible until the user closes them. An expected date is a reminder setting, not a promise about the retailer.

## 4. Interface plan

### Pages

- Landing page: one-sentence value proposition, a product screenshot/demo, sign-up action, privacy explanation.
- Sign-in/sign-up and email verification.
- Dashboard.
- Add/edit purchase form.
- Purchase detail page with item information, event history, attachment list, and status actions.
- Settings: time zone, email reminders, export, deletion.
- Basic help, privacy policy, and terms pages before public launch.

### Design requirements

- Mobile-first and responsive down to a narrow phone screen.
- Important actions reachable with a thumb; large tap targets.
- Plain language: say “Return by October 12” rather than only “3 days left.”
- Clear distinction between **return deadline** and **expected refund date**.
- Accessible labels, keyboard operation, visible focus, sufficient contrast, and readable error messages.
- Do not use alarmist language or dark patterns to push payment.

## 5. Data model

The implementation agent may adjust names to fit the chosen framework, but preserve these concepts and ownership rules.

### `users`

- `id`, `email`, `email_verified_at`, `timezone`, `created_at`, `updated_at`, `deleted_at`.
- Reminder preference fields or a separate `notification_preferences` table.

### `orders`

- `id`, `user_id`, `store_name`, `order_number` (optional), `purchase_date`, `created_at`, `updated_at`.
- Represents one retailer order; may contain multiple items.

### `items`

- `id`, `order_id`, `user_id`, `name`, `amount` (optional), `currency` (optional), `item_url` (optional), `return_deadline`, `status`, `notes` (optional), `archived_at`, `created_at`, `updated_at`.
- Store money as integer minor units or an exact decimal type, never binary floating point.
- Dates that represent retailer deadlines should be stored as dates; scheduling converts them using the user's time zone.

### `returns`

- `id`, `item_id`, `user_id`, `return_started_at`, `returned_at`, `carrier`, `tracking_number`, `expected_refund_amount`, `expected_refund_date`, `actual_refund_amount`, `refund_received_at`, `notes`, `created_at`, `updated_at`.
- There may be zero or one active return record per item in the MVP.

### `attachments`

- `id`, `user_id`, `item_id`, `storage_key`, `original_filename`, `content_type`, `size_bytes`, `kind` (`receipt` or `return_proof`), `created_at`.
- File storage must be private; authorized access uses short-lived signed URLs or an authenticated proxy.

### `events`

- `id`, `user_id`, `item_id`, `event_type`, `metadata`, `created_at`.
- Record meaningful changes, such as deadline edits, status changes, and refund confirmation.

### `reminder_deliveries`

- `id`, `user_id`, `item_id`, `reminder_type`, `scheduled_for`, `sent_at`, `provider_message_id`, `status`, `attempt_count`, `last_error`.
- Unique key on `(item_id, reminder_type, scheduled_for)` or an equivalent idempotency key.

**Access rule:** Every query and mutation is scoped to the signed-in user's ID. The client must never be trusted to supply ownership.

## 6. Technical approach

### Recommended default stack

Use a conventional TypeScript web stack: Next.js for the interface and server routes, PostgreSQL for durable data, a maintained authentication library/service, private object storage for attachments, a transactional email provider, and a scheduled background job for reminders. Choose current supported versions and follow the providers' latest official setup guides during implementation. A different stack is fine if the implementation agent can ship and maintain it more reliably.

### System behavior

- Keep the source of truth in the database, not browser local storage.
- Validate all inputs on the server as well as in the form.
- Use UTC timestamps for events and delivery records; keep user-facing deadlines as calendar dates.
- Recalculate future reminder schedule when a deadline, status, time zone, or preference changes.
- Use a scheduled worker/cron job to enqueue or send due reminders. Add idempotency so retries are safe.
- Track send attempts and errors. Provide an admin-only way to inspect failures without exposing user purchase details unnecessarily.
- Rate-limit sign-in and upload endpoints and enforce file type and size limits.
- Use environment variables or a secrets manager for credentials; never commit secrets.
- Set up database migrations, backups, basic error monitoring, and structured logs before launch.

### Attachment limits for MVP

- Accept common image formats and PDF only.
- Set a clear per-file size cap, for example 10 MB, and a small number of files per item.
- Validate both file extension and actual content type on the server.
- Avoid serving uploaded files from a public bucket.
- Delete storage objects when the user deletes an attachment or account.

## 7. Privacy and trust

- Explain exactly what data is stored and why. A purchase history can reveal sensitive personal information.
- Collect only fields needed for the product. Do not ask for bank details or email inbox access in the MVP.
- Use HTTPS, secure sessions, least-privilege access, and encryption provided by the hosting platform for stored data.
- Keep purchase details out of email subject lines. In the email body, show only enough detail to identify the item; let users adjust email detail level if practical.
- Provide email preference and unsubscribe controls for optional messages while preserving essential account/security messages.
- Account deletion should remove personal records and uploaded files within the stated retention period; document backup retention honestly.
- If analytics are used, record product events such as “purchase added” without item names, store names, amounts, or order numbers.
- Draft jurisdiction-appropriate privacy and terms documents before public launch and have them reviewed if the business grows or handles additional data sources.

## 8. Business model and validation

### Pricing hypothesis

Start with a useful free tier. Example: up to 10 active items and basic email reminders. Test a paid tier around **US$12–24/year** for unlimited active items, more reminder choices, more attachment storage, and export convenience. This is a hypothesis, not a validated price. Avoid charging before there is evidence that users return and find value.

Do not place core refund confirmation behind a paywall; the app needs to deliver on its promise for free users. Do not add ads based on purchase history.

### Validation before adding complex features

1. Interview 15–20 frequent online shoppers. Ask for examples of missed return dates or forgotten refunds. Do not lead with the app idea.
2. Show a clickable prototype or the MVP. Watch whether people can add a real item without help.
3. Invite a small beta group. Ask them to track real purchases for four weeks.
4. Measure whether reminders lead to users opening items and updating statuses.
5. Ask users what they would pay for and why, then test a real payment page with clear terms.

### Metrics

- **Activation:** percentage of new users who add a first item within one day.
- **Time to value:** median time from sign-up to first saved item.
- **Usage:** active items per user and users returning after a reminder.
- **Outcome:** items marked returned before deadline; pending refunds later marked received.
- **Reliability:** reminder send success rate and duplicate-send count.
- **Retention:** users who add another purchase in the next 30 and 90 days.
- **Revenue later:** paid conversion, cancellation, and support burden.

Do not claim that the app “saved” money unless the user confirms an outcome. A reminder being sent is not proof of a saved refund.

## 9. Build phases and deliverables

### Phase 0 — Product definition and setup

- Confirm the working name, basic visual direction, hosting choice, and service providers.
- Create repository, environment templates, database migrations, deployment pipeline, and error monitoring.
- Produce a clickable page flow or lightweight wireframes.
- Define the status transition rules and reminder schedule in one shared specification.

**Exit condition:** A developer can run the app locally, and a reviewer can inspect the page flow.

### Phase 1 — Core tracking

- Build auth, onboarding, dashboard, order/item forms, detail page, search/filter, status changes, and event history.
- Add server validation and per-user access controls.
- Make the core flow responsive and accessible.

**Exit condition:** A user can track purchases and returns manually from start to finish without reminders or attachments.

### Phase 2 — Reminders and attachments

- Add preferences, scheduled reminder processing, transactional emails, delivery logging, retry behavior, and private uploads.
- Add export and account deletion.
- Set up operational alerts for repeated reminder failures.

**Exit condition:** A test account receives a correctly timed reminder once, can view a private receipt, and can export or delete its data.

### Phase 3 — Private beta

- Recruit 20–50 users and observe real use for four weeks.
- Fix confusing steps, failed emails, time-zone errors, and accessibility issues.
- Review privacy copy and support process.
- Decide whether paid features are warranted from observed usage and interviews.

**Exit condition:** Core flows work reliably for real users and there is evidence that at least some users repeatedly add purchases.

### Phase 4 — Public launch and payment test

- Publish the landing page, help content, policies, and support contact.
- If beta evidence supports it, add a simple paid tier with a clear billing page and cancellation flow.
- Track conversion and support requests, then choose the next feature based on user behavior.

**Exit condition:** Public users can understand the value, sign up, use the product, get support, and manage billing if enabled.

## 10. Test plan

Automated tests should focus on behavior that could lose user trust or money:

- A user cannot read, edit, download, or delete another user's data or attachments.
- Deadlines and reminders are correct across time zones and daylight saving changes.
- Editing a deadline reschedules reminders correctly.
- Retries do not send duplicate reminders.
- Changing status suppresses no-longer-relevant reminders.
- Upload validation rejects unsupported or oversized files.
- Deleting an account removes its data and storage objects as designed.
- Export includes the user's own data and no one else's.

Also run manual checks on a narrow phone screen, desktop, keyboard-only navigation, and common browsers. Use sandbox/test modes for email and billing integrations. Verify the production deployment with a real end-to-end test account before inviting users.

## 11. Decisions for the implementation agent

The agent may choose exact libraries and hosting services, but should keep the MVP scope above. When a choice is unclear, prefer the simplest maintained option that supports secure auth, private storage, scheduled jobs, and reliable email in the chosen deployment environment. Record each significant choice in a short `DECISIONS.md` file.

Deliver a running app, setup instructions, an environment variable template, database migrations, and a concise README. Include test instructions and a deployment checklist. Do not embed production credentials or connect a real payment account without the owner's configuration.

The agent should implement the core product in phases and show a working result after each phase. Do not spend the first phase on advanced AI extraction, retailer integrations, or a large design system.

## 12. Open questions to resolve with early users

- Which reminders are useful without becoming annoying?
- Do shoppers want to track every purchase, or only items they might return?
- Is manual entry acceptable, or is receipt/email import required for repeat use?
- Would people pay for unlimited tracking, household sharing, or automatic import?
- How much purchase detail are users comfortable showing in reminder emails?
- Which countries and currencies appear first among real users?

Treat answers as product evidence. Do not build an expansion solely because it sounds attractive.
