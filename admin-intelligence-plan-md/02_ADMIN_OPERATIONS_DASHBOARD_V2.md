# PASS 02 — ADMIN OPERATIONS DASHBOARD V2

## الهدف

تحويل Dashboard الـAdmin إلى **Operations Center** حقيقية، مع إبقاء Dashboard جميع الأدوار الأخرى كما هي.

اقرأ `00_MASTER_EXECUTION_CONTRACT.md` وPass 01 قبل التنفيذ.

## الملفات الحالية المهمة

```text
frontend/src/pages/Dashboard.tsx
frontend/src/components/shared/StatCard.tsx
frontend/src/services/statistics.ts
frontend/src/store/auth.ts
frontend/src/types/index.ts
backend/src/modules/analytics/*
backend/src/modules/statistics/statistics.service.ts
```

## 1. فصل Dashboard حسب الدور

لا تستبدل الصفحة الحالية مباشرة.

أنشئ مثلًا:

```text
frontend/src/pages/dashboard/StandardDashboard.tsx
frontend/src/pages/dashboard/AdminOperationsDashboard.tsx
```

وانقل Dashboard الحالية إلى `StandardDashboard` بأقل تعديل ممكن.

اجعل `Dashboard.tsx` dispatcher فقط.

### Regression شرط حاسم

ENGINEER/CONSULTANT/MAINTENANCE_MANAGER وغيرهم يجب ألا يتحولوا إلى AdminOperationsDashboard.

`GET /statistics/dashboard` الحالي يبقى مستخدمًا للـStandard Dashboard.

## 2. Operations Dashboard API

أضف endpoint Admin-only مناسب، مثال:

```http
GET /analytics/operations-dashboard
```

### Response مطلوب على الأقل

```ts
{
  totalRequests,
  openRequests,
  emergencyOpen,
  stoppedRequests,
  overduePreventive,
  upcomingPreventive7Days,
  unresolvedComplaints,
  repeatFailureMachines,
  avgCompletionTimeHours,
  preventiveCompliance,
  comparisons: {
    totalRequests,
    emergencyRequests,
    avgCompletionTime,
    preventiveCompliance
  }
}
```

لا تجعل frontend يجمع 15 request منفصلًا إذا يمكن للbackend إرجاع snapshot موحد للDashboard.

## 3. KPI Row

اعرض كروت واضحة ومحدودة:

- إجمالي الطلبات.
- الطلبات المفتوحة.
- الطارئة المفتوحة.
- الطلبات المتوقفة.
- متوسط زمن إنجاز الطلب.
- الالتزام بالصيانة الوقائية.

كل KPI يدعم إن توفر:

```text
current value
previous comparable value
change %
trend direction
```

### قواعد اللون

لا تعتبر كل انخفاض جيدًا أو كل ارتفاع سيئًا.

مثلاً:

- Emergency ↓ = إيجابي.
- Completion time ↓ = إيجابي.
- Preventive compliance ↑ = إيجابي.
- Overdue ↑ = سلبي.

## 4. Attention Center — يحتاج انتباهك الآن

قسم رئيسي بعد KPIs، وليس مجرد notification list.

أضف عناصر:

- طوارئ مفتوحة.
- طلبات متوقفة.
- طلبات عمرها >= 72 ساعة.
- مهام وقائية متأخرة.
- مهام تستحق خلال 7 أيام.
- بلاغات غير معالجة حسب status الموجود فعليًا في schema/service.
- آلات ذات أعطال متكررة.

كل عنصر قابل للنقر إلى صفحة ذات معنى.

إذا Filters الحالية لا تدعم exact target، استخدم query string متوافق أو أضف filter read-only صغير في Pass 06، لكن لا تخترع route ميتة.

## 5. Operational charts

في Dashboard نفسها لا تكثر الرسوم.

المفضل:

- Trend line للطلبات عبر الزمن.
- Small bar/donut لتوزيع status/type.
- Aging summary صغير.
- Top recurring failures مختصر.

التعمق يكون في Analytics Center لاحقًا.

## 6. Loading UX

لا تستخدم full-page `PageLoader` للAdmin Dashboard الجديدة.

أنشئ skeletons للكروت والرسوم بحيث تبقى بنية الصفحة ثابتة.

StandardDashboard لغير Admin لا يجب تغييرها في هذا Pass إلا إذا كان استخراج الملف يتطلب imports بسيطة.

## 7. Empty/Error states

أمثلة:

```text
لا توجد طلبات طارئة مفتوحة.
لا توجد مهام وقائية متأخرة — جميع المهام ضمن الموعد.
لا توجد بيانات كافية للمقارنة بالفترة السابقة.
```

Error في Widget واحد لا يجب أن يسقط Dashboard كلها إن أمكن.

## 8. Frontend services

أنشئ:

```text
frontend/src/services/analytics.ts
```

مع typed contracts وعدم استخدام `any` للresponse الأساسية.

## 9. ممنوع

- إزالة `Dashboard.tsx` الحالي دون حفظه كStandard behavior.
- تغيير Engineer dashboard data.
- فتح analytics لغير Admin.
- تعديل Roles enum.
- ربط Branch logic.

## 10. Verification

- Admin `/app/dashboard` -> Operations V2.
- Engineer `/app/dashboard` -> نفس dashboard السابقة.
- Consultant -> نفس behavior السابق.
- Admin analytics endpoint -> 200.
- Engineer analytics endpoint -> 403.
- Backend build PASS.
- Frontend build PASS.

## Acceptance Criteria

- [ ] Admin dashboard منفصلة فعليًا.
- [ ] StandardDashboard محفوظة.
- [ ] Attention Center موجود وقابل للتنقل.
- [ ] KPI comparisons ظاهرة بطريقة صحيحة.
- [ ] Skeletons للAdmin dashboard.
- [ ] لا regression للأدوار الأخرى.
