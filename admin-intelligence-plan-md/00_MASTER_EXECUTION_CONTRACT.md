# ADMIN INTELLIGENCE V2 — MASTER EXECUTION CONTRACT

## 1. الهدف

تنفيذ طبقة **Admin Intelligence / Analytics / UI-UX** متقدمة فوق نظام الصيانة الحالي بدون إعادة تصميم العمليات التشغيلية التي أثبتت نجاحها.

هذه المرحلة مخصصة للـ `ADMIN` فقط في كل ما يتعلق بالمزايا الجديدة: Operations Dashboard V2، Analytics Center، Aging، Preventive Intelligence، Machine Intelligence، Repeat Failure، Heatmaps، Period Comparison، Global Search، Admin Request UX، Activity Timeline.

## 2. قاعدة الحماية الأساسية — NON-NEGOTIABLE

يُمنع تغيير أي سلوك قائم في المسارات التشغيلية التالية إلا عند وجود Bug مثبت مستقل عن هذه الخطة:

- إنشاء طلب الصيانة.
- تعديل طلب الصيانة.
- إيقاف الطلب.
- إكمال الطلب.
- إضافة ملاحظات المهندس/الاستشاري/السلامة/مدير المشروع.
- دورة حياة البلاغات.
- دورة حياة Scheduled Tasks والصيانة الوقائية.
- حالات الطلب الحالية أو معانيها.
- الأدوار الحالية أو تعريف `Role`.
- صلاحيات الأدوار الحالية.
- Scope المهندس الحالي.
- Scope الاستشاري الحالي.
- Multi-Branch / Branch hierarchy / Executive roles.

لا نضيف في هذه المرحلة:

```text
Executive
Branch Manager
Regional Manager
Analytics Viewer
```

## 3. حماية Dashboard لغير الـAdmin

المسار الحالي:

```text
/app/dashboard
```

مشترك بين الأدوار، و`GET /statistics/dashboard` حاليًا Role-aware.

### المطلوب

- الحفاظ على Dashboard الحالية لغير `ADMIN` كما هي وظيفيًا وبصريًا قدر الإمكان.
- لا يتم تحويل `Dashboard.tsx` بالكامل إلى Admin Dashboard.
- استخرج/حافظ على المحتوى الحالي في `StandardDashboard` أو equivalent.
- أضف `AdminOperationsDashboard` منفصلًا.
- `Dashboard.tsx` يصبح Router/dispatcher بسيطًا حسب الدور.

المبدأ:

```tsx
if (user?.role === Role.ADMIN) {
  return <AdminOperationsDashboard />;
}
return <StandardDashboard />;
```

### ممنوع

- جعل الـEngineer يستدعي Admin analytics.
- إزالة role guards من endpoints الحالية.
- توحيد الجميع في Admin dashboard عبر conditional fragments كثيرة داخل ملف واحد.

## 4. Backend Architecture

المزايا الجديدة يجب أن تكون **Read-only analytics layer** قدر الإمكان.

يفضل إنشاء module جديد مثل:

```text
backend/src/modules/analytics/
  analytics.module.ts
  analytics.controller.ts
  analytics.service.ts
  dto/
```

ويمكن تقسيم الخدمات داخله إن كبر الملف:

```text
operations-dashboard.service.ts
maintenance-analytics.service.ts
preventive-analytics.service.ts
machine-analytics.service.ts
```

كل Endpoint جديد في هذه المرحلة:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
```

## 5. Frontend Architecture

يفضل إنشاء:

```text
frontend/src/pages/admin/analytics/
frontend/src/components/admin/analytics/
frontend/src/services/analytics.ts
```

مع إعادة استخدام:

- React Query.
- Recharts.
- shadcn/radix components الموجودة.
- Tailwind/design tokens الحالية.

لا تضف UI framework جديدًا.

## 6. ترتيب التنفيذ الإجباري

نفّذ الملفات بالترتيب:

1. `01_ANALYTICS_INTEGRITY_AND_BACKEND_FOUNDATION.md`
2. `02_ADMIN_OPERATIONS_DASHBOARD_V2.md`
3. `03_ANALYTICS_CENTER_AGING_PERIOD_HEATMAPS.md`
4. `04_PREVENTIVE_MAINTENANCE_INTELLIGENCE.md`
5. `05_MACHINE_INTELLIGENCE_REPEAT_FAILURE.md`
6. `06_ADMIN_SEARCH_REQUESTS_ACTIVITY_UX.md`
7. `07_ADMIN_NAVIGATION_AND_VISUAL_POLISH.md`
8. `08_FINAL_VERIFICATION_AND_CLOSURE.md`

الملف:

`09_OPTIONAL_ENGINEER_DRAFT_AUTOSAVE.md`

اختياري ومستقل، ولا يدخل ضمن Admin Intelligence الأساسية إلا بأمر صريح.

## 7. سياسة قاعدة البيانات

الأصل في هذه المرحلة:

- لا Migration.
- لا تعديل Schema لمجرد KPI محسوب.
- لا تخزين `health score` أو `repeat failure state` داخل Machine.
- لا تخزين Period comparison.
- لا تخزين Aging buckets.

هذه قيم محسوبة وقت القراءة.

يمكن إضافة Index فقط إذا أثبت Explain/الحجم الفعلي حاجته، وليس مسبقًا بلا دليل.

## 8. Timezone

أي حساب يعتمد على:

- اليوم.
- بداية الأسبوع.
- الشهر.
- Previous period.
- آخر 30/90 يومًا.
- Calendar.

يجب أن يستخدم Timezone موحدًا ومحددًا من إعداد المشروع/الخادم، وألا يعتمد بشكل عشوائي على timezone المتصفح في جزء والـNode server في جزء آخر.

وثّق الـtimezone المختار في التقرير النهائي.

## 9. Soft Delete Rule

أي KPI أو Analytics تخص البيانات الفعالة يجب أن تستبعد:

```ts
deletedAt: null
```

ما لم يكن Endpoint مخصصًا لسلة المهملات.

## 10. Testing Policy

لا نريد اختبارات ثقيلة أو إعادة بناء test suite ضخمة.

في كل Pass:

- Backend build.
- Frontend build عند وجود frontend changes.
- TypeScript errors = صفر.
- Lint targeted إن أمكن بدون تحويل lint إلى refactor واسع.
- Smoke verification للـendpoints الجديدة.
- Admin 200 / Engineer 403 للمسارات Admin-only الجديدة.
- Regression check بأن `/statistics/dashboard` لغير الـAdmin ما زال يعمل كما كان.

## 11. Git / Change Discipline

في كل ملف تنفيذ:

1. افحص `git status` قبل البدء.
2. لا تعدل ملفات غير مرتبطة.
3. لا تنظف تغييرات سابقة تخص المستخدم.
4. اعرض قائمة الملفات التي تغيرت.
5. شغّل `git diff --check`.
6. لا تعمل commit إلا إذا طُلب منك ذلك.

## 12. Definition of Done العامة

لا تعتبر المرحلة PASS إلا إذا:

- Admin يرى الميزات الجديدة.
- Engineer وغيره يحتفظون بالDashboard الحالية وسلوكها.
- Admin analytics endpoints محمية في Backend وليس فقط مخفية في UI.
- لا lifecycle operation تغير سلوكها.
- الأرقام تستبعد soft deleted.
- لا يوجد Schema rewrite.
- لا يوجد Role جديد.
- لا يوجد Multi-branch assumption.
- builds ناجحة.

## 13. تقرير كل Pass

أنه التقرير بهذه البنية:

```text
STATUS: PASS / PARTIAL / BLOCKED

Changed files:
- ...

Backend changes:
- ...

Frontend changes:
- ...

Security/role verification:
- ...

Regression verification:
- ...

Build results:
- ...

Deferred / intentionally not changed:
- ...
```
