import { Role } from "@/types";
import { useAuthStore } from "@/store/auth";
import StandardDashboard from "@/pages/dashboard/StandardDashboard";
import AdminOperationsDashboard from "@/pages/dashboard/AdminOperationsDashboard";

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);

  if (user?.role === Role.ADMIN) {
    return <AdminOperationsDashboard />;
  }

  return <StandardDashboard />;
}
