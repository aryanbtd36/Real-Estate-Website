# Aura Estates — Adversarial Security Review Report

This report presents a security review of Aura Estates from the perspective of an active adversary. It documents tested attack vectors and validation outcomes.

---

## 1. Adversary Vantage Points

We simulated attacks assuming the adversary possessed:
* **Vantage Point A**: A registered client account (`USER` role) with access to the dashboard.
* **Vantage Point B**: An administrative account (`ADMIN` role) aiming to perform governance actions.
* **Vantage Point C**: An expired or revoked session token.
* **Vantage Point D**: Browser developer tools and direct REST API access.

---

## 2. Tested Attack Scenarios

### 2.1 Vertical Privilege Escalation (User to Admin)
* *Attack Method*: Adversary logs in with a normal client account and sends a `PUT` request to `/api/dashboard/profile` or `/api/dashboard/settings` containing the payload: `{"role": "ADMIN"}` or `{"role": "SUPER_ADMIN"}`.
* *Validation Outcome*: **Blocked / Safe**. The profile update handler only allows changing profile details (such as name or phone) and ignores the `role` parameter. Role promotions must go through the Super Admin governance review workflows.
* *Evidence*: [route.ts](file:///d:/Project/src/app/api/dashboard/profile/route.ts) maps updating fields strictly, preventing parameter injection.

### 2.2 Horizontal Access Abuse (User to User)
* *Attack Method*: Adversary attempts to fetch saved properties or appointment records belonging to another client by guessing UUID strings.
* *Validation Outcome*: **Blocked / Safe**. The backend queries the database using logical user isolation, ensuring a user can only access records associated with their authenticated user ID.
* *Evidence*: Database queries enforce ownership scope:
  ```typescript
  where: { id: apptId, userId: session.user.id }
  ```

### 2.3 Horizontal Administrative Access (Admin to Super Admin)
* *Attack Method*: Standard administrator tries to call the global lockdown endpoint `/api/admin/governance/lockdown` to lock the system.
* *Validation Outcome*: **Blocked (403 Forbidden)**. The endpoint validates that the caller holds the `SUPER_ADMIN` or `Founder` roles before parsing the request.
* *Evidence*: [route.ts](file:///d:/Project/src/app/api/admin/governance/lockdown/route.ts) checks role authority.

### 2.4 Workflow Bypass (Invalid Funnel Shifts)
* *Attack Method*: Adversary attempts to bypass appointment validation rules to book overlapping times or modify completed appointments.
* *Validation Outcome*: **Blocked**. Server-side conflict detection engines block modifications to completed slots.
* *Evidence*: [appointment-conflicts.ts](file:///d:/Project/src/lib/appointment-conflicts.ts) enforces constraints.

---

## 3. Assessment Summary

* **Status**: **PASSED**
* **Vulnerabilities**: 0 privilege escalation or horizontal bypass leaks.
* **Residual Risk**: Low. Restricting administrative API access strictly to validated roles provides defense-in-depth security.
