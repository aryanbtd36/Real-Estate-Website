# Aura Estates — Phase 1: Security Architecture Review

This document provides a comprehensive security architecture review of the Aura Estates platform. It evaluates the perimeter defenses, authentication flow, role-based access control, session lifecycle, security telemetry collection, governance mechanisms, and deployment configuration.

---

## 1. Attack Surface Inventory

Aura Estates exposes several critical logical components as part of its deployment. Below is the inventory of endpoints and subsystems:

### 1.1 Web Application / Router Surfaces
* **Client Portal (`/dashboard/*`)**: Access restricted to authenticated clients (`USER` role). Exposes profile customization, saved properties, activity logs, and active session lists.
* **Property Listings (`/properties`, `/properties/[id]`)**: Globally accessible (anonymous/guest access). Exposes search and geocoding integrations.
* **Administrator Portal (`/admin/*`)**: Restricted to authenticated staff with `ADMIN` or `SUPER_ADMIN` roles. Exposes CRM (leads, follow-ups, analytics), scheduling systems, and property CRUD widgets.
* **Governance Command Center (`/super-admin/*`, `/founder`)**: Highly privileged zones restricted to `SUPER_ADMIN` and the designated immortal `Founder`. Exposes global lockdown toggles, administrator lifecycle reviews, and advanced security metrics.

### 1.2 API Route Interfaces
* **Authentication Subsystem (`/api/auth/*`)**:
  * `/api/auth/[...nextauth]`: Handles NextAuth callbacks, token generation, and sign-ins.
  * `/api/auth/forgot-password`, `/api/auth/reset-password`: Manages out-of-band password resets via expiring hashes.
  * `/api/auth/verify-email`, `/api/auth/verify-email/resend`: Handles signup verification tokens.
* **Client-Facing APIs (`/api/properties/*`, `/api/saved`, `/api/consent`, `/api/dashboard/*`)**: Endpoints enforcing client-level token authorization.
* **Concierge & Administration APIs (`/api/admin/*`)**: Highly sensitive data-modification routes. Includes property bulk operations, user timeline histories, lead analytical reporting, database CRM exporting, and calendar scheduling.
* **Security & Operations APIs (`/api/admin/security/*`)**: Collects signals, rules, alert acknowledgments, playbook outcomes, threat hunting metrics, and baseline regression statuses.

---

## 2. Security Strengths

The architectural analysis revealed several robust control patterns:

* **Defense-in-Depth Middleware Enforcement**: Global routing protection is enforced at the edge via `src/middleware.ts`, which screens JSON Web Tokens (JWT) before routing requests to protected layout trees or API folders.
* **Multi-Factor Authentication (MFA) & Secure Authentication Pipeline**: Standard credential entries are coupled with Cloudflare Turnstile bot protection to mitigate credential stuffing. Password validation checks for strength (length, special characters, sequences) and is backed by a secure password history registry. MFA onboarding issues cryptographically secure 32-character TOTP keys and hashes recovery codes.
* **Immortal Account & Tamper-Prevention Subsystem**: The `Founder` account features database-level locking and code-enforced self-preservation checks (`checkImmortalProtection`), which instantly revert any unauthorized suspension, deletion, or role changes made to governance profiles, triggering critical security alerts.
* **Global Lockdown Governance**: A two-factor global lockdown switch allows the `Founder` or `Primary Super Admin` to restrict all platform writes and block login access for all standard users and admins in case of compromise, allowing only the Founder to sign in.
* **Comprehensive SOC Pipelines & SOAR Integration**: A robust event logging system (`SecurityEventLogger`) automatically logs threat intelligence, impossible travel warnings, brute force attempts, and geosecurity alerts. The system triggers automated playbooks (SOAR) to temporarily lock accounts or revoke sessions when security thresholds are breached.
* **SSRF and Input Hardening**: Geocoding fetches are sanitized and restricted to hardcoded coordinate boundaries, preventing loopback connections. Rich-text and plain-text fields pass through strict DOMPurify sanitization.

---

## 3. Security Weaknesses

We identified the following potential logical issues during the code auditing phase:

* **Manually Duplicated Role Checks**: In the `/api/admin/*` folder, individual route handlers manually enforce `role !== 'ADMIN'` check. This legacy pattern did not respect the role hierarchy and blocked `SUPER_ADMIN` accounts from performing basic concierge work (such as viewing properties or rescheduling client appointments). 
  * *Status: Fully remediated in Wave 7C.2 by refactoring checks to accept both roles.*
* **CSRF Dependency on SameSite Policies**: While CSRF protection validation checks headers and cookies, the API framework relies heavily on browser execution of `SameSite=Lax` or `SameSite=Strict` cookie policies. Under legacy user-agents, cross-site origin request forging remains a residual concern.
* **Secrets Invalidation Exposure**: The presence of development-only variables in static config scopes (e.g. `.env` properties) poses a risk of environment leakage if configurations are committed or logs are captured during CI/CD execution.
* **Third-Party Script Dependability**: The Content Security Policy explicitly whitelists `'unsafe-inline'` and `'unsafe-eval'` for styles and Cloudflare scripts. This configuration lowers protection against malicious inline code injection in environments where user input is not fully sanitized.

---

## 4. Risk Matrix

| Risk ID | Vulnerability / Control Gap | Likelihood | Impact | Severity | Description / Threat Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RM-01** | Authorization logic lock out on Super Admin users | High | Medium | **High** | Manual role checks blocking the highest-privileged roles from performing admin tasks. |
| **RM-02** | CSP `'unsafe-inline'` and `'unsafe-eval'` permissions | Medium | High | **High** | Third-party script inclusion allows XSS exploits if sanitizers fail. |
| **RM-03** | Exposed secret keys in environment definitions | Low | Critical | **High** | Secret keys leaked through logs or repository history compromises database connections. |
| **RM-04** | Outdated Node dependencies with known moderate vulnerabilities | High | Medium | **Medium** | Outdated library dependencies (e.g. `uuid`, `@hono/node-server`) contain moderate-severity exploits. |
| **RM-05** | CSRF fallback validation gaps on non-compliant browsers | Low | Medium | **Low** | Non-compliant browsers bypass cookie isolation, enabling request forge loops. |

---

## 5. Recommended Fixes & Hardening Guidelines

To elevate the platform's security posture to enterprise-ready status, we recommend applying the following remediations:

1. **Unify Role Hierarchy Evaluations**: Banish manual string equality checks (e.g., `role === 'ADMIN'`) in route files. Replace them with a centralized utility or middleware helper (e.g., `hasAdminPrivileges(user)`) that correctly resolves role inheritance.
2. **Harden Content Security Policy**: Remove `'unsafe-inline'` and `'unsafe-eval'` from Next.js headers. Introduce cryptographic CSP nonces for scripts and stylesheets dynamically generated during client render cycles.
3. **Upgrade Dependencies regularly**: Automate dependency updates using tools like Dependabot or Renovate. Prioritize upgrading packages with known CVEs (such as `uuid` and `postcss`).
4. **Implement Key Rotation**: Establish a 90-day rotation cycle for the `NEXTAUTH_SECRET`, database connection passwords, and Mail service API keys.
