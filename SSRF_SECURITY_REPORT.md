# Aura Estates — Server-Side Request Forgery (SSRF) Assessment Report

This report documents the security audit of all server-initiated HTTP requests in Aura Estates.

---

## 1. Outbound Request Inventory

We audited every location in the codebase where the backend server makes external requests:
* **Cloudflare Turnstile (`verifyTurnstile`)**: Verifies visitor tokens against `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
* **Resend Email API (`sendEmail`)**: Dispatches system notifications to `https://api.resend.com/emails`.
* **Geocoding & Location Intelligence (`LocationIntelligenceService`)**: Resolves locations using:
  * `https://nominatim.openstreetmap.org/search?q=...`
  * `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...`

---

## 2. Adversarial Penetration Testing & Mitigations

We attempted SSRF exploitation against all three request areas:

### 2.1 Nominatim Geocoding Query Injection
* *Attack Vector*: Injecting local IP addresses, loopback ranges, or cloud metadata endpoints (e.g. `http://169.254.169.254/latest/meta-data/` or `http://localhost:5432`) into the address query field.
* *Result*: **Blocked / Safe**. The target search URL is hardcoded to `nominatim.openstreetmap.org`. The user input query string is fully URL-encoded and treated as a search string by Nominatim. The server does not attempt to resolve or request the injected URL directly.
* *Evidence*: [geocoding.ts](file:///d:/Project/src/lib/location/geocoding.ts#L55) defines the request target explicitly:
  ```typescript
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;
  ```

### 2.2 Reverse Geocoding Parameter Tampering
* *Attack Vector*: Injecting string commands or private IP ranges into `lat` and `lng` parameters.
* *Result*: **Blocked / Safe**. The geocoding service enforces coordinate checks before constructing the reverse search query. Any values outside the valid geographic bounds (-90 to 90 for latitude, -180 to 180 for longitude) or containing non-numeric strings are rejected immediately.
* *Evidence*: [geocoding.ts](file:///d:/Project/src/lib/location/geocoding.ts#L24-L47) enforces the boundary check:
  ```typescript
  if (numLat < -90 || numLat > 90) return { valid: false, error: 'Latitude error...' };
  if (numLng < -180 || numLng > 180) return { valid: false, error: 'Longitude error...' };
  ```

### 2.3 Turnstile & Resend API Parameter Poisoning
* *Attack Vector*: Tampering with API key parameters or remote IP headers to force loopback requests.
* *Result*: **Blocked / Safe**. Connection targets are hardcoded, and the API endpoints do not follow user-supplied redirect rules.

---

## 3. Findings & Recommendation

* **Status**: **PASSED**
* **Vulnerabilities Found**: 0 SSRF entry points.
* **Remediation**: None required. Hardcoded request destinations and parameter boundary checks prevent internal network exposure.
