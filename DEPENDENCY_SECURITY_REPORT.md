# Aura Estates — Phase 10: Dependency Security Audit Report

This report documents the security audit of the external node modules and package definitions within Aura Estates. Findings are compiled from automated scanner operations (`npm audit` and `npm outdated`).

---

## 1. Vulnerability Scan Metrics

* **Scanning Source**: `npm audit`
* **Vulnerability Statistics**:
  * **Critical Severity**: 0
  * **High Severity**: 0
  * **Moderate Severity**: 7
  * **Low/Info Severity**: 0
  * **Total Vulnerabilities**: 7

---

## 2. Detailed Vulnerability Inventory

Below is the list of moderate-severity dependencies flagged during audit operations, along with their path and advisory metrics:

### 2.1 PostCSS XSS Vulnerability
* **Package**: `postcss`
* **Severity**: Moderate
* **CVSS Score**: 6.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
* **Advisory Link**: [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)
* **Description**: PostCSS has an XSS vulnerability via unescaped `</style>` tags in its CSS stringify output. If untrusted input is passed to the parser, scripts can execute.
* **Remediation**: Upgrade `postcss` to version `8.5.10` or higher. (Currently resolves transitively under the `next` dependency tree).

### 2.2 Uuid Buffer Bounds Check Vulnerability
* **Package**: `uuid`
* **Severity**: Moderate
* **CVSS Score**: 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N)
* **Advisory Link**: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
* **Description**: Missing buffer bounds check in v3/v5/v6 when `buf` parameter is supplied to the generator function.
* **Remediation**: Upgrade `uuid` to `11.1.1` or higher. (Currently pulled transitively by `next-auth` version `4.x`).

### 2.3 Hono Node Server ServeStatic Middleware Bypass
* **Package**: `@hono/node-server`
* **Severity**: Moderate
* **CVSS Score**: 5.3 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N)
* **Advisory Link**: [GHSA-92pp-h63x-v22m](https://github.com/advisories/GHSA-92pp-h63x-v22m)
* **Description**: Middleware directory traversal bypass exists when handling request URIs containing repeated slashes inside `serveStatic` components.
* **Remediation**: Upgrade `prisma` to `6.19.3` to fetch the updated dev client.

---

## 3. Outdated Dependencies Inventory

The following packages are currently outdated and should be queued for upgrade updates:

| Package Name | Installed Version | Wanted Version | Latest Version | Severity / Action |
| :--- | :--- | :--- | :--- | :--- |
| **`next`** | `15.5.19` | `15.5.19` | `16.2.9` | Minor updates available; upgrade resolves PostgreSQL/Prisma compatibility |
| **`react`** / **`react-dom`** | `19.1.0` | `19.1.0` | `19.2.7` | Patch upgrade recommended for performance improvements |
| **`typescript`** | `5.9.3` | `5.9.3` | `6.0.3` | Minor compiler update |
| **`isomorphic-dompurify`** | `3.17.0` | `3.18.0` | `3.18.0` | Minor security update (sanitization definitions) |
| **`lucide-react`** | `1.17.0` | `1.21.0` | `1.21.0` | Core icon libraries expansion |
| **`pg`** | `8.21.0` | `8.22.0` | `8.22.0` | Production driver patch upgrade |

---

## 4. Hardening Plan

1. **Lockfile Synchronization**: Run `npm audit fix --force` selectively to bump transitive sub-dependencies (e.g. `postcss` and `uuid`) without introducing breaking changes into Next.js core imports.
2. **Framework Alignment**: Schedule Next.js framework migration to `16.2.x` in the next development cycle to align React 19 production build pipelines.
