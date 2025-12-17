import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Filter,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { scheduledTasksService } from "@/services/scheduled-tasks";
import { ScheduledTask, TaskStatus } from "@/types";

const getMonthName = (month: number): string => {
  const months = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  return months[month - 1] || "";
};

const getStatusBadge = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.PENDING:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          معلقة
        </span>
      );
    case TaskStatus.COMPLETED:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          مكتملة
        </span>
      );
    case TaskStatus.OVERDUE:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          متأخرة
        </span>
      );
    case TaskStatus.CANCELLED:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <XCircle className="w-3 h-3 mr-1" />
          ملغاة
        </span>
      );
    default:
      return null;
  }
};

const getDaysRemaining = (task: ScheduledTask): number => {
  if (task.daysRemaining !== undefined) {
    return task.daysRemaining;
  }
  const now = new Date();
  const targetDate = new Date(task.scheduledYear, task.scheduledMonth - 1, 1);
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function MyScheduledTasks() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: "",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-scheduled-tasks", filters],
    queryFn: () =>
      scheduledTasksService.getMyTasks({
        ...filters,
        status: (filters.status as TaskStatus) || undefined,
      }),
  });

  const handleCreateRequest = (task: ScheduledTask) => {
    // Navigate to new request page with task data in state
    navigate("/requests/new", {
      state: { scheduledTask: task },
    });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-destructive">
          حدث خطأ أثناء تحميل المهام المرجعية
        </div>
      </div>
    );
  }

  const tasks = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مهامي المرجعية</h1>
          <p className="text-muted-foreground mt-1">
            عرض وإدارة المهام المرجعية المخصصة لك
          </p>
        </div>
        <Button onClick={() => navigate("/requests/new")}>
          <Plus className="ml-2 h-4 w-4" />
          طلب صيانة جديد
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            التصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">الحالة</label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value, page: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">جميع الحالات</SelectItem>
                  <SelectItem value={TaskStatus.PENDING}>معلقة</SelectItem>
                  <SelectItem value={TaskStatus.COMPLETED}>مكتملة</SelectItem>
                  <SelectItem value={TaskStatus.OVERDUE}>متأخرة</SelectItem>
                  <SelectItem value={TaskStatus.CANCELLED}>ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <div className="grid gap-4">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">لا توجد مهام مرجعية</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const daysRemaining = getDaysRemaining(task);
            const isOverdue = daysRemaining < 0;

            return (
              <Card key={task.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{task.title}</h3>
                        {getStatusBadge(task.status)}
                      </div>

                      <div className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>
                            {task.departmentId.name} - {task.machineId.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {getMonthName(task.scheduledMonth)}{" "}
                            {task.scheduledYear}
                          </span>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground">
                          {task.description}
                        </p>
                      )}

                      {task.status === TaskStatus.COMPLETED &&
                        task.completedRequestId && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              الطلب المكتمل:{" "}
                            </span>
                            <Button
                              variant="link"
                              className="p-0 h-auto"
                              onClick={() =>
                                navigate(
                                  `/requests/${task.completedRequestId?.id}`
                                )
                              }
                            >
                              {task.completedRequestId.requestCode}
                            </Button>
                          </div>
                        )}

                      {task.status !== TaskStatus.COMPLETED &&
                        task.status !== TaskStatus.CANCELLED && (
                          <div className="pt-2">
                            {isOverdue ? (
                              <span className="text-destructive font-semibold">
                                متأخرة {Math.abs(daysRemaining)} يوم
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                متبقي {daysRemaining} يوم
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    {task.status === TaskStatus.PENDING ||
                      (task.status === TaskStatus.OVERDUE && (
                        <Button
                          onClick={() => handleCreateRequest(task)}
                          className="ml-4"
                        >
                          <Plus className="ml-2 h-4 w-4" />
                          إنشاء طلب
                        </Button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= meta.totalPages}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}
