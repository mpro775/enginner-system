# PASS 07 — ADMIN NAVIGATION, BREADCRUMBS & VISUAL POLISH

## الهدف

صقل واجهة الـAdmin بعد اكتمال الوظائف، بدون إعادة تصميم عميقة أو تغيير تجربة الأدوار الأخرى.

## الملفات المهمة

```text
frontend/src/components/layout/Sidebar.tsx
frontend/src/components/layout/Header.tsx
frontend/src/components/layout/MainLayout.tsx
frontend/src/App.tsx
frontend/src/index.css
frontend/src/components/shared/*
frontend/src/pages/dashboard/AdminOperationsDashboard.tsx
frontend/src/pages/admin/analytics/*
frontend/src/pages/requests/RequestsList.tsx
frontend/src/pages/requests/RequestDetails.tsx
```

## 1. Admin Navigation Groups

`Sidebar.tsx` حاليًا قائمة مسطحة مع role filtering.

للAdmin فقط رتب بصريًا:

### العمل

- لوحة التحكم.
- طلبات الصيانة.
- البلاغات.
- الصيانة الوقائية.

### التحليل

- مركز التحليلات.
- الإحصائيات الحالية.
- التقارير.

### الإدارة

- المستخدمون.
- المواقع.
- الأقسام.
- الأنظمة.
- الآلات.

### النظام

- سجل العمليات.
- سلة المهملات.

### قاعدة مهمة

غير الـAdmin يحتفظ بالقائمة الحالية المبسطة حسب roles، ولا تظهر له Groups فارغة.

الصيانة الوقائية الحالية للConsultant لا يجب أن تختفي بسبب refactor للSidebar.

## 2. Route Protection

أضف route `admin/analytics` داخل `App.tsx`:

```tsx
<ProtectedRoute allowedRoles={[Role.ADMIN]}>
```

أي Machine Profile/Search admin routes كذلك.

UI hide + route guard + backend guard، الثلاثة مطلوبة.

## 3. Breadcrumbs

أنشئ component قابل لإعادة الاستخدام.

طبقه أولًا على Admin surfaces:

```text
لوحة التحكم / مركز التحليلات
الإدارة / الآلات / [machine name]
لوحة التحكم / طلبات الصيانة / [requestCode]
```

إذا طُبق على صفحة مشتركة، اجعله لا يغير workflow أو permissions.

## 4. Skeleton System

أنشئ skeletons بسيطة قابلة لإعادة الاستخدام:

```text
KpiCardSkeleton
ChartSkeleton
TableSkeleton
DetailSkeleton
```

استخدمها في Admin Operations/Analytics/Machine Profile/Admin requests enhancements.

لا تحول المشروع كله الآن إذا هذا سيزيد scope.

## 5. Empty States

استبدل الرسائل العامة داخل الـAdmin الجديدة برسائل سياقية:

```text
لا توجد طلبات طارئة مفتوحة.
لا توجد مهام وقائية متأخرة — جميع المهام ضمن الموعد.
لا توجد أعطال متكررة ضمن الفترة المحددة.
لا توجد بيانات كافية للمقارنة.
```

استخدم Lucide icons الموجودة بدل إضافة image library.

## 6. Micro Interactions

مسموح:

- subtle card hover.
- smooth section fade.
- lightweight number transition إن لم يسبب accessibility issue.
- chart transitions الافتراضية الخفيفة.
- drawer/dialog transitions.
- filter state feedback.
- limited emergency attention pulse.

ممنوع:

- animations مستمرة مشتتة.
- heavy animation library جديدة بلا حاجة.
- confetti.
- motion يؤخر تنفيذ actions.

احترم `prefers-reduced-motion` إن أضفت animation مخصصًا.

## 7. Responsive / RTL

اختبر على الأقل:

```text
360px
768px
1024px+
```

ركز على:

- KPI cards.
- charts.
- heatmaps scroll.
- tables.
- command palette.
- drawers.
- RTL labels/tooltips.

## 8. Accessibility

- Buttons لها labels واضحة.
- icon-only actions لديها `aria-label`.
- status لا يعتمد على اللون فقط.
- focus visible.
- dialogs قابلة للإغلاق بالكيبورد.

## 9. لا تنفذ هنا

- Draft autosave للمهندس؛ موجود في ملف اختياري مستقل.
- Role Based Dashboard.
- branch navigation.
- permissions editor.

## 10. Verification

- Admin Sidebar groups صحيحة.
- Engineer Sidebar كما كانت وظيفيًا.
- Consultant Scheduled Tasks link ما زال موجودًا حسب permission الحالي.
- mobile sidebar يعمل ويغلق بعد click كما كان.
- no route leaks.
- frontend build PASS.

## Acceptance Criteria

- [ ] Admin navigation grouped.
- [ ] non-admin navigation preserved.
- [ ] Breadcrumbs Admin surfaces.
- [ ] Skeletons بدل full-page blocking في الصفحات الجديدة.
- [ ] Contextual empty states.
- [ ] Micro interactions خفيفة.
- [ ] responsive/RTL/accessibility acceptable.
- [ ] frontend build PASS.
