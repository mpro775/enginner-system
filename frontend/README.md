# Maintenance Management System - Frontend

A React 19 frontend for the Maintenance Management System.

## Features

- Modern UI with Tailwind CSS and shadcn/ui components
- Role-based access control (Admin, Consultant, Engineer)
- Real-time notifications via WebSocket
- Interactive dashboards with Recharts
- Form validation with React Hook Form + Zod
- State management with Zustand
- Data fetching with TanStack Query

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

```bash
# Install dependencies
npm install
```

## Development

```bash
# Start development server
npm run dev
```

The app will be available at http://localhost:5173

## Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── ui/           # Base UI components
│   ├── shared/       # Shared components
│   ├── layout/       # Layout components
│   └── auth/         # Auth components
├── hooks/            # Custom React hooks
├── lib/              # Utility functions
├── pages/            # Page components
│   ├── admin/        # Admin pages
│   └── requests/     # Request pages
├── services/         # API services
├── store/            # Zustand stores
├── types/            # TypeScript types
├── App.tsx           # Main app component
├── main.tsx          # Entry point
└── index.css         # Global styles
```

## Pages

### All Roles
- `/login` - Login page
- `/dashboard` - Dashboard with statistics
- `/requests` - List maintenance requests
- `/requests/:id` - Request details

### Engineer Only
- `/requests/new` - Create new request

### Admin & Consultant
- `/statistics` - Detailed statistics
- `/reports` - Reports page

### Admin Only
- `/admin/users` - User management
- `/admin/locations` - Locations management
- `/admin/departments` - Departments management
- `/admin/systems` - Systems management
- `/admin/machines` - Machines management
- `/admin/audit-logs` - Audit logs

## Technologies

- React 19
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui (Radix UI)
- TanStack Query
- React Router v7
- Zustand
- React Hook Form
- Zod
- Recharts
- Socket.io Client
- Lucide Icons





