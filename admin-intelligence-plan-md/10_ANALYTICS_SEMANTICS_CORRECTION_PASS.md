# ADMIN INTELLIGENCE V2 — ANALYTICS SEMANTICS CORRECTION PASS

## Status

This pass is a **targeted correction pass only**.

Do **not** treat this as a feature expansion, refactor, permission redesign, or workflow rewrite.

The Admin Intelligence V2 implementation is already structurally correct and largely complete.  
This pass exists only to correct several analytics semantics issues found during source review before granting final closure.

---

# 0. NON-NEGOTIABLE EXECUTION CONTRACT

## 0.1 Frozen Operational Behavior

The following must remain functionally unchanged:

- Maintenance request creation
- Maintenance request update
- Maintenance request stop
- Maintenance request complete
- Maintenance request lifecycle/status semantics
- Scheduled maintenance lifecycle
- Complaint lifecycle
- Engineer dashboard behavior
- Consultant dashboard behavior
- Existing user scoping
- Existing role definitions
- Existing role permissions
- Existing write endpoints
- Existing audit generation
- Multi-branch architecture
- Any current business rule unrelated to analytics

Do not modify any operational write path unless required to fix a separately proven bug outside this pass.

---

## 0.2 Admin Intelligence Scope

All new analytics and intelligence endpoints introduced for this phase remain:

```ts
@Roles(Role.ADMIN)
```

Do not expose them to:

- ENGINEER
- CONSULTANT
- MAINTENANCE_MANAGER
- MAINTENANCE_SAFETY_MONITOR
- PROJECT_MANAGER

Do not add:

```text
Executive
Branch Manager
Regional Manager
Analytics Viewer
```

Role/visibility architecture is explicitly deferred.

---

## 0.3 Standard Dashboard Protection

The current split must remain:

```text
ADMIN
→ AdminOperationsDashboard

NON-ADMIN
→ StandardDashboard
```

Do not merge the two dashboards.

Do not replace `StandardDashboard`.

Do not move Admin widgets into the shared non-admin dashboard.

---

# 1. PRIMARY CORRECTION — SEPARATE SNAPSHOT METRICS FROM PERIOD METRICS

## Problem

Current analytics reuse a period-scoped request match for both:

1. metrics that describe events occurring during a selected period
2. metrics that describe the current operational state

This creates incorrect results for old but still-active records.

Example:

```text
Request opened 45 days ago
Status = STOPPED
Still unresolved
```

If the default analytics period is the last 30 days, the request may disappear from:

- Open Requests
- Emergency Open
- Stopped Requests
- Aging
- Attention Center

This is semantically incorrect.

---

## Required Architecture

Create a clear distinction between:

### A. Flow / Period Metrics

These describe events or performance within a selected date range.

Examples:

- Requests created in period
- Emergency requests created in period
- Completed requests in period
- Average completion duration for completed records
- Completion rate
- Trends
- Rankings
- Heatmaps
- Period comparison
- Repeat failure comparison

These MAY use:

```text
createdAt between period.from and period.to
```

or the appropriate event timestamp defined for the KPI.

---

### B. Snapshot / Current-State Metrics

These describe what is true **now**.

Examples:

- Open requests now
- Emergency open now
- Stopped requests now
- Current aging
- Current unresolved complaints
- Current overdue preventive tasks
- Current attention items

These MUST NOT be restricted by the analytics period's `createdAt`.

They should operate on the current active state.

---

# 2. FIX OPERATIONS DASHBOARD SNAPSHOT COUNTERS

Review:

```text
backend/src/modules/analytics/analytics.service.ts
```

especially:

```text
getOperationsDashboard()
```

and any helper such as:

```text
getRequestMetrics()
requestMatch()
```

---

## 2.1 Open Requests

Current operational open count must represent all active open requests.

Expected semantic:

```text
deletedAt = null
AND status != COMPLETED
```

or the project's exact equivalent for active/open statuses.

Do not constrain by:

```text
createdAt >= currentPeriodStart
```

for the "Open now" KPI.

---

## 2.2 Emergency Open

Expected semantic:

```text
deletedAt = null
AND maintenanceType = EMERGENCY
AND status IN [IN_PROGRESS, STOPPED]
```

Use the project's actual enum values.

Do not limit by creation date.

---

## 2.3 Stopped Requests

Expected semantic:

```text
deletedAt = null
AND status = STOPPED
```

No selected-period creation filter.

---

## 2.4 Attention Center

The following attention items must represent the **current unresolved condition**, not only records created during the current analytics period:

- emergency open
- stopped requests
- long-running open requests
- overdue preventive tasks
- unresolved complaints
- repeat-failure machines, where applicable to the chosen repeat-failure window

---

# 3. FIX AGING ANALYSIS

## Problem

Current aging may inherit the selected analytics period and therefore exclude very old open requests.

That defeats the purpose of aging.

---

## Required Semantic

Aging must include **all currently open requests**:

```text
deletedAt = null
AND status != COMPLETED
```

Then calculate age using:

```text
now - openedAt
```

or the project's canonical request-opening timestamp.

---

## Required Buckets

Use the existing agreed buckets:

```text
< 4 hours
4–24 hours
1–3 days
> 3 days
```

Ensure boundary handling is deterministic.

Example:

```text
exactly 4h → 4–24h
exactly 24h → 1–3 days
exactly 72h → >3 days
```

or document another consistent convention.

---

## Oldest Open Requests

The "Oldest Open Requests" list must use the same unrestricted current-open dataset.

Sort by:

```text
openedAt ASC
```

or equivalent oldest-first order.

Do not restrict this list to the current 30-day period.

---

# 4. FIX UNRESOLVED COMPLAINTS

## Problem

The current Attention Center unresolved complaint count may be limited to complaints created during the selected period.

Old unresolved complaints must not disappear.

---

## Required Semantic

Use the project's unresolved statuses, expected approximately as:

```text
deletedAt = null
AND status IN [NEW, IN_PROGRESS]
```

No creation-date restriction for the current unresolved count.

If a separate period KPI is needed later, keep that as a different metric with a different label.

---

# 5. FIX CURRENT OVERDUE PREVENTIVE TASKS

## Problem

An old pending preventive task can disappear if its scheduled date is outside the selected analytics period.

---

## Required Semantic

For "Overdue now":

```text
scheduledDate < startOfTomorrow(systemTimezone)
AND status NOT IN [COMPLETED, CANCELLED]
```

Use the actual scheduled date representation currently used by the project.

Do not restrict overdue-now by the selected analytics month/30-day range.

---

## Important

Do not add a write side effect.

Analytics must remain read-only.

Do not call or reuse logic that changes task statuses merely because analytics were opened.

---

# 6. FIX EMERGENCY OPEN CARD DRILL-DOWN

## Problem

The Dashboard value currently represents all open emergency requests, while the card link filters only `status=in_progress`.

Example:

```text
4 in progress
1 stopped
Dashboard = 5
Drill-down = 4
```

This is unacceptable.

---

## Required Fix

Add/support a read-only request filter for open status semantics, for example:

```text
openOnly=true
```

Backend meaning:

```text
status IN [IN_PROGRESS, STOPPED]
```

Then use the card route:

```text
/app/requests?maintenanceType=emergency&openOnly=true
```

or the project's final equivalent.

---

## Acceptance Rule

The number shown on the KPI/attention card must equal the result count produced after the user clicks the card using the same semantic filter.

---

# 7. REMOVE MISLEADING HISTORICAL COMPARISONS FROM SNAPSHOT KPIs

## Problem

Some cards compare a current-state KPI to a historical flow KPI.

Example:

```text
Card value: Emergency Open Now
Comparison: Emergency Requests Created Previous Period
```

These are not the same metric.

---

## Rule

Do not show a historical comparison for a snapshot KPI unless the project actually stores reliable historical state snapshots.

Current schema does not provide sufficient evidence to reconstruct exact historical states such as:

```text
How many requests were open at the end of last month?
How many requests were stopped at a historical point in time?
How many overdue tasks existed exactly at the previous period boundary?
```

---

## Snapshot KPIs That Should NOT Show Misleading Period Comparison

Unless a true historical-state mechanism exists:

- Open Requests Now
- Emergency Open Now
- Stopped Requests Now
- Current Overdue Preventive
- Current Unresolved Complaints
- Current Aging buckets

Remove misleading arrows/percentages from these cards.

---

## Period KPIs That MAY Show Comparison

Keep current-vs-previous period comparison for metrics that are reconstructible correctly from event data:

- Requests created
- Emergency requests created
- Completed requests
- Average completion duration
- Completion rate
- Preventive compliance for completed/due work within each closed comparable period
- Repeat failures
- Trends/rankings based on period events

---

# 8. FIX PREVENTIVE COMPLIANCE DENOMINATOR

## Problem

Future tasks inside the selected calendar/month range may currently be counted in the compliance denominator even though they are not due yet.

Example:

```text
Today: 29 Aug
Task scheduled: 31 Aug
```

It must not reduce today's compliance.

---

## Required Definition

For a period that includes the current day/future dates:

```text
Due Tasks =
non-cancelled preventive tasks
whose scheduledDate <= today
and scheduledDate belongs to the relevant calculation window
```

Then:

```text
Preventive Compliance =
Completed Due Tasks
/
All Due Tasks
* 100
```

---

## Cancelled Tasks

Cancelled tasks must remain excluded from the denominator unless the project documentation explicitly defines otherwise.

Do not silently change this rule elsewhere.

---

## Zero Denominator

If:

```text
dueTasks = 0
```

return a documented safe value.

Preferred options:

```text
null
```

and render:

```text
لا توجد مهام مستحقة
```

or:

```text
100
```

only if this convention is already established.

Do not return NaN or Infinity.

---

# 9. SEPARATE "UPCOMING NEXT 7 DAYS" FROM SELECTED CALENDAR PERIOD SUMMARY

## Problem

The preventive calendar summary can display an "Upcoming 7 Days" number based on today even when the admin is browsing a different month.

Example:

```text
User viewing January 2026
Upcoming card still represents August 2026
```

This is contextually misleading.

---

## Required UX

### Operations Dashboard

It is valid to show:

```text
Upcoming Preventive Maintenance — Next 7 Days
```

because the dashboard is about the current operational state.

---

### Preventive Calendar / Selected Period Summary

Show only values tied to the selected period, such as:

- Scheduled in selected period
- Completed
- Overdue
- Cancelled
- Compliance

Do not show a global "next 7 days from today" KPI in a historical/future selected-month summary unless clearly separated and labeled as a global current widget.

Preferred approach: remove it from the selected-period summary.

---

# 10. VERIFY PERIOD COMPARISON SEMANTICS

For each comparison KPI, verify that:

```text
currentMetric
```

and:

```text
previousMetric
```

are calculated using the same KPI definition.

---

## Example

Correct:

```text
Emergency requests created Aug 1–Aug 31
vs
Emergency requests created Jul 1–Jul 31
```

Incorrect:

```text
Emergency currently open
vs
Emergency created last month
```

---

## Month-Length Handling

If using calendar-month comparison:

```text
Current calendar month
vs
Previous calendar month
```

is acceptable.

If using rolling-window comparison:

```text
Last 30 days
vs
Previous 30 days
```

is acceptable.

Do not mix both models silently.

Document which one each endpoint uses.

---

# 11. TIMEZONE CONSISTENCY

All current-state and period calculations must consistently use the configured system timezone.

Review:

- today
- start of day
- tomorrow
- week boundaries
- month boundaries
- heatmap hour/day extraction
- upcoming 7 days
- current/previous period boundaries
- preventive due date calculations

Do not calculate some metrics in UTC and others in local time.

Use a single canonical timezone source already established by the project.

---

# 12. DO NOT REGRESS EXISTING ANALYTICS INTEGRITY FIXES

Preserve the already-correct changes:

## Soft Delete

All relevant analytics datasets:

```text
deletedAt = null
```

---

## Top Failing Machines

`top-failing-machines` must remain based on emergency maintenance:

```text
maintenanceType = EMERGENCY
```

Do not revert to counting all preventive + emergency maintenance as failures.

---

# 13. ADMIN GLOBAL SEARCH — NO CHANGE UNLESS REQUIRED

The Admin Global Search implementation is currently acceptable.

Do not redesign it in this pass.

Preserve:

- Admin-only backend authorization
- grouped results
- request search
- machine search
- complaint search
- user search
- current result caps
- current debounce
- `Ctrl + K`

Only fix it if a build/type error appears.

---

# 14. MACHINE INTELLIGENCE — NO FEATURE EXPANSION

The current Machine Intelligence implementation is acceptable.

Preserve:

- machine profile
- maintenance history
- emergency count
- preventive count
- average completion time
- failures 30/90 days
- repeat failure comparison
- calculated severity only

Do not add persisted fields such as:

```text
healthScore
repeatFailureState
riskScore
failurePrediction
```

No schema migration is needed for this correction pass.

---

# 15. REQUEST UX — PRESERVE CURRENT SAFE IMPLEMENTATION

Preserve:

- Admin-only quick filters
- sorting
- saved views
- column visibility
- sticky header
- quick peek
- active filter count
- clear filters
- current pagination
- Admin Command Center
- Activity Timeline

Do not modify request lifecycle actions.

---

# 16. DRAFT AUTO SAVE — PRESERVE LOCAL-ONLY IMPLEMENTATION

The optional draft auto-save has already been implemented safely.

Preserve:

```text
localStorage / IndexedDB only
```

No backend draft entity.

No draft API.

No new request status.

No operational workflow change.

Ensure the draft is removed only after successful request creation.

---

# 17. UNRELATED CLEANUP SCRIPT

A script exists:

```text
backend/scripts/remove-feb-2026-restore.ts
```

This is not part of Admin Intelligence analytics semantics.

## Required Action

Determine whether it is:

### A. Pre-existing / intentionally retained operational maintenance script

If yes:

- leave it functionally unchanged
- document that it is unrelated to this pass
- do not execute it as part of this correction

### B. Accidentally included in this change set

If yes:

- remove it from the Admin Intelligence change set/commit
- do not delete production data
- do not execute the script

This pass must never run destructive cleanup automatically.

---

# 18. LIGHTWEIGHT TESTS REQUIRED

Do not introduce a massive test suite in this correction pass.

Add focused tests around the corrected semantics.

---

## 18.1 Snapshot Open Request Test

Seed/fixture conceptually:

```text
Request A
created 45 days ago
status = STOPPED

Request B
created 2 days ago
status = IN_PROGRESS
```

Expected:

```text
Open Now = 2
Stopped Now includes A
Aging includes both
```

The 45-day-old request must not disappear.

---

## 18.2 Emergency Open Drill-down Test

Data:

```text
3 emergency IN_PROGRESS
2 emergency STOPPED
```

Expected:

```text
Emergency Open KPI = 5
openOnly emergency request query = 5
```

---

## 18.3 Old Unresolved Complaint Test

Data:

```text
Complaint created 60 days ago
status = NEW
```

Expected:

```text
Current Unresolved Complaints includes it
```

---

## 18.4 Old Overdue Preventive Test

Data:

```text
Preventive task due 40 days ago
status = PENDING
```

Expected:

```text
Current Overdue includes it
```

---

## 18.5 Future Preventive Compliance Test

Data:

```text
Task A due yesterday → completed
Task B due today → completed
Task C due tomorrow → pending
```

Expected:

```text
Due count = 2
Completed due count = 2
Compliance = 100%
```

Task C must not reduce compliance today.

---

## 18.6 Snapshot Comparison UI Test

Verify that snapshot cards do not show comparison percentages derived from unrelated period metrics.

At minimum verify:

```text
Emergency Open
Open Now
Stopped Now
```

do not display misleading historical percentages.

---

# 19. BUILD GATES — MANDATORY BEFORE CLOSURE

The previous source review confirmed syntax/transpile validity for changed files, but full builds were not verified due to unavailable dependencies in the review environment.

The implementation agent must run the real project build gates.

---

## Backend

```bash
cd backend
npm ci
npm run build
```

Expected:

```text
PASS
```

If the project has dedicated lint/test scripts that are lightweight and already standard, run them as well.

---

## Frontend

```bash
cd frontend
npm ci
npm run build
```

Expected:

```text
PASS
```

---

## Optional Existing Lightweight Tests

If already configured and fast enough:

```bash
npm test
```

or targeted tests only.

Do not introduce heavy E2E infrastructure for this pass.

---

# 20. SOURCE-LEVEL FINAL VERIFICATION

Before declaring PASS, verify:

```text
analytics.service.ts
```

contains no write operations.

Verify:

```text
admin-search.service.ts
```

contains no write operations.

Verify:

```text
scheduled-tasks.service.ts
complaints service
maintenance request create/stop/complete
```

were not semantically changed by this pass.

---

# 21. REQUIRED FINAL REPORT

The agent must return a concise final report with:

```text
ADMIN INTELLIGENCE V2 — ANALYTICS SEMANTICS CORRECTION REPORT
```

Include:

## Git State

```text
Branch:
Baseline SHA:
Final SHA:
Working tree:
```

## Corrections

Explicit PASS/FAIL for:

```text
Snapshot vs period separation
Open-now semantics
Emergency-open semantics
Stopped-now semantics
Aging all open requests
Unresolved complaints current-state
Overdue preventive current-state
Emergency card drill-down parity
Snapshot historical comparison removed/fixed
Preventive compliance due-only denominator
Calendar upcoming semantics
Timezone consistency
```

## Safety

Explicit confirmation:

```text
Request lifecycle unchanged
Scheduled task lifecycle unchanged
Complaint lifecycle unchanged
Non-admin dashboards unchanged
Existing role semantics unchanged
Admin analytics remain Admin-only
No schema migration added unless absolutely required
No destructive script executed
```

## Builds

```text
Backend build: PASS/FAIL
Frontend build: PASS/FAIL
```

## Tests

List only the focused tests actually executed.

---

# 22. FINAL ACCEPTANCE CRITERIA

This pass is considered complete only when all of the following are true:

- [ ] Old open requests are included in current open counters
- [ ] Old stopped requests are included in current stopped counters
- [ ] Aging includes all currently open requests regardless of creation date
- [ ] Old unresolved complaints remain visible in current Attention Center
- [ ] Old overdue preventive tasks remain visible in current Attention Center
- [ ] Emergency Open card count matches its drill-down result
- [ ] Snapshot metrics do not show misleading period comparisons
- [ ] Preventive compliance excludes not-yet-due future tasks
- [ ] Preventive selected-period summary does not mix in unrelated "next 7 days from today" data
- [ ] All analytics preserve `deletedAt = null`
- [ ] Top failing machines remains emergency-only
- [ ] Analytics remains read-only
- [ ] Admin-only authorization remains enforced server-side
- [ ] StandardDashboard remains behaviorally unchanged for non-admin users
- [ ] No operational workflow regression introduced
- [ ] Backend build passes
- [ ] Frontend build passes
- [ ] Focused analytics semantics tests pass
- [ ] No unrelated destructive script is executed

---

# 23. OUT OF SCOPE

Do not implement in this pass:

- Multi-branch architecture
- Branch scoping
- Role Based Dashboard V2
- Executive role
- Analytics permissions matrix
- AI
- Predictive maintenance
- IoT
- Spare parts
- Inventory
- Maintenance costs
- Vendor management
- New approval workflows
- New request statuses
- New scheduled task statuses
- Notification redesign
- Database restructuring
- Historical snapshot warehouse

These may be handled in later phases after client architecture decisions.

---

# FINAL EXECUTION RULE

The goal of this pass is:

> **Make the new Admin Intelligence numbers semantically correct without changing how the maintenance system operates.**

If a proposed fix requires touching request lifecycle logic, scheduled maintenance lifecycle logic, complaint lifecycle logic, or non-admin permission semantics, stop and solve it at the analytics/read layer instead.
