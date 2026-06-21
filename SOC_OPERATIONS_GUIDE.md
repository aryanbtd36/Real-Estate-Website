# Aura Estates Security Operations Center (SOC) Operations Guide

This guide details the operational procedures, incident response playbooks, threat hunting guidelines, and policy tuning protocols for the Aura Estates Security Operations Center.

---

## 1. Playbooks and Incident Response Procedures

The SOAR layer automates response containment. When an alert is raised, follow these playbooks based on category.

### Playbook 1: Brute Force & Credential Stuffing Mitigation
- **Trigger**: Multiple failed logins (3+ in 1 minute) from a single IP or targeted user account.
- **Automated Actions**:
  1. Throttles IP address at the middleware layer.
  2. If credentials match a known compromised database leak, the user is marked with `mustChangePassword` status.
- **Manual Tasks**:
  - Review the audit log using the Incident Command console.
  - If the attacker is distributed (credential stuffing), check if they share a common header or geoinformation footprint.
  - Update local Threat Intelligence blacklists if needed.

### Playbook 2: Session Hijacking Response
- **Trigger**: Active session heartbeats detect a sudden change in user-agent footprint or IP address subnet during an active session state.
- **Automated Actions**:
  1. Revokes the compromised session immediately (marks status as `REVOKED` in the DB).
  2. Downgrades the source device trust score to zero.
- **Manual Tasks**:
  - Review the user's active login history.
  - Verify if the user logged in from an anomalous geolocation or TOR exit node.
  - Reach out to the user to confirm validity.

### Playbook 3: Impossible Travel Speed Containment
- **Trigger**: User performs consecutive requests from coordinates separated by a distance requiring speeds above 900 km/h.
- **Automated Actions**:
  1. Revokes all active sessions for the targeted user.
  2. Places the source IP address in the blocking registry.
- **Manual Tasks**:
  - Confirm the geocoding data and check if one of the IPs corresponds to a known VPN service provider.
  - If verified as a false positive (user logged in via a secure corporate VPN), mark the alert as `RESOLVED - FALSE_POSITIVE` and whitelist the IP block.

---

## 2. Threat Hunting and Proactive Sweep Procedures

The Threat Hunting console allows analysts to run proactive sweeps. Use these queries for hunting campaigns:

### Hunt 1: Session Footprint Anomaly Hunt
Sweeps for sessions that display minor drifts in footprints without triggering immediate revocation.
- **Parameters**: 24-hour window, target user group = ADMINS.
- **Procedure**:
  1. Filter all session records from the past 24 hours.
  2. Group by user ID and count unique User-Agents.
  3. Investigate any administrative account with more than 2 distinct User-Agent fingerprints in a single day.

### Hunt 2: Geographic Anomaly Sweep
Identifies users logging in from multiple countries within a narrow time window (e.g. 12 hours) that does not cross the travel velocity limit but is anomalous.
- **Procedure**:
  1. Run the "Impossible Travel" template hunt with custom threshold `windowHours: 12`.
  2. Correlate findings against known company travel registries.

---

## 3. False Positive Reduction & Alert Tuning

To maintain SOC efficiency, rules must be continuously calibrated:

### Rule Calibration Protocol
When an alert is confirmed as a false positive:
1. Update the alert status in the Incident Command Console to `RESOLVED` with tag `FALSE_POSITIVE`.
2. Write a detailed resolution explanation describing *why* the trigger was benign.
3. The False Positive Recommendation engine periodically aggregates these statistics.
4. Review the auto-tuning recommendation (e.g. `TUNE_RULE` recommended for rule `IMPOSSIBLE_TRAVEL_SPEED`).
5. Apply the recommendation: this loosens thresholds dynamically (e.g., increases the speed limit multiplier by 20% or adjustments to window sizes).
6. Verify rule precision changes inside the Detection Engineering screen.
