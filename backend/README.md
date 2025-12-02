# Maintenance Management System - Backend

A NestJS-based backend API for the Maintenance Management System.

## Features

- JWT Authentication with Refresh Tokens
- Role-based Access Control (Admin, Consultant, Engineer)
- CRUD operations for Users, Locations, Departments, Systems, Machines
- Maintenance Request Workflow Management
- Real-time Notifications via WebSocket
- Statistics and Reports (Excel/PDF export)
- Audit Logging
- In-Memory Caching

## Prerequisites

- Node.js 18+
- MongoDB 6+
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

## Environment Variables

```env
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

MONGODB_URI=mongodb://localhost:27017/maintenance-system

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173

CACHE_TTL=300
CACHE_MAX=100

THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Seeding the Database

```bash
npx ts-node src/seed/seed.ts
```

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@maintenance.com | 123456 |
| Consultant | consultant1@maintenance.com | 123456 |
| Engineer | engineer1@maintenance.com | 123456 |

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Users (Admin only)
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:id` - Get user
- `POST /api/v1/users` - Create user
- `PATCH /api/v1/users/:id` - Update user
- `PATCH /api/v1/users/:id/toggle-status` - Toggle user status
- `DELETE /api/v1/users/:id` - Delete user

### Reference Data
- `GET/POST/PATCH/DELETE /api/v1/locations`
- `GET/POST/PATCH/DELETE /api/v1/departments`
- `GET/POST/PATCH/DELETE /api/v1/systems`
- `GET/POST/PATCH/DELETE /api/v1/machines`
- `GET /api/v1/machines/by-system/:systemId`

### Maintenance Requests
- `GET /api/v1/requests` - List requests
- `GET /api/v1/requests/:id` - Get request
- `POST /api/v1/requests` - Create request (Engineer)
- `PATCH /api/v1/requests/:id` - Update request (Engineer)
- `PATCH /api/v1/requests/:id/review` - Review request (Consultant)
- `PATCH /api/v1/requests/:id/complete` - Complete request (Engineer)

### Statistics
- `GET /api/v1/statistics/dashboard` - Dashboard stats
- `GET /api/v1/statistics/by-engineer` - Stats by engineer
- `GET /api/v1/statistics/by-status` - Stats by status
- `GET /api/v1/statistics/by-maintenance-type` - Stats by type
- `GET /api/v1/statistics/by-location` - Stats by location (Admin)
- `GET /api/v1/statistics/by-department` - Stats by department (Admin)
- `GET /api/v1/statistics/by-system` - Stats by system (Admin)
- `GET /api/v1/statistics/top-failing-machines` - Top failing machines (Admin)
- `GET /api/v1/statistics/trends` - Trends over time (Admin)
- `GET /api/v1/statistics/response-time` - Response time stats (Admin)

### Reports
- `GET /api/v1/reports/requests?format=json|excel|pdf` - Requests report
- `GET /api/v1/reports/engineer/:id` - Engineer report
- `GET /api/v1/reports/summary` - Summary report (Admin)

### Audit Logs (Admin only)
- `GET /api/v1/audit-logs` - List audit logs
- `GET /api/v1/audit-logs/entity/:entity/:entityId` - Logs for entity

## WebSocket Events

Connect to `/notifications` namespace with JWT token.

### Events
- `notification` - Receive notifications
  - `request:created` - New request created
  - `request:reviewed` - Request reviewed
  - `request:completed` - Request completed
  - `request:updated` - Request updated

## Project Structure

```
src/
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── dto/             # Common DTOs
│   ├── enums/           # Enumerations
│   ├── exceptions/      # Custom exceptions
│   ├── filters/         # Exception filters
│   ├── guards/          # Authorization guards
│   ├── interceptors/    # Response interceptors
│   ├── interfaces/      # TypeScript interfaces
│   └── utils/           # Utility functions
├── modules/             # Feature modules
│   ├── auth/            # Authentication
│   ├── users/           # User management
│   ├── locations/       # Locations CRUD
│   ├── departments/     # Departments CRUD
│   ├── systems/         # Systems CRUD
│   ├── machines/        # Machines CRUD
│   ├── maintenance-requests/  # Request management
│   ├── statistics/      # Statistics
│   ├── reports/         # Report generation
│   ├── notifications/   # WebSocket notifications
│   └── audit-logs/      # Audit logging
├── seed/                # Database seeding
├── app.module.ts        # Root module
└── main.ts              # Application entry
```

## License

MIT





