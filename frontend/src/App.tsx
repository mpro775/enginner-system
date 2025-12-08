import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Toaster } from "@/components/ui/toaster";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import RequestsList from "@/pages/requests/RequestsList";
import NewRequest from "@/pages/requests/NewRequest";
import RequestDetails from "@/pages/requests/RequestDetails";
import Statistics from "@/pages/Statistics";
import Reports from "@/pages/Reports";
import {
  UsersManagement,
  LocationsPage,
  DepartmentsPage,
  SystemsPage,
  MachinesPage,
  AuditLogs,
} from "@/pages/admin";
import { Role } from "@/types";

function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Requests */}
          <Route path="requests" element={<RequestsList />} />
          <Route
            path="requests/new"
            element={
              <ProtectedRoute allowedRoles={[Role.ENGINEER]}>
                <NewRequest />
              </ProtectedRoute>
            }
          />
          <Route path="requests/:id" element={<RequestDetails />} />

          {/* Statistics - Admin, Consultant & Maintenance Manager */}
          <Route
            path="statistics"
            element={
              <ProtectedRoute
                allowedRoles={[
                  Role.ADMIN,
                  Role.CONSULTANT,
                  Role.MAINTENANCE_MANAGER,
                ]}
              >
                <Statistics />
              </ProtectedRoute>
            }
          />

          {/* Reports - Admin, Consultant & Maintenance Manager */}
          <Route
            path="reports"
            element={
              <ProtectedRoute
                allowedRoles={[
                  Role.ADMIN,
                  Role.CONSULTANT,
                  Role.MAINTENANCE_MANAGER,
                ]}
              >
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="admin/users"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <UsersManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/locations"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <LocationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/departments"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <DepartmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/systems"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <SystemsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/machines"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <MachinesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit-logs"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
