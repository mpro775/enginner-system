# PASS 06 — ADMIN GLOBAL SEARCH + REQUESTS UX + ACTIVITY TIMELINE

## الهدف

رفع سرعة عمل الـAdmin داخل الطلبات بدون تغيير Request lifecycle أو تجربة الأدوار الأخرى.

## الملفات الحالية المهمة

```text
frontend/src/pages/requests/RequestsList.tsx
frontend/src/pages/requests/RequestDetails.tsx
frontend/src/services/requests.ts
backend/src/modules/maintenance-requests/maintenance-requests.controller.ts
backend/src/modules/maintenance-requests/maintenance-requests.service.ts
backend/src/modules/maintenance-requests/dto/filter-requests.dto.ts
backend/src/modules/audit-logs/audit-logs.service.ts
backend/src/modules/audit-logs/audit-logs.controller.ts
backend/src/modules/audit-logs/schemas/audit-log.schema.ts
frontend/src/components/layout/Header.tsx
frontend/src/App.tsx
```

## 1. Admin Global Search

أضف Backend Admin-only module/service أو endpoint:

```http
GET /admin-search?q=...
```

أو تحت analytics إن كان التنظيم أوضح.

### Search groups

- Maintenance requests by requestCode/reason relevant fields.
- Machines by name/identifier available.
- Complaints by code/fields الموجودة.
- Users by name/email إن كان Admin مسموحًا له أصلًا.

### Security

`@Roles(Role.ADMIN)` على backend.

لا تعرض password/hash/secrets/internal fields.

### Performance

- minimum query length معقول (مثلاً 2).
- limit صغير لكل group.
- debounce frontend.
- no unbounded regex scans إذا يمكن تفاديها.

لا تضف Atlas Search dependency الآن.

## 2. Command Palette

في Header للAdmin فقط:

```text
Ctrl + K
```

يفتح search dialog.

على mobile يوجد زر بحث واضح بدل الاعتماد على keyboard shortcut.

النتائج grouped ويمكن فتح entity مباشرة.

## 3. Requests Quick Filters — Admin only enhancement

في `RequestsList.tsx` حافظ على السلوك الحالي لغير Admin.

للAdmin أضف:

```text
الكل
طارئة
قيد التنفيذ
متوقفة
اليوم
هذا الأسبوع
أكثر من 24 ساعة
```

### Backend support

الفلترة الزمنية الموجودة تدعم `fromDate/toDate`.

لـ`أكثر من 24 ساعة` الأفضل إضافة filter read-only واضح مثل:

```text
openedBefore
```

أو age bucket filter، بدل جلب الصفحة ثم filtering client-side لأن ذلك يكسر pagination totals.

## 4. Saved Views

في هذه المرحلة Local Storage فقط للAdmin.

احفظ:

```text
name
filters
sorting
visibleColumns
```

لا تنشئ user-preferences collection الآن.

## 5. Table UX

أضف للAdmin:

- Sorting حقيقي ومتوافق مع server pagination عند الحقول المناسبة.
- Column visibility.
- Sticky header.
- Active filter count.
- Clear all.
- responsive behavior.

إذا sorting backend غير مدعوم حاليًا، لا تنفذ fake client sorting على page واحدة وتوهم أنه شامل. إما تضف sort DTO آمن أو اترك بعض sorting محليًا مع label واضح.

## 6. Quick Peek — Admin only

Action 👁️ في row.

يفتح Drawer/Side panel يعرض:

- requestCode.
- status.
- maintenanceType.
- machine.
- location.
- engineer.
- openedAt / age.
- reason.
- latest relevant note إن متوفر.

استخدم بيانات list الموجودة قدر الإمكان، وإذا احتجت details fetch استخدم endpoint الحالي `GET /requests/:id`.

## 7. Admin Request Command Center

في `RequestDetails.tsx`:

### للAdmin فقط

أضف header مختصر في الأعلى:

```text
requestCode
status • maintenanceType
location | department | system | machine | engineer | age
```

ثم actions الحالية فقط.

### مهم

لا تغير عرض/سلوك التفاصيل لغير Admin إلا shared cosmetic لا يؤثر على semantics.

لا تنشئ action جديد.

لا تغير شروط complete/stop/note.

## 8. Activity Timeline

Audit Logs العامة حاليًا Admin-only؛ أبقها كذلك.

لا تفتح `/audit-logs` لغير Admin.

أضف endpoint خاص بطلب واحد للAdmin، مثال:

```http
GET /requests/:id/activity
```

أو تحت analytics/admin namespace.

يقرأ `AuditLog` حيث:

```text
entity = maintenance request entity name الفعلي في audit code
entityId = request id
```

### Response sanitized

```ts
{
  action,
  actorName,
  createdAt,
  summary,
  relevantChanges?
}
```

لا تعرض raw `previousValues`/`changes` بكاملها إذا فيها بيانات غير مناسبة للواجهة.

Frontend Timeline:

```text
10:12 تم إنشاء الطلب بواسطة ...
10:31 أضيفت ملاحظة ...
14:17 اكتمل الطلب ...
```

## 9. Breadcrumbs داخل Admin context

يمكن في هذه الصفحة وضع:

```text
لوحة التحكم / طلبات الصيانة / REQUEST-CODE
```

لكن إن كان component مشتركًا فلا تسبب تغييرًا قسريًا لبقية الأدوار في هذا Pass.

## 10. Verification

- Search Admin -> works.
- Search Engineer direct URL/API -> 403.
- Quick filters totals/pagination صحيحة.
- >24h لا يعتمد على client-page-only filtering.
- Quick Peek لا يغير request.
- Activity endpoint read-only.
- complete/stop/create regression smoke.

## Acceptance Criteria

- [ ] Admin global search + Ctrl+K.
- [ ] Quick Filters Admin-only.
- [ ] Saved Views local only.
- [ ] Quick Peek موجود.
- [ ] Admin Command Center موجود.
- [ ] Activity Timeline من Audit Log بدون فتح audit العام.
- [ ] operational actions unchanged.
- [ ] builds PASS.
