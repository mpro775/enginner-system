# Admin Intelligence V2 — Execution Pack

هذه الحزمة مقسمة لتخفيف الحمل على وكيل التنفيذ ومنع خلط التعديلات التشغيلية مع التحليلات/UI.

## ترتيب التنفيذ

1. **00_MASTER_EXECUTION_CONTRACT.md** — اقرأه في بداية كل جلسة/Pass.
2. **01_ANALYTICS_INTEGRITY_AND_BACKEND_FOUNDATION.md** — correctness + Admin-only analytics foundation.
3. **02_ADMIN_OPERATIONS_DASHBOARD_V2.md** — فصل Admin Dashboard مع حفظ Dashboard الأدوار الأخرى.
4. **03_ANALYTICS_CENTER_AGING_PERIOD_HEATMAPS.md** — KPI/Aging/Comparisons/Heatmaps.
5. **04_PREVENTIVE_MAINTENANCE_INTELLIGENCE.md** — compliance/upcoming/calendar.
6. **05_MACHINE_INTELLIGENCE_REPEAT_FAILURE.md** — machine profile/history/repeat failures.
7. **06_ADMIN_SEARCH_REQUESTS_ACTIVITY_UX.md** — global search/filters/quick peek/command center/activity.
8. **07_ADMIN_NAVIGATION_AND_VISUAL_POLISH.md** — sidebar/breadcrumbs/skeletons/empty states/micro interactions.
9. **08_FINAL_VERIFICATION_AND_CLOSURE.md** — regression/security/correctness closure.
10. **09_OPTIONAL_ENGINEER_DRAFT_AUTOSAVE.md** — اختياري فقط، لأنه يخص Engineer وليس Admin.

## طريقة الاستخدام مع وكيل AI

أعطه ملفًا واحدًا فقط في كل مرة مع الكود الحالي للمشروع، واطلب منه:

```text
نفذ هذا الملف فقط.
لا تبدأ الملف التالي.
التزم بحدود النطاق والممنوعات.
عند الانتهاء أعطني Final Report حسب القالب داخل الملف.
لا تعمل commit إلا إذا طلبت منك.
```

بعد مراجعة تقرير Pass الحالي، انتقل للملف التالي.

## أهم Gate

إذا تغيرت Dashboard المهندس أو دورة Create/Stop/Complete بسبب أي Pass، توقف واعتبر التنفيذ Regression قبل الانتقال للمرحلة التالية.
