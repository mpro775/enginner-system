# PASS 04 — PREVENTIVE MAINTENANCE INTELLIGENCE & CALENDAR

## الهدف

إضافة طبقة قراءة وتحليل للصيانة الوقائية للـAdmin بدون تغيير Scheduled Tasks workflow أو scheduler.

## الملفات الحالية المهمة

```text
backend/src/modules/scheduled-tasks/scheduled-tasks.service.ts
backend/src/modules/scheduled-tasks/scheduled-tasks-scheduler.service.ts
backend/src/modules/scheduled-tasks/schemas/scheduled-task.schema.ts
frontend/src/pages/admin/ScheduledTasksManagement.tsx
frontend/src/services/scheduled-tasks.ts
frontend/src/components/ui/calendar.tsx
backend/src/modules/analytics/*
```

## 1. لا تغير Workflow

ممنوع تغيير semantics لـ:

- create scheduled task.
- assign/accept.
- generated maintenance request.
- recurrence.
- complete/cancel existing behavior.
- scheduler.

التحليل يجب أن يقرأ البيانات فقط.

## 2. ملاحظة side-effect مهمة

راجع `ScheduledTasksService.findAll()` لأن القراءة الحالية قد تستدعي `updateOverdueTasks()`.

Analytics endpoints الجديدة يجب ألا تعتمد على side-effect من GET list لتحديد الأرقام.

إما:

- تحسب overdue analytically من scheduled date/status، أو
- تعتمد على status المخزن مع scheduler موثوق، مع توثيق ذلك.

لا تجعل endpoint التحليلي يغير statuses.

## 3. Preventive Summary API

أضف Admin-only endpoint مثل:

```http
GET /analytics/preventive/summary
```

يرجع للفترة المحددة:

```ts
{
  scheduledDue,
  completed,
  overdue,
  cancelled,
  upcoming,
  compliancePercent,
  completedOnTime? // فقط إذا يمكن حسابه بدقة من البيانات الحالية
}
```

لا تضف `completedOnTime` إذا البيانات لا تدعمه بدقة.

## 4. Compliance Formula

استخدم التعريف الذي ثُبت في Pass 01.

لا تغيره بين Dashboard وAnalytics وCalendar.

## 5. Upcoming 7 Days

أضف query/read model يعيد المهام التي scheduled date ضمن:

```text
[now, now + 7 days]
```

مع:

- task code.
- title.
- date.
- engineer إن وجد.
- location.
- department.
- system.
- machine.
- status.

## 6. Calendar API

مثال:

```http
GET /analytics/preventive/calendar?year=2026&month=8
```

أو range-based:

```text
fromDate
toDate
```

يفضل range لأنه يدعم Week/Month بنفس العقد.

## 7. Admin Calendar UI

أضف View جديدة للAdmin:

```text
Month
Week
```

Statuses بصريًا:

- pending.
- completed.
- overdue.
- cancelled.

لا تعتمد على اللون فقط؛ استخدم label/icon أيضًا لتحسين accessibility.

عند النقر على مهمة:

- افتح details/drawer أو route الحالي.
- لا تنشئ workflow جديد.

## 8. Dashboard integration

اربط:

- overdue preventive count.
- upcoming 7 days.
- compliance.

بالـAdmin Operations Dashboard من Pass 02.

لا تكرر calculations مختلفة في frontend.

## 9. Empty states

أمثلة:

```text
لا توجد مهام وقائية متأخرة — جميع المهام ضمن الموعد.
لا توجد صيانة وقائية مجدولة خلال الأيام السبعة القادمة.
```

## 10. Verification

يدويًا اختر شهرًا معروفًا وقارن:

- scheduled count.
- completed count.
- overdue count.
- cancelled.

تحقق أن deleted scheduled tasks لا تدخل.

## Acceptance Criteria

- [ ] Preventive analytics read-only.
- [ ] workflow/scheduler untouched functionally.
- [ ] compliance موحدة مع Pass 01.
- [ ] upcoming 7 days صحيحة.
- [ ] Month/Week calendar موجودة للAdmin.
- [ ] Admin-only security backend/frontend.
- [ ] builds PASS.
