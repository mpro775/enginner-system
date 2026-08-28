# PASS 03 — ADMIN ANALYTICS CENTER: KPI + AGING + PERIOD + HEATMAPS

## الهدف

إنشاء صفحة Admin مستقلة للتحليل التفصيلي. Dashboard تبقى مختصرة، وهذه الصفحة هي drill-down.

## Routes المقترحة

Frontend:

```text
/app/admin/analytics
```

Backend تحت:

```text
/analytics/*
```

وكلها Admin-only.

## 1. Analytics Center Layout

صفحة واحدة منظمة Sections/Tabs وليس عشر صفحات مشتتة.

اقتراح tabs:

```text
نظرة عامة
الأداء
التراكم الزمني
التوزيعات
الأنماط الزمنية
```

## 2. KPI Set

اعرض:

- Average Completion Time.
- Min Completion Time.
- Max Completion Time.
- Open Request Average Age.
- Completion Rate.
- Stop Rate.
- Emergency / Preventive Ratio.
- Preventive Compliance.
- Overdue Preventive Tasks.
- Requests per Engineer.
- Requests per Department.
- Requests per Location.
- Requests per System.
- Requests per Machine.

استفد من endpoints الحالية عندما تكون صحيحة ومحمية Admin، ولا تنسخ نفس aggregation بلا حاجة.

## 3. استغلال APIs الموجودة

راجع واستفد من:

```text
/statistics/by-engineer
/statistics/by-location
/statistics/by-department
/statistics/by-system
/statistics/top-failing-machines
/statistics/trends
/statistics/response-time
```

لا تزيل guards الحالية.

يمكن تحسين frontend لاستعمال `by-department` و`response-time` الموجودين بدل بناء endpoint مكرر.

## 4. Aging Analysis

أضف endpoint أو response section يعيد:

```ts
{
  totalOpen,
  buckets: {
    under4Hours,
    fourTo24Hours,
    oneTo3Days,
    threeDaysOrMore
  },
  oldestOpenRequests: [
    { id, requestCode, openedAt, ageHours, status, machine, location }
  ]
}
```

### UI

- Stacked/segmented horizontal bar.
- رقم كل bucket.
- >=72h بلون attention واضح.
- جدول/قائمة Oldest Open Requests.

عند الضغط على bucket، انقل Admin إلى Requests مع filter مناسب عند توفره بعد Pass 06.

## 5. Period Comparison Engine

أنشئ helper يعيد:

```ts
{
  current,
  previous,
  absoluteChange,
  percentChange,
  comparable: boolean
}
```

### حالات edge

إذا previous = 0:

- لا تقسم على صفر.
- استخدم `percentChange: null` أو معنى واضح.

إذا لا توجد بيانات كافية:

- لا تعرض `Infinity%`.

### KPIs المطلوبة للمقارنة

- Total Requests.
- Emergency Requests.
- Avg Completion Time.
- Preventive Compliance.
- Overdue Preventive.
- Repeat Failures.

## 6. فلسفة Charts

التزم بهذه القاعدة:

```text
Trend       -> Line / Area
Comparison  -> Bar
Composition -> Donut
Ranking     -> Horizontal Bar
Aging       -> Stacked Bar
Time/Day    -> Heatmap
```

لا تستخدم Pie لبيانات زمنية.

## 7. Heatmap: Day × Hour

Emergency requests فقط افتراضيًا.

Backend يعيد matrix أو نقاطًا:

```ts
[{ dayOfWeek: 0..6, hour: 0..23, count }]
```

احسم day numbering مرة واحدة واكتب labels عربية صحيحة.

### Timezone

hour/day يجب أن يحسب حسب timezone الموحد للمشروع، لا UTC raw إن كانت بيانات التشغيل محلية.

## 8. Heatmap: Location × System

Backend يعيد rows/columns أو points:

```ts
[{ locationId, locationName, systemId, systemName, count }]
```

مع احترام filter period.

إذا عدد المواقع/الأنظمة كبير:

- لا ترسم 100x100 بلا حدود.
- استخدم top N + filters أو scroll واضح.

## 9. Filters

أعلى الصفحة:

- preset: هذا الشهر / الشهر السابق / آخر 30 يوم / هذا العام.
- custom from/to.
- location.
- department.
- system.
- machine إذا مناسب.

لا تضف branch.

## 10. UX

- Skeleton لكل section.
- Empty state contextual.
- Tooltip يشرح معنى KPI باختصار.
- لا تبالغ في animation.
- responsive على desktop/tablet/mobile.

## 11. Verification

اختبر أرقام sample يدويًا عبر query مباشر أو Mongo aggregation صغير إن البيئة متاحة.

تحقق من:

- deletedAt excluded.
- previous periods لا تتداخل.
- 30 days windows متجاورة وليست overlapping.
- heatmap total يساوي مجموع الطلبات المطابقة لنفس filters.

## Acceptance Criteria

- [ ] Analytics route Admin-only.
- [ ] كل KPIs الأساسية معروضة.
- [ ] Aging buckets صحيحة.
- [ ] Oldest requests موجودة.
- [ ] Period comparison لا ينتج NaN/Infinity.
- [ ] Day-hour heatmap تعمل.
- [ ] Location-system heatmap تعمل.
- [ ] chart type مناسب لطبيعة البيانات.
- [ ] builds PASS.
