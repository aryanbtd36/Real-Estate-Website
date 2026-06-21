# Aura Estates Security Configuration Baseline

This document records the official configuration targets and parameters enforced by the security verification engine.

---

## 1. Baseline Target Parameters

The security baseline represents the hard security configuration state. It acts as a template for drift detection audits.

### Target Performance Metrics
- **Overall Posture Score**: Target **95% or higher** (Enterprise Ready).
- **MFA Enrollment**: **100%** mandatory for ADMIN and SUPER_ADMIN accounts.
- **Inactivity Session Timeout**: Max **15 minutes**.
- **Password Max Age**: Max **90 days**.

### Mandatory Security Controls
The 25 baseline controls verified by `SecurityControlVerifier` are:
1. **Authentication**: Identity providers and active directories checked.
2. **Authorization**: RBAC rules mapped.
3. **MFA**: Admin enrollment verified.
4. **Password Security**: Force reset indicators monitored.
5. **Session Security**: Active session rotation active.
6. **CSRF Protection**: Mutating route headers verified.
7. **Rate Limiting**: Burst limiters verified.
8. **Threat Detection**: Telemetry active.
9. **Threat Intelligence**: Anomaly block lists synced.
10. **Incident Response**: Unresolved incidents metric monitored.
11. **Security Orchestration**: Containment playbook executions tracked.
12. **Threat Hunting**: Sweeper runs verified.
13. **Behavioral Analytics**: Session anomaly engines calibrated.
14. **Geosecurity**: Impossible travel alerts active.
15. **SOC Operations**: Dashboard metrics monitored.
16. **XSS Protection**: HTML DOMPurify sanitization rules active.
17. **SSTI Protection**: Template compiler checks active.
18. **ReDoS Protection**: Regex checker libraries active.
19. **Upload Security**: MIME type validation active.
20. **Secret Scanning**: Repo scanning clean of credentials.
21. **Compliance**: GDPR user consents checked.
22. **Governance**: Lockdown triggers validated.
23. **Disaster Recovery**: RPO threshold target compliant (15 minutes).
24. **Security Headers**: All 9 OWASP secure HTTP headers validated.
25. **Content Security Policy**: Weak policies resolved.

---

## 2. Configuration Drift and Severity Mapping

Any deviation of the platform's active state from the baseline parameters generates a configuration drift event.

| Drift Type | Expected | Actual / Trigger | Severity |
| :--- | :--- | :--- | :--- |
| **Score Regression (Critical)** | Overall >= 95 | Drop of >= 10 points | **CRITICAL** |
| **Score Regression (Major)** | Overall >= 95 | Drop of 5 to 9 points | **HIGH** |
| **Score Regression (Minor)** | Overall >= 95 | Drop of 1 to 4 points | **WARNING** |
| **Control Failure** | ACTIVE / WARNING | Control Status: **FAILED** | **CRITICAL** |
| **Control Warning** | ACTIVE | Control Status: **WARNING** | **WARNING** |

---

## 3. Regression Recovery Workflow

When a regression or drift is detected:
1. The engine logs a `SECURITY_BASELINE_REGRESSION` security event.
2. A high-priority open alert is created in the Incident Command Console.
3. SOC analysts must consult the `remediation` recommendation field (e.g., `"Restore Security Controls (MFA status) immediately to resolve failure."`).
4. Resolve the underlying configuration issue (such as enrolling missing admin users in MFA, fixing header configs, or solving data backup errors).
5. Once the issue is resolved, run the posture check again. The alert will automatically close, restoring the drift level to `NO_DRIFT`.
