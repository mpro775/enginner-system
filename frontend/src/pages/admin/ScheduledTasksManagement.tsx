import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Edit,
  Trash2,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/shared/Pagination";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { scheduledTasksService } from "@/services/scheduled-tasks";
import { ScheduledTask, TaskStatus, Role } from "@/types";
import { useAuthStore } from "@/store/auth";

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

const formatScheduledDate = (task: ScheduledTask): string => {
  const monthName = getMonthName(task.scheduledMonth);
  if (task.scheduledDay) {
    return `${task.scheduledDay} ${monthName} ${task.scheduledYear}`;
  }
  return `${monthName} ${task.scheduledYear}`;
};

const getStatusBadge = (status: TaskStatus) => {
  const base =
    "inline-flex items-center gap-1 rounded-full text-[10px] sm:text-xs font-medium shrink-0";
  switch (status) {
    case TaskStatus.PENDING:
      return (
        <span
          className={`${base} px-2 py-0.5 sm:px-2.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200`}
        >
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          معلقة
        </span>
      );
    case TaskStatus.COMPLETED:
      return (
        <span
          className={`${base} px-2 py-0.5 sm:px-2.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200`}
        >
          <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          مكتملة
        </span>
      );
    case TaskStatus.OVERDUE:
      return (
        <span
          className={`${base} px-2 py-0.5 sm:px-2.5 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`}
        >
          <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          متأخرة
        </span>
      );
    case TaskStatus.CANCELLED:
      return (
        <span
          className={`${base} px-2 py-0.5 sm:px-2.5 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200`}
        >
          <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          ملغاة
        </span>
      );
    default:
      return null;
  }
};

export default function ScheduledTasksManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ScheduledTask | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<
    Record<string, boolean>
  >({});

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const filtersFromUrl = useMemo(() => {
    const page = searchParams.get("page");
    const status = searchParams.get("status");
    return {
      page: page ? Math.max(1, parseInt(page, 10) || 1) : 1,
      status: status || "all",
    };
  }, [searchParams]);

  const [filters, setFiltersState] = useState(() => ({
    page: filtersFromUrl.page,
    limit: 10,
    status: filtersFromUrl.status,
  }));

  const setFilters = (
    next: typeof filters | ((prev: typeof filters) => typeof filters)
  ) => {
    setFiltersState((prev) => {
      const nextFilters = typeof next === "function" ? next(prev) : next;
      const params = new URLSearchParams(searchParams);
      if (nextFilters.page !== 1) params.set("page", String(nextFilters.page));
      else params.delete("page");
      if (nextFilters.status && nextFilters.status !== "all")
        params.set("status", nextFilters.status);
      else params.delete("status");
      setSearchParams(params, { replace: true });
      return nextFilters;
    });
  };

  useEffect(() => {
    setFiltersState((prev) => ({
      ...prev,
      page: filtersFromUrl.page,
      status: filtersFromUrl.status,
    }));
  }, [filtersFromUrl]);

  const { data, isLoading } = useQuery({
    queryKey: ["scheduled-tasks", filters],
    queryFn: () =>
      scheduledTasksService.getAll({
        ...filters,
        status:
          filters.status !== "all" ? (filters.status as TaskStatus) : undefined,
      }),
  });

  const [deleteType, setDeleteType] = useState<"soft" | "hard">("soft");

  const deleteMutation = useMutation({
    mutationFn: scheduledTasksService.softDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      setShowDeleteDialog(false);
      setTaskToDelete(null);
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: scheduledTasksService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      setShowDeleteDialog(false);
      setTaskToDelete(null);
    },
  });

  const handleDelete = (
    task: ScheduledTask,
    type: "soft" | "hard" = "soft"
  ) => {
    setTaskToDelete(task);
    setDeleteType(type);
    setShowDeleteDialog(true);
  };

  const returnState = {
    fromPage: filters.page,
    fromFilters: filters,
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      if (deleteType === "hard") {
        hardDeleteMutation.mutate(taskToDelete.id);
      } else {
        deleteMutation.mutate(taskToDelete.id);
      }
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  const tasks = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="w-full max-w-full overflow-x-hidden container mx-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">
            إدارة الصيانة الوقائية
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:text-base">
            إدارة الصيانة الوقائية المخصصة للمهندسين
          </p>
        </div>
        <Button
          onClick={() => navigate("/app/admin/scheduled-tasks/new")}
          className="w-full sm:w-auto shrink-0"
        >
          <Plus className="ml-2 h-4 w-4" />
          إضافة صيانة وقائية جديدة
        </Button>
      </div>

      {/* Filters */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            التصفية
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 max-w-md">
            <div className="space-y-2 min-w-0">
              <label className="text-xs sm:text-sm font-medium">الحالة</label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value, page: 1 })
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
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

      {/* Statistics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums">
              {tasks.length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              إجمالي المهام
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums">
              {tasks.filter((t) => t.status === TaskStatus.PENDING).length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              معلقة
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums">
              {tasks.filter((t) => t.status === TaskStatus.COMPLETED).length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              مكتملة
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-3 sm:pb-6">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-destructive tabular-nums">
              {tasks.filter((t) => t.status === TaskStatus.OVERDUE).length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              متأخرة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      <div className="grid gap-3 sm:gap-4">
        {tasks.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="py-8 sm:py-12 px-4 text-center">
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                لا توجد صيانة وقائية
              </p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
                    {/* العنوان والحالة */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground break-words w-full sm:w-auto">
                          {task.title}
                        </h3>
                        {getStatusBadge(task.status)}
                        <span className="text-[10px] sm:text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 sm:py-1 rounded shrink-0">
                          {task.taskCode}
                        </span>
                      </div>
                    </div>

                    {/* التفاصيل الرئيسية */}
                    <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[80px]">
                          المهندس:
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                          {task.engineerId?.name || "متاحة لجميع المهندسين"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm text-muted-foreground block mb-0.5">
                            التاريخ المحدد:
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                            {formatScheduledDate(task)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[80px]">
                          منشئ المهمة:
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                          {task.createdBy?.name || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[80px]">
                          الموقع:
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                          {task.locationId?.name || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[80px]">
                          القسم:
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                          {task.departmentId.name}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[80px]">
                          النظام:
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                          {task.systemId?.name || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                        <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[80px]">
                          الآلة:
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                          {task.machineId.name}
                        </span>
                      </div>
                    </div>

                    {/* المكونات */}
                    {task.machineId?.components &&
                      task.machineId.components.length > 0 && (
                        <div className="space-y-1.5 sm:space-y-2">
                          <span className="text-xs sm:text-sm font-medium text-muted-foreground block">
                            المكونات:
                          </span>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {task.maintainAllComponents ? (
                              <span className="text-xs sm:text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                                جميع المكونات (
                                {task.machineId.components.length})
                              </span>
                            ) : task.selectedComponents &&
                              task.selectedComponents.length > 0 ? (
                              task.selectedComponents.map((component, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full break-all"
                                >
                                  {component}
                                </span>
                              ))
                            ) : null}
                          </div>
                        </div>
                      )}

                    {/* الوصف */}
                    {task.description && (
                      <div className="space-y-1.5 sm:space-y-2 pt-2 border-t">
                        <span className="text-xs sm:text-sm font-medium text-muted-foreground block">
                          الوصف:
                        </span>
                        <div className="text-xs sm:text-sm text-foreground leading-relaxed break-words">
                          {task.description.length > 100 ? (
                            <>
                              <p className="whitespace-pre-wrap break-words">
                                {expandedDescriptions[task.id]
                                  ? task.description
                                  : task.description.slice(0, 100) + "..."}
                              </p>
                              <button
                                onClick={() => toggleDescription(task.id)}
                                className="text-primary hover:underline mt-1 font-medium"
                              >
                                {expandedDescriptions[task.id]
                                  ? "عرض أقل"
                                  : "قراءة المزيد"}
                              </button>
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* معلومات إضافية */}
                    <div className="space-y-2 pt-2 border-t">
                      {task.repetitionInterval && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                          <span className="text-muted-foreground">
                            معدل التكرار:
                          </span>
                          <span className="font-medium text-foreground">
                            {task.repetitionInterval === "weekly" && "أسبوعي"}
                            {task.repetitionInterval === "monthly" && "شهري"}
                            {task.repetitionInterval === "quarterly" &&
                              "كل 3 أشهر"}
                            {task.repetitionInterval === "semi_annually" &&
                              "كل 6 أشهر"}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-2 text-xs sm:text-sm min-w-0">
                        <span className="text-muted-foreground sm:min-w-[80px]">
                          تاريخ الإنشاء:
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-foreground break-words">
                            {new Date(task.createdAt).toLocaleDateString(
                              "en-GB",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                          <span className="text-[10px] sm:text-xs text-muted-foreground break-words">
                            {new Date(task.createdAt).toLocaleDateString(
                              "ar-SA-u-ca-islamic",
                              {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      </div>

                      {task.status === TaskStatus.COMPLETED &&
                        task.completedRequestId && (
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                            <span className="text-muted-foreground">
                              الطلب المكتمل:
                            </span>
                            <span className="font-medium text-foreground break-all">
                              {task.completedRequestId.requestCode}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="flex flex-row sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none w-full sm:w-auto"
                      onClick={() =>
                        navigate(`/app/admin/scheduled-tasks/${task.id}/edit`, {
                          state: returnState,
                        })
                      }
                    >
                      <Edit className="h-4 w-4 ml-2 shrink-0" />
                      <span className="truncate">تعديل</span>
                    </Button>
                    {/* فقط الأدمن يمكنه حذف المهام */}
                    {user?.role === Role.ADMIN && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 sm:flex-none w-full sm:w-auto"
                          >
                            <Trash2 className="h-4 w-4 ml-2 shrink-0" />
                            <span className="truncate">حذف</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="max-w-[min(90vw,20rem)]"
                        >
                          <DropdownMenuItem
                            onClick={() => handleDelete(task, "soft")}
                          >
                            <Trash2 className="h-4 w-4 ml-2 shrink-0" />
                            نقل إلى سلة المهملات
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(task, "hard")}
                          >
                            <AlertTriangle className="h-4 w-4 ml-2 shrink-0" />
                            حذف نهائي
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
              showInfo
              total={meta.total}
              limit={filters.limit}
              itemLabel="مهمة"
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-lg w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6 overflow-y-auto max-h-[90dvh]">
          <DialogHeader className="space-y-2 pr-8 sm:pr-0">
            <DialogTitle
              className={`text-base sm:text-lg break-words ${
                deleteType === "hard"
                  ? "flex items-center gap-2 text-destructive"
                  : ""
              }`}
            >
              {deleteType === "hard" && (
                <AlertTriangle className="h-5 w-5 shrink-0" />
              )}
              {deleteType === "hard"
                ? "تأكيد الحذف النهائي"
                : "تأكيد النقل إلى سلة المهملات"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {deleteType === "hard" ? (
                <>
                  هل أنت متأكد من الحذف النهائي للصيانة الوقائية "
                  {taskToDelete?.title}"؟ هذا الإجراء لا يمكن التراجع عنه!
                </>
              ) : (
                <>
                  هل أنت متأكد من نقل الصيانة الوقائية "{taskToDelete?.title}"
                  إلى سلة المهملات؟
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={
                deleteMutation.isPending || hardDeleteMutation.isPending
              }
              className="w-full sm:w-auto"
            >
              {deleteMutation.isPending || hardDeleteMutation.isPending
                ? deleteType === "hard"
                  ? "جاري الحذف..."
                  : "جاري النقل..."
                : deleteType === "hard"
                ? "حذف نهائي"
                : "نقل إلى سلة المهملات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
