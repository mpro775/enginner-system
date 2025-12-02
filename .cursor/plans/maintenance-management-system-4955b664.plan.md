<!-- 4955b664-3079-4dd1-aa1e-6666b581c06e b7eefbce-6236-45bb-aae2-52dcfbbd7559 -->
# خطة تطوير نظام إدارة طلبات الصيانة

## البنية العامة للمشروع

```
enginner-system/
├── backend/                 # NestJS + TypeScript + MongoDB
│   ├── src/
│   │   ├── common/          # Shared utilities, interceptors, filters
│   │   ├── config/          # Configuration modules
│   │   ├── modules/         # Feature modules
│   │   └── main.ts
│   └── package.json
├── frontend/                # React 19 + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── store/
│   └── package.json
└── shared/                  # Shared types (optional)
```

---

## المرحلة 1: إعداد البنية التحتية للباك إند

### 1.1 هيكل الاستجابة الموحد (Unified Response Structure)

**ملف:** `backend/src/common/interfaces/api-response.interface.ts`

```typescript
// استجابة ناجحة
interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
  timestamp: string;
}

// استجابة خاطئة
interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  details?: Record<string, any>;
  path: string;
  timestamp: string;
}
```

### 1.2 نظام الأخطاء المركزي

**الملفات المطلوبة:**

- `backend/src/common/filters/http-exception.filter.ts` - معالج الأخطاء العام
- `backend/src/common/exceptions/` - أخطاء مخصصة (BusinessException, ValidationException)
- `backend/src/common/interceptors/response.interceptor.ts` - تنسيق الاستجابات

**أنواع الأخطاء:**

| الكود | النوع | الاستخدام |

|-------|-------|----------|

| 400 | BadRequestException | بيانات غير صحيحة |

| 401 | UnauthorizedException | غير مصرح |

| 403 | ForbiddenException | ممنوع الوصول |

| 404 | NotFoundException | غير موجود |

| 409 | ConflictException | تعارض (مثل بريد مكرر) |

| 422 | UnprocessableEntityException | فشل التحقق |

| 500 | InternalServerException | خطأ داخلي |

### 1.3 نظام الكاش (In-Memory Cache)

**ملف:** `backend/src/common/cache/cache.module.ts`

```typescript
// استخدام @nestjs/cache-manager
// التخزين المؤقت للقوائم المرجعية (المواقع، الأقسام، الأنظمة، الآلات)
// TTL: 5 دقائق للقوائم، 1 دقيقة للإحصائيات
```

**الديكوريتور:** `@CacheKey()` و `@CacheTTL()`

---

## المرحلة 2: قاعدة البيانات (MongoDB + Mongoose)

### 2.1 الـ Schemas

| Schema | الوصف | الحقول الرئيسية |

|--------|-------|-----------------|

| `User` | المستخدمين | name, email, password, role, departmentId, isActive |

| `Location` | المواقع | name, description, isActive |

| `Department` | الأقسام | name, isActive |

| `System` | الأنظمة | name, description, isActive |

| `Machine` | الآلات | name, systemId, description, isActive |

| `MaintenanceRequest` | طلبات الصيانة | جميع حقول الطلب |

| `WebhookSubscription` | اشتراكات الويب هوك | url, events, isActive |

| `AuditLog` | سجل العمليات | userId, action, entity, changes |

### 2.2 الفهارس (Indexes)

```typescript
// MaintenanceRequest
{ engineerId: 1, status: 1 }
{ locationId: 1, departmentId: 1 }
{ createdAt: -1 }
{ requestCode: 1 } // unique

// Machine
{ systemId: 1 }
```

---

## المرحلة 3: الوحدات (Modules)

### 3.1 وحدة المصادقة (Auth Module)

**المسارات:**

| Method | Endpoint | الوصف |

|--------|----------|-------|

| POST | `/auth/login` | تسجيل الدخول |

| POST | `/auth/logout` | تسجيل الخروج |

| POST | `/auth/refresh` | تجديد التوكن |

| GET | `/auth/me` | بيانات المستخدم الحالي |

**JWT Strategy:** Access Token (15m) + Refresh Token (7d)

### 3.2 وحدة المستخدمين (Users Module) - Admin Only

**المسارات:**

| Method | Endpoint | الوصف |

|--------|----------|-------|

| GET | `/users` | قائمة المستخدمين (مع فلترة وتصفح) |

| GET | `/users/:id` | تفاصيل مستخدم |

| POST | `/users` | إنشاء مستخدم |

| PATCH | `/users/:id` | تعديل مستخدم |

| PATCH | `/users/:id/toggle-status` | تفعيل/إيقاف |

| DELETE | `/users/:id` | حذف (soft delete) |

### 3.3 وحدة القوائم المرجعية (Reference Data Module)

**المسارات لكل قائمة (locations, departments, systems, machines):**

| Method | Endpoint | الوصف |

|--------|----------|-------|

| GET | `/[entity]` | القائمة (مع كاش) |

| GET | `/[entity]/:id` | تفاصيل |

| POST | `/[entity]` | إنشاء (Admin) |

| PATCH | `/[entity]/:id` | تعديل (Admin) |

| DELETE | `/[entity]/:id` | حذف (Admin) |

**خاص بالآلات:**

| GET | `/machines/by-system/:systemId` | الآلات حسب النظام |

### 3.4 وحدة طلبات الصيانة (Maintenance Requests Module)

**المسارات:**

| Method | Endpoint | الدور | الوصف |

|--------|----------|------|-------|

| GET | `/requests` | All | قائمة الطلبات (مع فلترة) |

| GET | `/requests/:id` | All | تفاصيل طلب |

| POST | `/requests` | Engineer | إنشاء طلب جديد |

| PATCH | `/requests/:id` | Engineer | تعديل طلب (قبل المراجعة) |

| PATCH | `/requests/:id/review` | Consultant | مراجعة (موافقة/رفض) |

| PATCH | `/requests/:id/complete` | Engineer | إغلاق الطلب |

**فلاتر الطلبات:**

- `status` - حالة الطلب
- `engineerId` - المهندس
- `consultantId` - الاستشاري
- `locationId` - الموقع
- `departmentId` - القسم
- `systemId` - النظام
- `maintenanceType` - نوع الصيانة
- `fromDate` / `toDate` - الفترة الزمنية

### 3.5 وحدة الإحصائيات (Statistics Module)

**المسارات:**

| Method | Endpoint | الدور | الوصف |

|--------|----------|------|-------|

| GET | `/statistics/dashboard` | All | إحصائيات لوحة التحكم |

| GET | `/statistics/by-engineer` | Consultant+ | طلبات حسب المهندس |

| GET | `/statistics/by-status` | All | توزيع حسب الحالة |

| GET | `/statistics/by-maintenance-type` | All | توزيع حسب نوع الصيانة |

| GET | `/statistics/by-location` | Admin | توزيع حسب الموقع |

| GET | `/statistics/by-department` | Admin | توزيع حسب القسم |

| GET | `/statistics/by-system` | Admin | توزيع حسب النظام |

| GET | `/statistics/top-failing-machines` | Admin | أكثر الآلات تعطلاً |

| GET | `/statistics/trends` | Admin | اتجاهات زمنية |

| GET | `/statistics/response-time` | Admin | متوسط وقت الاستجابة |

**الإحصائيات التفصيلية:**

```typescript
// Dashboard Statistics
{
  totalRequests: number;
  pendingReview: number;
  inProgress: number;
  completed: number;
  emergencyRequests: number;
  preventiveRequests: number;
  todayRequests: number;
  thisWeekRequests: number;
  thisMonthRequests: number;
  avgCompletionTime: number; // بالساعات
}

// Engineer Statistics
{
  engineerId: string;
  engineerName: string;
  totalRequests: number;
  byStatus: { pending: n, inProgress: n, completed: n };
  byType: { emergency: n, preventive: n };
  avgCompletionTime: number;
}

// Top Failing Machines
{
  machineId: string;
  machineName: string;
  systemName: string;
  failureCount: number;
  lastFailure: Date;
}

// Trends (Monthly/Weekly)
{
  period: string;
  total: number;
  emergency: number;
  preventive: number;
  completed: number;
}
```

### 3.6 وحدة التقارير (Reports Module)

**المسارات:**

| Method | Endpoint | الوصف |

|--------|----------|-------|

| GET | `/reports/requests` | تقرير الطلبات (فلترة + Excel/PDF) |

| GET | `/reports/engineer/:id` | تقرير مهندس محدد |

| GET | `/reports/summary` | ملخص عام |

**Query Params:** `format=excel|pdf`, `fromDate`, `toDate`, filters...

### 3.7 وحدة الإشعارات الفورية (WebSocket Gateway)

**ملف:** `backend/src/modules/notifications/notifications.gateway.ts`

**الأحداث:**

| Event | الوصف | المستقبل |

|-------|-------|----------|

| `request:created` | طلب جديد | Consultants + Admin |

| `request:reviewed` | تمت المراجعة | Engineer (صاحب الطلب) |

| `request:completed` | تم الإغلاق | Consultants + Admin |

| `request:updated` | تحديث عام | المعنيين |

**الغرف (Rooms):**

- `admin` - جميع الأدمن
- `consultant` - جميع الاستشاريين
- `engineer:{id}` - مهندس محدد

### 3.8 وحدة سجل العمليات (Audit Log Module)

**التتبع:**

- إنشاء/تعديل/حذف المستخدمين
- تعديل القوائم المرجعية
- جميع عمليات الطلبات
- تسجيل الدخول/الخروج

---

## المرحلة 4: الفرونت إند (React 19)

### 4.1 التقنيات المستخدمة

- **React 19** + TypeScript
- **React Router v7** للتوجيه
- **TanStack Query** لإدارة الطلبات والكاش
- **Zustand** لإدارة الحالة
- **Socket.io-client** للإشعارات الفورية
- **Tailwind CSS** + **shadcn/ui** للتصميم
- **React Hook Form** + **Zod** للنماذج
- **Recharts** للرسوم البيانية

### 4.2 هيكل الصفحات

```
/login                     - تسجيل الدخول
/dashboard                 - لوحة التحكم (حسب الدور)

# صفحات المهندس
/requests                  - طلباتي
/requests/new              - طلب جديد
/requests/:id              - تفاصيل الطلب

# صفحات الاستشاري
/consultant/requests       - جميع الطلبات
/consultant/requests/:id   - مراجعة طلب
/consultant/statistics     - الإحصائيات
/consultant/reports        - التقارير

# صفحات الأدمن
/admin/users               - إدارة المستخدمين
/admin/locations           - إدارة المواقع
/admin/departments         - إدارة الأقسام
/admin/systems             - إدارة الأنظمة
/admin/machines            - إدارة الآلات
/admin/requests            - جميع الطلبات
/admin/statistics          - الإحصائيات الشاملة
/admin/reports             - التقارير
/admin/audit-logs          - سجل العمليات
```

### 4.3 المكونات المشتركة

- `DataTable` - جدول بيانات مع فلترة وتصفح
- `StatusBadge` - شارة الحالة
- `StatCard` - بطاقة إحصائية
- `ChartContainer` - حاوية الرسوم البيانية
- `NotificationToast` - إشعارات فورية
- `LoadingSpinner` - مؤشر التحميل
- `ErrorBoundary` - معالج الأخطاء
- `ConfirmDialog` - نافذة التأكيد

---

## المرحلة 5: الأمان والجودة

### 5.1 الأمان

- تشفير كلمات المرور (bcrypt)
- JWT مع Refresh Token
- Rate Limiting
- CORS Configuration
- Input Validation (class-validator)
- Helmet للحماية من الهجمات الشائعة

### 5.2 التحقق من الصلاحيات

```typescript
// Guards
@Roles(Role.Admin)
@Roles(Role.Admin, Role.Consultant)
@UseGuards(JwtAuthGuard, RolesGuard)
```

---

## ترتيب التنفيذ

| المرحلة | المهمة | الأولوية |

|---------|-------|----------|

| 1 | إعداد المشروع + قاعدة البيانات + هيكل الاستجابة | عالية |

| 2 | وحدة المصادقة + المستخدمين | عالية |

| 3 | القوائم المرجعية + الكاش | عالية |

| 4 | طلبات الصيانة (CRUD + Workflow) | عالية |

| 5 | WebSocket للإشعارات | متوسطة |

| 6 | الإحصائيات والتقارير | متوسطة |

| 7 | واجهة المستخدم الأساسية | عالية |

| 8 | سجل العمليات | منخفضة |

| 9 | التحسينات والاختبارات | منخفضة |

### To-dos

- [ ] إعداد مشروع NestJS مع MongoDB وهيكل الاستجابة الموحد ونظام الأخطاء
- [ ] تطوير وحدة المصادقة (JWT + Refresh Token) مع Guards
- [ ] تطوير وحدة إدارة المستخدمين للأدمن
- [ ] تطوير وحدات القوائم المرجعية (المواقع، الأقسام، الأنظمة، الآلات) مع الكاش
- [ ] تطوير وحدة طلبات الصيانة مع Workflow كامل
- [ ] إعداد WebSocket Gateway للإشعارات الفورية
- [ ] تطوير وحدات الإحصائيات والتقارير
- [ ] تطوير وحدة سجل العمليات
- [ ] إعداد مشروع React 19 مع التقنيات المطلوبة
- [ ] تطوير صفحات المصادقة وحماية المسارات
- [ ] تطوير واجهة المهندس (إنشاء/متابعة الطلبات)
- [ ] تطوير واجهة الاستشاري (المراجعة والإحصائيات)
- [ ] تطوير واجهة الأدمن الكاملة