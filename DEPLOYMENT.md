# دليل نشر نظام الصيانة على VPS

## المحتويات

1. [المتطلبات](#المتطلبات)
2. [إعداد الدومين (DNS)](#إعداد-الدومين-dns)
3. [إعداد VPS](#إعداد-vps)
4. [تثبيت Docker](#تثبيت-docker)
5. [رفع المشروع](#رفع-المشروع)
6. [إعداد SSL](#إعداد-ssl)
7. [تشغيل التطبيق](#تشغيل-التطبيق)
8. [إنشاء البيانات الأولية](#إنشاء-البيانات-الأولية)
9. [الصيانة والنسخ الاحتياطي](#الصيانة-والنسخ-الاحتياطي)
10. [استكشاف الأخطاء](#استكشاف-الأخطاء)

---

## المتطلبات

### متطلبات VPS

| المتطلب | الحد الأدنى | الموصى به |
|---------|-------------|-----------|
| RAM | 2 GB | 4 GB |
| CPU | 1 Core | 2 Cores |
| Storage | 20 GB SSD | 40 GB SSD |
| نظام التشغيل | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### الدومينات المطلوبة

- `mohd-morad.pro` - للواجهة الأمامية (Frontend)
- `api.mohd-morad.pro` - للخادم (Backend API)

---

## إعداد الدومين (DNS)

### الخطوة 1: إضافة سجلات DNS

اذهب إلى لوحة تحكم الدومين وأضف السجلات التالية:

```
Type    Host    Value               TTL
A       @       YOUR_VPS_IP         3600
A       www     YOUR_VPS_IP         3600
A       api     YOUR_VPS_IP         3600
```

**استبدل `YOUR_VPS_IP` بعنوان IP الخاص بـ VPS الخاص بك.**

### الخطوة 2: التحقق من DNS

انتظر 5-30 دقيقة ثم تحقق:

```bash
# على جهازك المحلي أو VPS
nslookup mohd-morad.pro
nslookup api.mohd-morad.pro
```

يجب أن يظهر عنوان IP الخاص بـ VPS.

---

## إعداد VPS

### الخطوة 1: الاتصال بـ VPS

```bash
ssh root@YOUR_VPS_IP
```

### الخطوة 2: تحديث النظام

```bash
apt update && apt upgrade -y
```

### الخطوة 3: إنشاء مستخدم جديد (موصى به)

```bash
# إنشاء مستخدم جديد
adduser deploy

# إضافة صلاحيات sudo
usermod -aG sudo deploy

# التبديل للمستخدم الجديد
su - deploy
```

### الخطوة 4: إعداد Firewall

```bash
# تفعيل UFW
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# التحقق من الحالة
sudo ufw status
```

---

## تثبيت Docker

### الخطوة 1: تثبيت المتطلبات

```bash
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
```

### الخطوة 2: إضافة مستودع Docker

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

### الخطوة 3: تثبيت Docker

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### الخطوة 4: إضافة المستخدم لمجموعة Docker

```bash
sudo usermod -aG docker $USER

# تسجيل الخروج والدخول لتفعيل التغييرات
exit
ssh deploy@YOUR_VPS_IP
```

### الخطوة 5: التحقق من التثبيت

```bash
docker --version
docker compose version
```

---

## رفع المشروع

### الطريقة 1: باستخدام Git (موصى بها)

```bash
# إنشاء مجلد التطبيق
mkdir -p ~/apps
cd ~/apps

# استنساخ المشروع
git clone YOUR_REPOSITORY_URL maintenance-system
cd maintenance-system
```

### الطريقة 2: باستخدام SCP

```bash
# من جهازك المحلي
scp -r ./enginner-system deploy@YOUR_VPS_IP:~/apps/maintenance-system
```

### الخطوة التالية: إعداد ملف البيئة

```bash
cd ~/apps/maintenance-system

# نسخ ملف البيئة
cp .env.example .env

# تعديل الملف
nano .env
```

**تعديل القيم التالية:**

```env
# كلمة مرور MongoDB (اختر كلمة مرور قوية)
MONGO_ROOT_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# JWT Secrets (استخدم الأمر التالي لتوليد مفاتيح عشوائية)
# openssl rand -hex 64
JWT_SECRET=YOUR_GENERATED_SECRET_HERE
JWT_REFRESH_SECRET=YOUR_GENERATED_REFRESH_SECRET_HERE
```

**لتوليد مفاتيح JWT:**

```bash
# توليد JWT_SECRET
openssl rand -hex 64

# توليد JWT_REFRESH_SECRET
openssl rand -hex 64
```

---

## إعداد SSL

### الخطوة 1: إنشاء ملفات Nginx المؤقتة (بدون SSL)

قبل الحصول على شهادات SSL، نحتاج لتشغيل Nginx بدون SSL أولاً.

```bash
cd ~/apps/maintenance-system

# إنشاء ملف nginx مؤقت للـ Frontend
cat > nginx/conf.d/frontend.conf << 'EOF'
server {
    listen 80;
    server_name mohd-morad.pro www.mohd-morad.pro;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

# إنشاء ملف nginx مؤقت للـ API
cat > nginx/conf.d/api.conf << 'EOF'
server {
    listen 80;
    server_name api.mohd-morad.pro;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
```

### الخطوة 2: تشغيل الخدمات بدون Certbot

```bash
# بناء وتشغيل الخدمات (بدون certbot)
docker compose up -d mongodb redis backend frontend nginx
```

### الخطوة 3: الحصول على شهادات SSL

```bash
# الحصول على شهادة للـ Frontend
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d mohd-morad.pro \
    -d www.mohd-morad.pro \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email

# الحصول على شهادة للـ API
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d api.mohd-morad.pro \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email
```

**استبدل `your-email@example.com` ببريدك الإلكتروني.**

### الخطوة 4: استعادة ملفات Nginx الكاملة (مع SSL)

```bash
# استعادة الملفات الأصلية من Git
git checkout nginx/conf.d/frontend.conf
git checkout nginx/conf.d/api.conf

# إعادة تشغيل Nginx
docker compose restart nginx
```

### الخطوة 5: التحقق من SSL

```bash
# التحقق من الشهادات
docker compose exec nginx nginx -t

# فتح المتصفح وزيارة
# https://mohd-morad.pro
# https://api.mohd-morad.pro
```

---

## تشغيل التطبيق

### الخطوة 1: بناء وتشغيل جميع الخدمات

```bash
cd ~/apps/maintenance-system

# بناء الـ images
docker compose build

# تشغيل جميع الخدمات
docker compose up -d
```

### الخطوة 2: التحقق من حالة الخدمات

```bash
# عرض حالة الخدمات
docker compose ps

# عرض logs
docker compose logs -f

# عرض logs لخدمة معينة
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

### الخطوة 3: التحقق من صحة التطبيق

```bash
# اختبار الـ Backend
curl https://api.mohd-morad.pro/api/v1/health

# اختبار الـ Frontend
curl -I https://mohd-morad.pro
```

---

## إنشاء البيانات الأولية

### الخطوة 1: تشغيل Seed Script

```bash
# الدخول إلى container الـ Backend
docker compose exec backend sh

# تشغيل الـ seed (داخل الـ container)
npx ts-node src/seed/seed.ts

# الخروج من الـ container
exit
```

### الخطوة 2: بيانات تسجيل الدخول الافتراضية

| الدور | البريد الإلكتروني | كلمة المرور |
|-------|-------------------|-------------|
| Admin | admin@maintenance.com | 123456 |
| Consultant | consultant1@maintenance.com | 123456 |
| Engineer | engineer1@maintenance.com | 123456 |

**مهم: قم بتغيير كلمات المرور فور تسجيل الدخول الأول!**

---

## الصيانة والنسخ الاحتياطي

### النسخ الاحتياطي لقاعدة البيانات

```bash
# إنشاء نسخة احتياطية
docker compose exec mongodb mongodump \
    --username admin \
    --password YOUR_MONGO_PASSWORD \
    --authenticationDatabase admin \
    --db maintenance-system \
    --out /backups/$(date +%Y%m%d_%H%M%S)

# النسخ الاحتياطية محفوظة في ./backups/mongodb/
```

### استعادة قاعدة البيانات

```bash
docker compose exec mongodb mongorestore \
    --username admin \
    --password YOUR_MONGO_PASSWORD \
    --authenticationDatabase admin \
    --db maintenance-system \
    /backups/BACKUP_FOLDER_NAME/maintenance-system
```

### تحديث التطبيق

```bash
cd ~/apps/maintenance-system

# سحب التحديثات
git pull origin main

# إعادة بناء وتشغيل
docker compose build
docker compose up -d

# التحقق من الحالة
docker compose ps
```

### تجديد شهادات SSL (تلقائي)

Certbot يعمل تلقائياً لتجديد الشهادات. للتجديد اليدوي:

```bash
docker compose run --rm certbot renew
docker compose restart nginx
```

### مراقبة الموارد

```bash
# استخدام الموارد
docker stats

# مساحة القرص
docker system df

# تنظيف الـ images غير المستخدمة
docker system prune -a
```

---

## استكشاف الأخطاء

### مشكلة: الخدمات لا تعمل

```bash
# التحقق من الـ logs
docker compose logs -f

# إعادة تشغيل خدمة معينة
docker compose restart backend

# إعادة بناء وتشغيل
docker compose up -d --build
```

### مشكلة: خطأ في الاتصال بـ MongoDB

```bash
# التحقق من حالة MongoDB
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# التحقق من الـ logs
docker compose logs mongodb
```

### مشكلة: خطأ SSL

```bash
# التحقق من صلاحية الشهادات
docker compose exec nginx ls -la /etc/letsencrypt/live/

# إعادة الحصول على الشهادات
docker compose run --rm certbot certonly --force-renewal ...
```

### مشكلة: خطأ 502 Bad Gateway

```bash
# التحقق من أن الـ Backend يعمل
docker compose ps backend

# التحقق من الـ logs
docker compose logs backend

# التحقق من إعدادات Nginx
docker compose exec nginx nginx -t
```

### مشكلة: WebSocket لا يعمل

```bash
# التحقق من إعدادات Nginx للـ WebSocket
# تأكد من وجود هذه الإعدادات في nginx config:
# proxy_http_version 1.1;
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection "upgrade";
```

---

## الأوامر المفيدة

```bash
# تشغيل جميع الخدمات
docker compose up -d

# إيقاف جميع الخدمات
docker compose down

# إعادة تشغيل خدمة
docker compose restart [service_name]

# عرض الـ logs
docker compose logs -f [service_name]

# الدخول إلى container
docker compose exec [service_name] sh

# عرض حالة الخدمات
docker compose ps

# بناء الـ images من جديد
docker compose build --no-cache
```

---

## هيكل الملفات

```
maintenance-system/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   ├── .env.example
│   ├── .env.production
│   └── src/
├── nginx/
│   ├── nginx.conf
│   ├── conf.d/
│   │   ├── frontend.conf
│   │   ├── api.conf
│   │   └── default.conf
│   ├── ssl/
│   └── certbot/
│       ├── www/
│       └── conf/
├── backups/
│   └── mongodb/
├── docker-compose.yml
├── .env.example
├── .env
└── DEPLOYMENT.md
```

---

## الدعم

إذا واجهت أي مشاكل:

1. تحقق من الـ logs: `docker compose logs -f`
2. تحقق من حالة الخدمات: `docker compose ps`
3. راجع قسم استكشاف الأخطاء أعلاه

---

**تم إنشاء هذا الدليل لنظام إدارة الصيانة**
**التاريخ:** ديسمبر 2024

