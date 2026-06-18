# Aura Estates — Disaster Recovery & Business Continuity Plan

This document establishes the official recovery objectives and emergency incident response procedures for Aura Estates to ensure continuous application availability and regression control.

---

## 1. Recovery Objectives

Our operational commitments in a disaster event are bound by the following targets:

* **Recovery Point Objective (RPO) = 15 Minutes**
  * Maximum tolerable data loss duration. The database must be backed up incrementally every 15 minutes.
* **Recovery Time Objective (RTO) = 1 Hour**
  * Maximum tolerable downtime before full restoration of core business workflows (Search, CRM, Appointments, SOC).

---

## 2. Emergency Response Procedures

### A. Database Failure (Supabase Postgres)

#### Symptom:
Connection timeouts, pool saturation exceptions, or transaction rollback errors.

#### Action Steps:
1. **Identify Saturation**: Check if pool limits are saturated (e.g., Transaction pool saturation on heavy dashboard tasks).
2. **Switch to Direct Port Routing**: Modify the `DATABASE_URL` connection parameter to route requests to the direct database port (5432) rather than the PGBouncer transaction pool port (6543) if PGBouncer becomes locked.
3. **Trigger Cold Restoration**:
   * Fetch the latest automated snapshot from Supabase Backups (scheduled every 15 minutes).
   * Spin up a secondary recovery database instance in Supabase.
   * Run schema migrations: `npx prisma db push`.
   * Restore the snapshot into the recovery instance.
   * Update the `DATABASE_URL` environment parameter in production settings and redeploy.

---

### B. Cloudinary Service Failure

#### Symptom:
Image uploads fail, property cover photos return HTTP 500 errors, or Cloudinary API timeouts are logged.

#### Action Steps:
1. **Verify Cloudinary Status**: Inspect the Cloudinary API telemetry log feed.
2. **Activate Fallback Asset Storage**:
   * If Cloudinary is down, the file upload route should catch the exception and redirect image storage to standard base64 strings or write locally to the server's public scratch directories temporarily.
   * Implement image loading fallback elements in Next.js properties views (e.g., displaying placeholder blueprints or fallback images stored in `/public/images/fallback.jpg`).
3. **Queue Syncing**: Buffer successfully written local images to a sync directory and run a background task to sync them back to Cloudinary once the service recovers.

---

### C. Supabase Platform Outage

#### Symptom:
Database is completely unreachable, or client authorizations throw connection failures.

#### Action Steps:
1. **Redirect to Standby Secondary Node**:
   * In a critical regional AWS outage, deploy a standby database node on a separate cloud provider (e.g., AWS RDS or Neon PostgreSQL).
   * Update production settings with the fallback credentials.
2. **Local Session Cache Restoration**:
   * Client authentication relies on JWT NextAuth sessions. If the database is unreachable, sessions are buffered using local memory caches.
   * Lock mutations (e.g., block new registrations or appointments edits) and switch pages to Read-Only mode to avoid data sync drift.

---

### D. Email Service Outage (Resend API)

#### Symptom:
Appointment confirmations, rescheduling alerts, and OTP verification codes are not sent.

#### Action Steps:
1. **Email Buffering**:
   * Catch email dispatch failures in the mail controller.
   * Write pending email payloads directly to the database or a local JSON queue file (`/sent_emails/queue.json`).
2. **Local Logging Trace**:
   * Write logs of all unsent alerts to `/sent_emails/failures.log` for administrative trace diagnostics.
3. **Re-dispatch Sweeper**:
   * Once Resend recovers, run a cron sweeper job to fetch buffered messages and execute bulk re-sends.
