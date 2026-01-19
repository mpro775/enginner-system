import { useState } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Loader2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import { requestsService } from "@/services/requests";
import { ScheduledTask, TaskStatus, MaintenanceType } from "@/types";
import { useToast } from "@/hooks/use-toast";

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

const getDaysRemaining = (task: ScheduledTask): number => {
  if (task.daysRemaining !== undefined) {
    return task.daysRemaining;
  }
  const now = new Date();
  // Use scheduledDay if provided, otherwise use 1 (first day of month)
  const day = task.scheduledDay || 1;
  const targetDate = new Date(task.scheduledYear, task.scheduledMonth - 1, day);
  const diffTime = targetDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export default function MyScheduledTasks() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: "all",
  });

  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [selectedTaskForExecution, setSelectedTaskForExecution] = useState<ScheduledTask | null>(null);
  const [executionNotes, setExecutionNotes] = useState("");
  const [availableTasks, setAvailableTasks] = useState<ScheduledTask[]>([]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-scheduled-tasks", filters],
    queryFn: () =>
      scheduledTasksService.getMyTasks({
        ...filters,
        status:
          filters.status !== "all" ? (filters.status as TaskStatus) : undefined,
      }),
  });

  // Load available tasks
  const loadAvailableTasks = async () => {
    try {
      const tasks = await scheduledTasksService.getAvailableTasks();
      setAvailableTasks(tasks);
    } catch (error) {
      toast({
        title: "حدث خطأ",
        description: "فشل تحميل المهام المتاحة",
        variant: "destructive",
      });
    }
  };

  // Load available tasks on mount
  React.useEffect(() => {
    loadAvailableTasks();
  }, []);

  const createRequestMutation = useMutation({
    mutationFn: requestsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({
        title: "تم إنشاء الطلب بنجاح",
        description: "تم إنشاء طلب الصيانة من الصيانة الوقائية",
      });
      setExecuteDialogOpen(false);
      setExecutionNotes("");
      setSelectedTaskForExecution(null);
    },
    onError: () => {
      toast({
        title: "حدث خطأ",
        description: "فشل إنشاء طلب الصيانة",
        variant: "destructive",
      });
    },
  });

  const acceptTaskMutation = useMutation({
    mutationFn: scheduledTasksService.acceptTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-scheduled-tasks"] });
      loadAvailableTasks();
      toast({
        title: "تم قبول المهمة بنجاح",
        description: "تم إسناد المهمة إليك",
      });
    },
    onError: (error: any) => {
      toast({
        title: "حدث خطأ",
        description: error?.response?.data?.message || "فشل قبول المهمة",
        variant: "destructive",
      });
    },
  });

  const handleAcceptTask = (task: ScheduledTask) => {
    acceptTaskMutation.mutate(task.id);
  };

  const handleQuickExecute = (task: ScheduledTask) => {
    setSelectedTaskForExecution(task);
    setExecutionNotes("");
    setExecuteDialogOpen(true);
  };

  const handleExecuteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForExecution) return;

    const requestData = {
      maintenanceType: MaintenanceType.PREVENTIVE, // جميع المهام المرجعية وقائية
      locationId: selectedTaskForExecution.locationId.id,
      departmentId: selectedTaskForExecution.departmentId.id,
      systemId: selectedTaskForExecution.systemId.id,
      machineId: selectedTaskForExecution.machineId.id,
      maintainAllComponents: selectedTaskForExecution.maintainAllComponents,
      selectedComponents: selectedTaskForExecution.selectedComponents,
      reasonText: selectedTaskForExecution.description || selectedTaskForExecution.title,
      engineerNotes: executionNotes,
      scheduledTaskId: selectedTaskForExecution.id,
    };

    createRequestMutation.mutate(requestData);
  };

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
          حدث خطأ أثناء تحميل الصيانة الوقائية
        </div>
      </div>
    );
  }

  const tasks = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">صيانتي الوقائية</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            عرض وإدارة الصيانة الوقائية المخصصة لك
          </p>
        </div>
        <Button 
          onClick={() => navigate("/requests/new")}
          className="w-full sm:w-auto"
          size="sm"
        >
          <Plus className="ml-2 h-4 w-4" />
          طلب صيانة جديد
        </Button>
      </div>

      {/* Available Tasks Section */}
      {availableTasks.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              المهام المتاحة
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              صيانة وقائية متاحة لجميع المهندسين - يمكنك قبول أي صيانة منها
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4">
              {availableTasks.map((task) => {
                const daysRemaining = getDaysRemaining(task);
                const isOverdue = daysRemaining < 0;

                return (
                  <Card key={task.id} className="bg-card">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="flex-1 space-y-2 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <h4 className="font-semibold text-sm sm:text-base">{task.title}</h4>
                            {getStatusBadge(task.status)}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 text-xs sm:text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span className="break-words">
                                {task.departmentId.name} - {task.machineId.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                              <span>{formatScheduledDate(task)}</span>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div>
                            {isOverdue ? (
                              <span className="text-destructive font-semibold text-xs sm:text-sm">
                                متأخرة {Math.abs(daysRemaining)} يوم
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                متبقي {daysRemaining} يوم
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAcceptTask(task)}
                          disabled={acceptTaskMutation.isPending}
                          className="w-full sm:w-auto sm:ml-4"
                          size="sm"
                        >
                          {acceptTaskMutation.isPending ? (
                            <>
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                              <span className="hidden sm:inline">جاري القبول...</span>
                              <span className="sm:hidden">جاري...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="ml-2 h-4 w-4" />
                              <span className="hidden sm:inline">قبول المهمة</span>
                              <span className="sm:hidden">قبول</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            التصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">الحالة</label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value, page: 1 })
                }
              >
                <SelectTrigger className="w-full">
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

      {/* Tasks List */}
      <div className="grid gap-3 sm:gap-4">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 sm:py-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">لا توجد صيانة وقائية</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const daysRemaining = getDaysRemaining(task);
            const isOverdue = daysRemaining < 0;

            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <h3 className="text-base sm:text-lg font-semibold break-words">{task.title}</h3>
                        <div className="flex-shrink-0">
                          {getStatusBadge(task.status)}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-start sm:items-center gap-2">
                          <Building2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
                          <span className="break-words">
                            {task.departmentId.name} - {task.machineId.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span>{formatScheduledDate(task)}</span>
                        </div>
                        {task.engineerId && (
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <span>المهندس:</span>
                            <span className="font-medium">{task.engineerId.name}</span>
                          </div>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
                          {task.description}
                        </p>
                      )}

                      {task.status === TaskStatus.COMPLETED &&
                        task.completedRequestId && (
                          <div className="text-xs sm:text-sm">
                            <span className="text-muted-foreground">
                              الطلب المكتمل:{" "}
                            </span>
                            <Button
                              variant="link"
                              className="p-0 h-auto text-xs sm:text-sm"
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
                          <div className="pt-1">
                            {isOverdue ? (
                              <span className="text-destructive font-semibold text-xs sm:text-sm">
                                متأخرة {Math.abs(daysRemaining)} يوم
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                متبقي {daysRemaining} يوم
                              </span>
                            )}
                          </div>
                        )}
                    </div>

                    {(task.status === TaskStatus.PENDING ||
                      task.status === TaskStatus.OVERDUE) && (
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-2 border-t sm:border-t-0 sm:pt-0">
                        <Button
                          onClick={() => handleQuickExecute(task)}
                          variant="default"
                          className="w-full sm:w-auto"
                          size="sm"
                        >
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                          <span className="hidden sm:inline">تنفيذ المهمة</span>
                          <span className="sm:hidden">تنفيذ</span>
                        </Button>
                        <Button
                          onClick={() => handleCreateRequest(task)}
                          variant="outline"
                          className="w-full sm:w-auto"
                          size="sm"
                        >
                          <Plus className="ml-2 h-4 w-4" />
                          <span className="hidden sm:inline">طلب مخصص</span>
                          <span className="sm:hidden">مخصص</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
            className="w-full sm:w-auto"
          >
            السابق
          </Button>
          <span className="text-xs sm:text-sm text-muted-foreground">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= meta.totalPages}
            className="w-full sm:w-auto"
          >
            التالي
          </Button>
        </div>
      )}

      {/* Execute Task Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">تنفيذ الصيانة الوقائية</DialogTitle>
            <DialogDescription className="text-sm">
              {selectedTaskForExecution?.title}
              <div className="mt-2 space-y-1 text-xs sm:text-sm">
                <p>القسم: {selectedTaskForExecution?.departmentId.name}</p>
                <p>الآلة: {selectedTaskForExecution?.machineId.name}</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                ملاحظات إضافية (اختياري)
              </label>
              <Textarea
                placeholder="أضف أي ملاحظات تريدها..."
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                rows={4}
                className="text-sm"
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExecuteDialogOpen(false);
                  setExecutionNotes("");
                  setSelectedTaskForExecution(null);
                }}
                disabled={createRequestMutation.isPending}
                className="w-full sm:w-auto order-2 sm:order-1"
                size="sm"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={createRequestMutation.isPending}
                className="w-full sm:w-auto order-1 sm:order-2"
                size="sm"
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">جاري الإنشاء...</span>
                    <span className="sm:hidden">جاري...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                    <span className="hidden sm:inline">إنشاء الطلب</span>
                    <span className="sm:hidden">إنشاء</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
