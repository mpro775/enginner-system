# PASS 05 — MACHINE INTELLIGENCE & REPEAT FAILURE

## الهدف

تحويل صفحة الآلات للـAdmin من Reference Data فقط إلى مدخل لملف صحة/تاريخ الصيانة، بدون تعديل Machine schema أو workflow.

## الملفات الحالية المهمة

```text
backend/src/modules/machines/machines.controller.ts
backend/src/modules/machines/machines.service.ts
backend/src/modules/machines/schemas/machine.schema.ts
backend/src/modules/maintenance-requests/schemas/maintenance-request.schema.ts
backend/src/modules/analytics/*
frontend/src/pages/admin/ReferenceDataManagement.tsx
frontend/src/pages/admin/index.tsx
frontend/src/services/reference-data.ts
frontend/src/App.tsx
```

## 1. Machine Health API

أضف Admin-only endpoint مثل:

```http
GET /analytics/machines/:id/profile
```

يرجع:

```ts
{
  machine: {
    id,
    name,
    system,
    department?,
    location?,
    components
  },
  health: {
    totalMaintenance,
    emergencyMaintenance,
    preventiveMaintenance,
    lastMaintenanceAt,
    avgCompletionTimeHours,
    failuresLast30Days,
    failuresLast90Days
  },
  timeline: [...]
}
```

إذا Machine نفسها لا تحمل department/location مباشرة، استخرج context من العلاقات الموجودة الفعلية ولا تخترع fields في schema.

## 2. Machine Timeline

استخدم Maintenance Requests المرتبطة بـ`machineId`.

Timeline item على الأقل:

```text
request id/code
maintenance type
status
openedAt
closedAt/stoppedAt
engineer name إن متوفر
reason summary
```

رتب الأحدث أولًا مع pagination/limit معقول.

لا تحمل التاريخ الكامل غير المحدود دفعة واحدة.

## 3. Machine Profile UI

أضف route Admin-only مثل:

```text
/app/admin/machines/:id
```

من قائمة الآلات يوجد Action:

```text
عرض ملف الآلة
```

الصفحة تعرض:

- Basic information.
- Maintenance health cards.
- 30/90 day failures.
- Maintenance timeline.

## 4. Repeat Failure API

أضف endpoint مثل:

```http
GET /analytics/repeat-failures?days=30&limit=10
```

التعريف:

```text
Emergency requests only
Deleted excluded
Current N days vs immediately previous N days
```

النتيجة لكل آلة:

```ts
{
  machineId,
  machineName,
  systemName,
  currentCount,
  previousCount,
  absoluteChange,
  percentChange,
  lastFailureAt
}
```

## 5. Visual levels فقط

يمكن UI يصنف:

```text
Normal
Watch
High recurrence
```

لكن:

- لا تضف field في Machine.
- لا تحفظ المستوى في DB.
- لا تجعله business state.

اختر thresholds بسيطة موثقة وقابلة للتعديل كconstants.

## 6. Dashboard/Analytics integration

اعرض Top repeat failures في:

- Attention Center.
- Analytics Center.

ومن العنصر زر:

```text
عرض سجل الآلة
```

إلى Machine Profile.

## 7. Correctness

لا تخلط:

```text
Most maintained
```

مع:

```text
Most failing
```

الصيانة الوقائية لا تزيد failure count.

## 8. Verification

اختر آلة sample واحسب يدويًا:

- total.
- emergency.
- preventive.
- last maintenance.
- last 30.
- last 90.

تحقق من timezone boundaries في 30/90 day window.

## Acceptance Criteria

- [ ] Machine profile Admin-only.
- [ ] لا تعديل Machine schema.
- [ ] timeline paginated/limited.
- [ ] repeat failure emergency-only.
- [ ] comparison current/previous صحيح.
- [ ] no persisted health state.
- [ ] builds PASS.
