# OPTIONAL — ENGINEER NEW REQUEST DRAFT AUTO-SAVE

## الحالة

**اختياري / خارج Admin Intelligence الأساسية.**

السبب: Route إنشاء الطلب الحالي:

```text
/app/requests/new
```

محمي حاليًا للـ `ENGINEER`، بينما القرار الحالي هو إبقاء تجربة غير الـAdmin مستقرة أثناء مرحلة Admin Intelligence.

نفذ هذا الملف فقط إذا تم اتخاذ قرار صريح بتفعيل تحسين UX للمهندس الآن.

## الهدف

منع فقدان نموذج طلب الصيانة عند:

- إغلاق التبويب.
- refresh.
- انقطاع مؤقت.
- navigation غير مقصود.

بدون Backend وبدون Database.

## الملف الأساسي

```text
frontend/src/pages/requests/NewRequest.tsx
```

## التنفيذ

استخدم `localStorage` أو IndexedDB إن كانت البيانات كبيرة؛ النموذج الحالي غالبًا يكفيه localStorage.

Key versioned مثل:

```text
maintenance:new-request:draft:v1:<userId>
```

احفظ:

```ts
{
  values,
  savedAt,
  version: 1
}
```

لا تحفظ:

- tokens.
- passwords.
- auth state.
- data غير مطلوبة للنموذج.

## Restore UX

عند وجود Draft صالح:

```text
لديك طلب غير مكتمل محفوظ منذ [الوقت]
[استكمال] [تجاهل]
```

لا تسترجعه صامتًا فوق نموذج جديد بدون موافقة المستخدم.

## Auto-save behavior

- debounce 500–1000ms.
- لا write مع كل keypress بلا debounce.
- عند submit ناجح: احذف draft.
- عند اختيار تجاهل: احذف draft.
- إذا انتهت جلسة المستخدم/تغير userId لا تعرض Draft مستخدم آخر.

## Cascade safety

النموذج يعتمد على:

```text
location -> department -> system -> machine
```

عند restore:

- استرجع IDs فقط بعد تحميل reference data الضرورية.
- إذا entity حُذفت/لم تعد متاحة، امسح الجزء غير الصالح وأبلغ المستخدم.
- لا ترسل form invalid إلى backend.

## لا Backend

ممنوع إنشاء:

```text
POST /drafts
Draft schema
Draft collection
```

في هذه المرحلة.

## Verification

- اكتب نصف نموذج -> refresh -> restore prompt.
- تجاهل -> draft disappears.
- submit success -> draft removed.
- user A draft لا يظهر لـuser B.
- invalid referenced machine لا يكسر الصفحة.
- frontend build PASS.

## Acceptance Criteria

- [ ] no backend change.
- [ ] versioned per-user draft.
- [ ] restore requires user choice.
- [ ] successful submit clears draft.
- [ ] cascade fields safe.
