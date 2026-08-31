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
  FloorsPage,
  AuditLogs,
} from "@/pages/admin";
import ScheduledTasksManagement from "@/pages/admin/ScheduledTasksManagement";
import ScheduledTaskForm from "@/pages/admin/ScheduledTaskForm";
import MyScheduledTasks from "@/pages/engineer/MyScheduledTasks";
import Home from "@/pages/Home";
import NewComplaint from "@/pages/complaints/NewComplaint";
import ComplaintsList from "@/pages/complaints/ComplaintsList";
import ComplaintDetails from "@/pages/complaints/ComplaintDetails";
import Trash from "@/pages/admin/Trash";
import AnalyticsCenter from "@/pages/admin/AnalyticsCenter";
import PreventiveCalendar from "@/pages/admin/PreventiveCalendar";
import MachineProfile from "@/pages/admin/MachineProfile";
import { Role } from "@/types";

function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/complaint/new" element={<NewComplaint />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Requests */}
          {/* Complaints */}
          <Route path="complaints" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.CONSULTANT, Role.ENGINEER, Role.MAINTENANCE_MANAGER]}><ComplaintsList /></ProtectedRoute>} />
          <Route path="complaints/:id" element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.CONSULTANT, Role.ENGINEER, Role.MAINTENANCE_MANAGER]}><ComplaintDetails /></ProtectedRoute>} />

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

          {/* Engineer routes */}
          <Route
            path="engineer/my-tasks"
            element={
              <ProtectedRoute allowedRoles={[Role.ENGINEER]}>
                <MyScheduledTasks />
              </ProtectedRoute>
            }
          />

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
            path="admin/analytics"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <AnalyticsCenter />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/preventive-calendar"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <PreventiveCalendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/machines/:id"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <MachineProfile />
              </ProtectedRoute>
            }
          />
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
            path="admin/floors"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <FloorsPage />
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
          <Route
            path="admin/trash"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                <Trash />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/scheduled-tasks"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN, Role.CONSULTANT]}>
                <ScheduledTasksManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/scheduled-tasks/new"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN, Role.CONSULTANT]}>
                <ScheduledTaskForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/scheduled-tasks/:id/edit"
            element={
              <ProtectedRoute allowedRoles={[Role.ADMIN, Role.CONSULTANT]}>
                <ScheduledTaskForm />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
