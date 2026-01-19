import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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

export default function ScheduledTasksManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<ScheduledTask | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: "all",
  });

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

  const handleDelete = (task: ScheduledTask, type: "soft" | "hard" = "soft") => {
    setTaskToDelete(task);
    setDeleteType(type);
    setShowDeleteDialog(true);
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            إدارة الصيانة الوقائية
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة الصيانة الوقائية المخصصة للمهندسين
          </p>
        </div>
        <Button onClick={() => navigate("/app/admin/scheduled-tasks/new")}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة صيانة وقائية جديدة
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground">إجمالي المهام</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {tasks.filter((t) => t.status === TaskStatus.PENDING).length}
            </div>
            <p className="text-xs text-muted-foreground">معلقة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {tasks.filter((t) => t.status === TaskStatus.COMPLETED).length}
            </div>
            <p className="text-xs text-muted-foreground">مكتملة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">
              {tasks.filter((t) => t.status === TaskStatus.OVERDUE).length}
            </div>
            <p className="text-xs text-muted-foreground">متأخرة</p>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      <div className="grid gap-4">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">لا توجد صيانة وقائية</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    {/* العنوان والحالة */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-foreground">
                          {task.title}
                        </h3>
                        {getStatusBadge(task.status)}
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                          {task.taskCode}
                        </span>
                      </div>
                    </div>

                    {/* التفاصيل الرئيسية */}
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground min-w-[80px]">المهندس:</span>
                        <span className="text-sm font-medium text-foreground">
                          {task.engineerId?.name || "متاحة لجميع المهندسين"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <span className="text-sm text-muted-foreground block mb-1">التاريخ المحدد:</span>
                          <span className="text-sm font-medium text-foreground">
                            {formatScheduledDate(task)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground min-w-[80px]">منشئ المهمة:</span>
                        <span className="text-sm font-medium text-foreground">
                          {task.createdBy?.name || "-"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground min-w-[80px]">الموقع:</span>
                        <span className="text-sm font-medium text-foreground">
                          {task.locationId?.name || "-"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground min-w-[80px]">القسم:</span>
                        <span className="text-sm font-medium text-foreground">
                          {task.departmentId.name}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground min-w-[80px]">النظام:</span>
                        <span className="text-sm font-medium text-foreground">
                          {task.systemId?.name || "-"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground min-w-[80px]">الآلة:</span>
                        <span className="text-sm font-medium text-foreground">
                          {task.machineId.name}
                        </span>
                      </div>
                    </div>

                    {/* المكونات */}
                    {task.machineId?.components && task.machineId.components.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-medium text-muted-foreground block">
                          المكونات:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {task.maintainAllComponents ? (
                            <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                              جميع المكونات ({task.machineId.components.length})
                            </span>
                          ) : task.selectedComponents && task.selectedComponents.length > 0 ? (
                            task.selectedComponents.map((component, idx) => (
                              <span
                                key={idx}
                                className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded-full"
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
                      <div className="space-y-2 pt-2 border-t">
                        <span className="text-sm font-medium text-muted-foreground block">
                          الوصف:
                        </span>
                        <div className="text-sm text-foreground leading-relaxed">
                          {task.description.length > 100 ? (
                            <>
                              <p className="whitespace-pre-wrap">
                                {expandedDescriptions[task.id] 
                                  ? task.description 
                                  : task.description.slice(0, 100) + "..."}
                              </p>
                              <button
                                onClick={() => toggleDescription(task.id)}
                                className="text-primary hover:underline text-sm mt-1 font-medium"
                              >
                                {expandedDescriptions[task.id] ? "عرض أقل" : "قراءة المزيد"}
                              </button>
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap">{task.description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* معلومات إضافية */}
                    <div className="space-y-2 pt-2 border-t">
                      {task.repetitionInterval && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">معدل التكرار:</span>
                          <span className="font-medium text-foreground">
                            {task.repetitionInterval === "weekly" && "أسبوعي"}
                            {task.repetitionInterval === "monthly" && "شهري"}
                            {task.repetitionInterval === "quarterly" && "كل 3 أشهر"}
                            {task.repetitionInterval === "semi_annually" && "كل 6 أشهر"}
                          </span>
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground min-w-[80px]">تاريخ الإنشاء:</span>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {new Date(task.createdAt).toLocaleDateString('en-GB', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>

                      {task.status === TaskStatus.COMPLETED && task.completedRequestId && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">الطلب المكتمل:</span>
                          <span className="font-medium text-foreground">
                            {task.completedRequestId.requestCode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/app/admin/scheduled-tasks/${task.id}/edit`)
                      }
                    >
                      <Edit className="h-4 w-4 ml-2" />
                      تعديل
                    </Button>
                    {/* فقط الأدمن يمكنه حذف المهام */}
                    {user?.role === Role.ADMIN && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 ml-2" />
                            حذف
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDelete(task, "soft")}>
                            <Trash2 className="h-4 w-4 ml-2" />
                            نقل إلى سلة المهملات
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(task, "hard")}
                          >
                            <AlertTriangle className="h-4 w-4 ml-2" />
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

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={deleteType === "hard" ? "flex items-center gap-2 text-destructive" : ""}>
              {deleteType === "hard" && <AlertTriangle className="h-5 w-5" />}
              {deleteType === "hard" ? "تأكيد الحذف النهائي" : "تأكيد النقل إلى سلة المهملات"}
            </DialogTitle>
            <DialogDescription>
              {deleteType === "hard" ? (
                <>
                  هل أنت متأكد من الحذف النهائي للصيانة الوقائية "{taskToDelete?.title}"؟ هذا الإجراء لا يمكن
                  التراجع عنه!
                </>
              ) : (
                <>هل أنت متأكد من نقل الصيانة الوقائية "{taskToDelete?.title}" إلى سلة المهملات؟</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending || hardDeleteMutation.isPending}
            >
              {(deleteMutation.isPending || hardDeleteMutation.isPending) 
                ? (deleteType === "hard" ? "جاري الحذف..." : "جاري النقل...")
                : (deleteType === "hard" ? "حذف نهائي" : "نقل إلى سلة المهملات")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
