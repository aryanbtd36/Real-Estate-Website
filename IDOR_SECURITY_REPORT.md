# Aura Estates — Insecure Direct Object Reference (IDOR) Assessment Report

This report documents the security audit of resource parameter mapping and object authorization controls in Aura Estates.

---

## 1. IDOR Audit Scope

The following resource-representing models were audited:
* **Users (`/api/users/[id]`)**: Personal profiles and contact attributes.
* **Appointments (`/api/appointments/[id]`)**: Scheduled viewing slots, notes, and outcome histories.
* **Leads (`/api/admin/leads/[id]`)**: CRM client tracking profiles.
* **Audit Logs / Incidents**: High-privilege SOC events.
* **Saved Properties**: Private user wishlists.

---

## 2. Adversarial Manipulation Results

We simulated parameter tampering attacks on all client and administrator endpoints:

### 2.1 User Profile Tampering
* *Attack Scenario*: User `A` (UUID: `user-a-id`) attempts to view/modify the profile of User `B` (UUID: `user-b-id`) by sending a raw request to `/api/dashboard/profile` or `/api/users/user-b-id`.
* *Validation Outcome*: **Blocked**. The application resolves user context directly from the NextAuth JWT session token rather than trust client-supplied ID parameters in payload templates.
* *Evidence*: [auth.ts](file:///d:/Project/src/lib/auth.ts) and profile API endpoints map actions strictly to the authenticated `session.user.id`.

### 2.2 Appointment Cross-Access
* *Attack Scenario*: User `A` attempts to reschedule or cancel User `B`'s appointment by targeting `/api/appointments/appt-b-id` or POST outcome requests.
* *Validation Outcome*: **Blocked (403 Forbidden)**. The system performs database queries checking ownership:
  ```typescript
  const appointment = await db.appointment.findFirst({
    where: { id: apptId, userId: session.user.id }
  });
  ```
  If no record is resolved under that specific user ID, access is denied.

### 2.3 Lead / CRM Record Manipulation
* *Attack Scenario*: A low-privilege agent attempts to access or assign a lead belonging to another admin.
* *Validation Outcome*: **Blocked**. Route-level controllers under `/api/admin/leads/*` check the caller's role and database relations, rejecting modifications by non-assigned administrators unless they hold the `ADMIN` or `SUPER_ADMIN` authorization claims.

---

## 3. Findings & Remediation

* **Status**: **PASSED**
* **Vulnerabilities Found**: 0 direct parameter references exposed to validation bypasses.
* **Remediation Applied**: None needed. The design system consistently resolves resource ownership from validated server session payloads rather than trust parameters provided in request payloads.
