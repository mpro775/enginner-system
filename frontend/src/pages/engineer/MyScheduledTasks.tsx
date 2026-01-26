import { useState } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Filter,
  Calendar,
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
  const base = "inline-flex items-center gap-1 rounded-full text-[10px] sm:text-xs font-medium shrink-0";
  switch (status) {
    case TaskStatus.PENDING:
      return (
        <span className={`${base} px-2 py-0.5 sm:px-2.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200`}>
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          معلقة
        </span>
      );
    case TaskStatus.COMPLETED:
      return (
        <span className={`${base} px-2 py-0.5 sm:px-2.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200`}>
          <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          مكتملة
        </span>
      );
    case TaskStatus.OVERDUE:
      return (
        <span className={`${base} px-2 py-0.5 sm:px-2.5 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200`}>
          <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          متأخرة
        </span>
      );
    case TaskStatus.CANCELLED:
      return (
        <span className={`${base} px-2 py-0.5 sm:px-2.5 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200`}>
          <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
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
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const toggleDescription = (taskId: string) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

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
      <div className="w-full max-w-full px-3 py-6 sm:px-6">
        <div className="text-center text-destructive text-sm sm:text-base">
          حدث خطأ أثناء تحميل الصيانة الوقائية
        </div>
      </div>
    );
  }

  const tasks = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">صيانتي الوقائية</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm md:text-base">
            عرض وإدارة الصيانة الوقائية المخصصة لك
          </p>
        </div>
        <Button 
          onClick={() => navigate("/requests/new")}
          className="w-full sm:w-auto shrink-0"
          size="sm"
        >
          <Plus className="ml-2 h-4 w-4" />
          طلب صيانة جديد
        </Button>
      </div>

      {/* Available Tasks Section */}
      {availableTasks.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 overflow-hidden">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              المهام المتاحة
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
              صيانة وقائية متاحة لجميع المهندسين - يمكنك قبول أي صيانة منها
            </p>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="grid gap-3 sm:gap-4">
              {availableTasks.map((task) => {
                const daysRemaining = getDaysRemaining(task);
                const isOverdue = daysRemaining < 0;

                return (
                  <Card key={task.id} className="bg-card overflow-hidden">
                    <CardContent className="p-3 sm:p-4 md:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
                          {/* العنوان والحالة */}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <h4 className="text-base sm:text-lg md:text-xl font-bold text-foreground break-words w-full sm:w-auto">
                                {task.title}
                              </h4>
                              {getStatusBadge(task.status)}
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 sm:py-1 rounded shrink-0">
                                {task.taskCode}
                              </span>
                            </div>
                          </div>

                          {/* التفاصيل الرئيسية */}
                          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <Calendar className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block mt-0.5" />
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm text-muted-foreground block mb-0.5">التاريخ المحدد:</span>
                                <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                                  {formatScheduledDate(task)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">الموقع:</span>
                              <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                                {task.locationId?.name || "-"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">القسم:</span>
                              <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                                {task.departmentId.name}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">النظام:</span>
                              <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                                {task.systemId?.name || "-"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">الآلة:</span>
                              <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                                {task.machineId.name}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px] sm:hidden">الوقت:</span>
                              <span className={`text-xs sm:text-sm font-medium break-words ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                                {isOverdue 
                                  ? `متأخرة ${Math.abs(daysRemaining)} يوم`
                                  : `متبقي ${daysRemaining} يوم`}
                              </span>
                            </div>
                          </div>

                          {/* المكونات */}
                          {task.machineId?.components && task.machineId.components.length > 0 && (
                            <div className="space-y-1.5 sm:space-y-2">
                              <span className="text-xs sm:text-sm font-medium text-muted-foreground block">
                                المكونات:
                              </span>
                              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {task.maintainAllComponents ? (
                                  <span className="text-xs sm:text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                                    جميع المكونات ({task.machineId.components.length})
                                  </span>
                                ) : task.selectedComponents && task.selectedComponents.length > 0 ? (
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
                                      className="text-primary hover:underline text-xs sm:text-sm mt-1 font-medium"
                                    >
                                      {expandedDescriptions[task.id] ? "عرض أقل" : "قراءة المزيد"}
                                    </button>
                                  </>
                                ) : (
                                  <p className="whitespace-pre-wrap break-words">{task.description}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* معلومات إضافية */}
                          {task.repetitionInterval && (
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm pt-2 border-t">
                              <span className="text-muted-foreground">معدل التكرار:</span>
                              <span className="font-medium text-foreground">
                                {task.repetitionInterval === "weekly" && "أسبوعي"}
                                {task.repetitionInterval === "monthly" && "شهري"}
                                {task.repetitionInterval === "quarterly" && "كل 3 أشهر"}
                                {task.repetitionInterval === "semi_annually" && "كل 6 أشهر"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* زر قبول المهمة */}
                        <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 flex sm:block">
                          <Button
                            onClick={() => handleAcceptTask(task)}
                            disabled={acceptTaskMutation.isPending}
                            size="sm"
                            className="w-full sm:w-auto"
                          >
                            {acceptTaskMutation.isPending ? (
                              <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin shrink-0" />
                                <span className="truncate">جاري القبول...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="ml-2 h-4 w-4 shrink-0" />
                                <span className="truncate">قبول المهمة</span>
                              </>
                            )}
                          </Button>
                        </div>
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

      {/* Tasks List */}
      <div className="grid gap-3 sm:gap-4">
        {tasks.length === 0 ? (
          <Card className="overflow-hidden">
            <CardContent className="py-8 sm:py-12 px-4 text-center">
              <p className="text-xs sm:text-sm md:text-base text-muted-foreground">لا توجد صيانة وقائية</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const daysRemaining = getDaysRemaining(task);
            const isOverdue = daysRemaining < 0;

            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow overflow-hidden">
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
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 sm:py-1 rounded shrink-0">
                            {task.taskCode}
                          </span>
                        </div>
                      </div>

                      {/* التفاصيل الرئيسية */}
                      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm text-muted-foreground block mb-0.5">التاريخ المحدد:</span>
                            <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                              {formatScheduledDate(task)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                          <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">الموقع:</span>
                          <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                            {task.locationId?.name || "-"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                          <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">القسم:</span>
                          <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                            {task.departmentId.name}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                          <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">النظام:</span>
                          <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                            {task.systemId?.name || "-"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                          <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">الآلة:</span>
                          <span className="text-xs sm:text-sm font-medium text-foreground break-words">
                            {task.machineId.name}
                          </span>
                        </div>
                        {task.status !== TaskStatus.COMPLETED &&
                          task.status !== TaskStatus.CANCELLED && (
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2 min-w-0">
                              <span className="text-xs sm:text-sm text-muted-foreground sm:min-w-[70px]">الوقت المتبقي:</span>
                              <span className={`text-xs sm:text-sm font-medium break-words ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                                {isOverdue 
                                  ? `متأخرة ${Math.abs(daysRemaining)} يوم`
                                  : `متبقي ${daysRemaining} يوم`}
                              </span>
                            </div>
                          )}
                      </div>

                      {/* المكونات */}
                      {task.machineId?.components && task.machineId.components.length > 0 && (
                        <div className="space-y-1.5 sm:space-y-2">
                          <span className="text-xs sm:text-sm font-medium text-muted-foreground block">
                            المكونات:
                          </span>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {task.maintainAllComponents ? (
                              <span className="text-xs sm:text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                                جميع المكونات ({task.machineId.components.length})
                              </span>
                            ) : task.selectedComponents && task.selectedComponents.length > 0 ? (
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
                                  className="text-primary hover:underline text-xs sm:text-sm mt-1 font-medium"
                                >
                                  {expandedDescriptions[task.id] ? "عرض أقل" : "قراءة المزيد"}
                                </button>
                              </>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{task.description}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* معلومات إضافية */}
                      <div className="space-y-2 pt-2 border-t">
                        {task.repetitionInterval && (
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                            <span className="text-muted-foreground">معدل التكرار:</span>
                            <span className="font-medium text-foreground">
                              {task.repetitionInterval === "weekly" && "أسبوعي"}
                              {task.repetitionInterval === "monthly" && "شهري"}
                              {task.repetitionInterval === "quarterly" && "كل 3 أشهر"}
                              {task.repetitionInterval === "semi_annually" && "كل 6 أشهر"}
                            </span>
                          </div>
                        )}

                        {task.status === TaskStatus.COMPLETED &&
                          task.completedRequestId && (
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <span className="text-muted-foreground">الطلب المكتمل:</span>
                              <Button
                                variant="link"
                                className="p-0 h-auto text-xs sm:text-sm font-medium min-w-0"
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
                      </div>
                    </div>

                    {/* أزرار الإجراءات */}
                    {(task.status === TaskStatus.PENDING ||
                      task.status === TaskStatus.OVERDUE) && (
                      <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                        <Button
                          onClick={() => handleQuickExecute(task)}
                          variant="default"
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          <CheckCircle2 className="h-4 w-4 ml-2 shrink-0" />
                          <span className="truncate">تنفيذ المهمة</span>
                        </Button>
                        <Button
                          onClick={() => handleCreateRequest(task)}
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          <Plus className="h-4 w-4 ml-2 shrink-0" />
                          <span className="truncate">طلب مخصص</span>
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
        <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2 px-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            disabled={filters.page === 1}
            className="flex-1 min-w-[100px] sm:flex-none sm:min-w-0"
          >
            السابق
          </Button>
          <span className="text-xs sm:text-sm text-muted-foreground shrink-0 px-2">
            صفحة {meta.page} من {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            disabled={filters.page >= meta.totalPages}
            className="flex-1 min-w-[100px] sm:flex-none sm:min-w-0"
          >
            التالي
          </Button>
        </div>
      )}

      {/* Execute Task Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md w-[calc(100vw-1.5rem)] sm:w-full p-4 sm:p-6 overflow-y-auto max-h-[90dvh] overflow-x-hidden">
          <DialogHeader className="space-y-2 px-1 sm:px-0 gap-2">
            <DialogTitle className="text-base sm:text-lg md:text-xl break-words pr-8">تنفيذ الصيانة الوقائية</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              <span className="block mb-2">{selectedTaskForExecution?.title}</span>
              <div className="space-y-1 text-muted-foreground">
                <p className="break-words">القسم: {selectedTaskForExecution?.departmentId.name}</p>
                <p className="break-words">الآلة: {selectedTaskForExecution?.machineId.name}</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteSubmit} className="space-y-4">
            <div className="space-y-2 min-w-0">
              <label className="text-xs sm:text-sm font-medium block">
                ملاحظات إضافية (اختياري)
              </label>
              <Textarea
                placeholder="أضف أي ملاحظات تريدها..."
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                rows={4}
                className="text-sm min-h-[80px] resize-y max-w-full"
              />
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExecuteDialogOpen(false);
                  setExecutionNotes("");
                  setSelectedTaskForExecution(null);
                }}
                disabled={createRequestMutation.isPending}
                className="w-full sm:w-auto"
                size="sm"
              >
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={createRequestMutation.isPending}
                className="w-full sm:w-auto"
                size="sm"
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin shrink-0" />
                    <span className="hidden sm:inline">جاري الإنشاء...</span>
                    <span className="sm:hidden">جاري...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="ml-2 h-4 w-4 shrink-0" />
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
