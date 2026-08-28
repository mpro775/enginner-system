# PASS 01 — ANALYTICS INTEGRITY & BACKEND FOUNDATION

## الهدف

إنشاء أساس آمن وصحيح لكل التحليلات الجديدة قبل بناء UI. هذا Pass Backend-first ولا يغير عمليات الصيانة.

اقرأ أولًا `00_MASTER_EXECUTION_CONTRACT.md` والتزم به حرفيًا.

## الملفات الحالية ذات الصلة

```text
backend/src/modules/statistics/statistics.service.ts
backend/src/modules/statistics/statistics.controller.ts
backend/src/modules/statistics/dto/statistics-filter.dto.ts
backend/src/modules/maintenance-requests/schemas/maintenance-request.schema.ts
backend/src/modules/scheduled-tasks/schemas/scheduled-task.schema.ts
backend/src/app.module.ts
```

## 1. تدقيق correctness الحالي

### 1.1 Soft deleted

راجع كل Aggregation في `StatisticsService`.

كل statistic تخص البيانات النشطة يجب أن تستبعد:

```ts
deletedAt: null
```

لا تعتمد على افتراض أن Mongoose سيستبعد soft deleted تلقائيًا.

يفضل توحيد ذلك داخل builder/helper بدل تكراره.

### 1.2 Top Failing Machines

راجع `getTopFailingMachines()` الحالي.

اسم **failing** يعني في هذه المرحلة:

```text
maintenanceType = emergency
AND deletedAt = null
```

لا تحسب الصيانة الوقائية كـfailure.

إذا كان endpoint الحالي مستخدمًا في واجهة قائمة، حافظ على response contract قدر الإمكان.

### 1.3 Average Completion Time

التعريف المعتمد حاليًا:

```text
closedAt - openedAt
```

للطلبات:

```text
status = completed
closedAt exists
```

اسم UI المفضل بالعربي:

**متوسط زمن إنجاز الطلب**

ولا تدّعِ أنه wrench-time industrial MTTR دقيق إذا لا توجد `workStartedAt`/pause intervals.

## 2. KPI Definitions ثابتة

أنشئ ملف types/helpers أو وثّق في service definitions التالية:

### Open requests

```text
status in [IN_PROGRESS, STOPPED]
```

ولا تعتبر completed مفتوحة.

### Emergency open

```text
maintenanceType = EMERGENCY
AND status != COMPLETED
```

### Aging

```text
NOW - openedAt
```

Buckets:

```text
< 4h
4h <= age < 24h
24h <= age < 72h
>= 72h
```

### Repeat failure

Emergency requests فقط.

Default comparison:

```text
current 30 days
vs previous 30 days immediately before it
```

### Preventive compliance

ثبّت تعريفًا واحدًا قبل كتابة الكود. المفضل:

```text
completed due preventive tasks / all due preventive tasks excluding cancelled * 100
```

حيث due يعني scheduled date <= end of selected period.

وثّق بوضوح تعامل `cancelled` ولا تغير status data نفسها.

## 3. إنشاء Analytics Module

أنشئ module جديد Admin-only، مثال:

```text
backend/src/modules/analytics/
  analytics.module.ts
  analytics.controller.ts
  analytics.service.ts
  dto/analytics-filter.dto.ts
```

يمكن إضافة services أخرى لاحقًا بدل تضخيم ملف واحد.

سجله في:

```text
backend/src/app.module.ts
```

## 4. Security Contract

على controller الجديد:

```ts
@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
```

أو equivalent يضمن أن **كل** endpoints Admin-only افتراضيًا.

لا تعتمد على frontend route protection وحدها.

### Smoke permissions

تحقق:

```text
ADMIN     -> 200
ENGINEER  -> 403
CONSULTANT -> 403
```

على endpoint تجريبي/أول endpoint يضاف.

## 5. Filter Contract

صمم DTO مشترك يدعم بدون overengineering:

```text
fromDate?
toDate?
locationId?
departmentId?
systemId?
machineId?
engineerId?
```

لكن لا تضف branchId الآن.

Validate IDs/dates باستخدام class-validator كما في المشروع.

## 6. Date utilities

أضف helper مركزي للحسابات:

- start/end of selected period.
- previous comparable period.
- start of day/month.
- last N days.

لا تكرر Date arithmetic في كل function.

ممنوع `now.setHours()` على object يُعاد استخدامه بما يسبب mutation bugs.

## 7. Cache

المشروع يستخدم cache في Statistics.

يمكن استخدام Cache على analytics reads القصيرة، لكن:

- مفتاح cache يشمل filters.
- TTL قصير (مثل 30–60 ثانية) يكفي.
- لا تجعل correctness يعتمد على cache.

## 8. Performance

لا تضف indexes عشوائية.

Schema الحالي يحتوي بالفعل على indexes مهمة:

```text
engineerId + status
locationId + departmentId
systemId + machineId
maintenanceType
status
createdAt
openedAt
deletedAt
```

وScheduledTask يحتوي indexes للتاريخ/status.

إذا احتجت index جديدًا، اذكر في التقرير سبب الحاجة والاستعلام الذي يستفيد منه.

## 9. لا تنفذ في هذا Pass

- Dashboard UI.
- Heatmaps UI.
- Calendar UI.
- Machine profile UI.
- Global search.
- تعديل الأدوار.
- تعديل Request lifecycle.

## 10. اختبارات خفيفة

نفذ:

```bash
cd backend
npm run build
```

ثم smoke checks إن بيئة التشغيل متاحة.

ركز على:

- soft deleted لا يدخل في analytics.
- preventive لا يدخل في failing machines.
- Admin guard فعال.

## Acceptance Criteria

- [ ] Analytics module موجود ومربوط.
- [ ] جميع endpoints الجديدة Admin-only من backend.
- [ ] soft-deleted requests مستبعدة من analytics النشطة.
- [ ] top failing = emergency failures، لا كل maintenance.
- [ ] KPI definitions موحدة ومثبتة.
- [ ] date/period helpers مركزية.
- [ ] لا تغيير في create/update/stop/complete.
- [ ] backend build PASS.
