import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { requestsService } from "@/services/requests";
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from "@/services/reference-data";
import { scheduledTasksService } from "@/services/scheduled-tasks";
import { MaintenanceType, ScheduledTask } from "@/types";

const requestSchema = z
  .object({
    maintenanceType: z.nativeEnum(MaintenanceType, {
      errorMap: () => ({ message: "اختر نوع الصيانة" }),
    }),
    locationId: z.string().min(1, "اختر الموقع"),
    departmentId: z.string().min(1, "اختر القسم"),
    systemId: z.string().min(1, "اختر النظام"),
    machineId: z.string().min(1, "اختر الآلة"),
    reasonText: z.string().min(10, "سبب الطلب يجب أن يكون 10 أحرف على الأقل"),
    machineNumber: z.string().optional(),
    engineerNotes: z.string().optional(),
    maintainAllComponents: z.boolean().optional(),
    selectedComponents: z.array(z.string()).optional(),
    scheduledTaskId: z.string().optional(),
  })
  .refine(
    (data) => {
      // If maintainAllComponents is false, selectedComponents must be provided and not empty
      if (data.maintainAllComponents === false) {
        return data.selectedComponents && data.selectedComponents.length > 0;
      }
      return true;
    },
    {
      message: "يجب اختيار مكون واحد على الأقل عند اختيار مكونات محددة",
      path: ["selectedComponents"],
    }
  );

type RequestFormData = z.infer<typeof requestSchema>;

export default function NewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const watchSystemId = watch("systemId");
  const watchMaintainAllComponents = watch("maintainAllComponents");

  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [showAllTasksDialog, setShowAllTasksDialog] = useState(false);
  const [pendingMachineId, setPendingMachineId] = useState<string | null>(null);

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsService.getAll(),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsService.getAll(),
  });

  const { data: systems } = useQuery({
    queryKey: ["systems"],
    queryFn: () => systemsService.getAll(),
  });

  const {
    data: machines,
    isLoading: isLoadingMachines,
    isError: isMachinesError,
  } = useQuery({
    queryKey: ["machines", watchSystemId],
    queryFn: () => machinesService.getBySystem(watchSystemId),
    enabled: !!watchSystemId,
  });

  const { data: pendingTasks } = useQuery({
    queryKey: ["scheduled-tasks", "pending"],
    queryFn: () => scheduledTasksService.getPending(),
  });

  const selectedMachine = machines?.find((m) => m.id === watch("machineId"));
  const hasComponents =
    selectedMachine?.components && selectedMachine.components.length > 0;

  const createMutation = useMutation({
    mutationFn: requestsService.create,
    onSuccess: (newRequest) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      // Navigate to the newly created request details page
      navigate(`/app/requests/${newRequest.id}`);
    },
  });

  const onSubmit = (data: RequestFormData) => {
    createMutation.mutate(data);
  };

  const handleSystemChange = (value: string) => {
    setValue("systemId", value);
    setValue("machineId", "");
    setValue("maintainAllComponents", true);
    setValue("selectedComponents", []);
  };

  const handleMachineChange = (value: string) => {
    setValue("machineId", value);
    // Reset component selection when machine changes
    setValue("maintainAllComponents", true);
    setValue("selectedComponents", []);
  };

  const handleTaskSelect = (task: ScheduledTask) => {
    setSelectedTask(task);
    setValue("scheduledTaskId", task.id);
    setValue("maintenanceType", MaintenanceType.PREVENTIVE); // جميع المهام المرجعية وقائية
    setValue("locationId", task.locationId.id);
    setValue("departmentId", task.departmentId.id);
    setValue("systemId", task.systemId.id);
    // Store machineId to set it after machines are loaded
    setPendingMachineId(task.machineId.id);
    setValue("maintainAllComponents", task.maintainAllComponents);
    setValue("selectedComponents", task.selectedComponents || []);
    setValue("reasonText", task.description || task.title);
    // Close dialog if open
    setShowAllTasksDialog(false);
  };

  // Set machineId after machines are loaded
  useEffect(() => {
    if (pendingMachineId && machines && machines.length > 0) {
      const machineExists = machines.find(m => m.id === pendingMachineId);
      if (machineExists) {
        setValue("machineId", pendingMachineId);
        setPendingMachineId(null);
      }
    }
  }, [machines, pendingMachineId, setValue]);

  const handleClearTask = () => {
    setSelectedTask(null);
    reset();
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

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">طلب صيانة جديد</h2>
          <p className="text-muted-foreground">إنشاء طلب صيانة جديد</p>
        </div>
      </div>

      {/* Scheduled Tasks Section */}
      {pendingTasks && pendingTasks.length > 0 && !selectedTask && (
        <Card>
          <CardHeader>
            <CardTitle>
              الصيانة الوقائية المعلقة ({pendingTasks.length})
            </CardTitle>
            <CardDescription>
              اختر صيانة وقائية لملء البيانات تلقائياً أو أضف طلب جديد
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTasks.slice(0, 3).map((task) => {
                const daysRemaining = getDaysRemaining(task);
                const isOverdue = daysRemaining < 0;
                return (
                  <div
                    key={task.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${isOverdue
                      ? "border-destructive bg-destructive/5 hover:bg-destructive/10"
                      : "border-border hover:bg-accent"
                      }`}
                    onClick={() => handleTaskSelect(task)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{task.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {task.departmentId.name} - {task.machineId.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatScheduledDate(task)}
                        </p>
                      </div>
                      <div className="text-right">
                        {isOverdue ? (
                          <span className="text-destructive font-semibold text-sm">
                            متأخرة {Math.abs(daysRemaining)} يوم
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            متبقي {daysRemaining} يوم
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {pendingTasks.length > 3 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAllTasksDialog(true)}
                >
                  عرض الكل ({pendingTasks.length} مهمة)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog for All Tasks */}
      <Dialog open={showAllTasksDialog} onOpenChange={setShowAllTasksDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>جميع الصيانة الوقائية المعلقة</DialogTitle>
            <DialogDescription>
              اختر صيانة وقائية لملء البيانات تلقائياً ({pendingTasks?.length || 0} مهمة)
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 pr-2">
            {pendingTasks?.map((task) => {
              const daysRemaining = getDaysRemaining(task);
              const isOverdue = daysRemaining < 0;
              return (
                <div
                  key={task.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${isOverdue
                    ? "border-destructive bg-destructive/5 hover:bg-destructive/10"
                    : "border-border hover:bg-accent"
                    }`}
                  onClick={() => handleTaskSelect(task)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold">{task.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.departmentId.name} - {task.machineId.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatScheduledDate(task)}
                      </p>
                    </div>
                    <div className="text-right">
                      {isOverdue ? (
                        <span className="text-destructive font-semibold text-sm">
                          متأخرة {Math.abs(daysRemaining)} يوم
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          متبقي {daysRemaining} يوم
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {selectedTask && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>الصيانة الوقائية المختارة</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearTask}
              >
                إلغاء الاختيار
              </Button>
            </CardTitle>
            <CardDescription>
              {selectedTask.title} - {formatScheduledDate(selectedTask)}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>بيانات الطلب</CardTitle>
          <CardDescription>أدخل تفاصيل طلب الصيانة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {createMutation.isError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                حدث خطأ أثناء إنشاء الطلب
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Maintenance Type */}
              <div className="space-y-2">
                <Label>نوع الصيانة *</Label>
                <Select
                  value={watch("maintenanceType")}
                  onValueChange={(value) =>
                    setValue("maintenanceType", value as MaintenanceType)
                  }
                >
                  <SelectTrigger
                    className={
                      errors.maintenanceType ? "border-destructive" : ""
                    }
                  >
                    <SelectValue placeholder="اختر نوع الصيانة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MaintenanceType.EMERGENCY}>
                      طارئة
                    </SelectItem>
                    <SelectItem value={MaintenanceType.PREVENTIVE}>
                      وقائية
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.maintenanceType && (
                  <p className="text-xs text-destructive">
                    {errors.maintenanceType.message}
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>الموقع *</Label>
                <Select
                  value={watch("locationId")}
                  onValueChange={(value) => setValue("locationId", value)}
                >
                  <SelectTrigger
                    className={errors.locationId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="اختر الموقع" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.locationId && (
                  <p className="text-xs text-destructive">
                    {errors.locationId.message}
                  </p>
                )}
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label>القسم *</Label>
                <Select
                  value={watch("departmentId")}
                  onValueChange={(value) => setValue("departmentId", value)}
                >
                  <SelectTrigger
                    className={errors.departmentId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.departmentId && (
                  <p className="text-xs text-destructive">
                    {errors.departmentId.message}
                  </p>
                )}
              </div>

              {/* System */}
              <div className="space-y-2">
                <Label>النظام *</Label>
                <Select 
                  value={watch("systemId")}
                  onValueChange={handleSystemChange}
                >
                  <SelectTrigger
                    className={errors.systemId ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="اختر النظام" />
                  </SelectTrigger>
                  <SelectContent>
                    {systems?.map((system) => (
                      <SelectItem key={system.id} value={system.id}>
                        {system.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.systemId && (
                  <p className="text-xs text-destructive">
                    {errors.systemId.message}
                  </p>
                )}
              </div>

              {/* Machine */}
              <div className="space-y-2">
                <Label>الآلة *</Label>
                <Select
                  disabled={!watchSystemId || isLoadingMachines}
                  onValueChange={handleMachineChange}
                  value={watch("machineId") || undefined}
                >
                  <SelectTrigger
                    className={errors.machineId ? "border-destructive" : ""}
                  >
                    <SelectValue
                      placeholder={
                        !watchSystemId
                          ? "اختر النظام أولاً"
                          : isLoadingMachines
                            ? "جاري التحميل..."
                            : isMachinesError
                              ? "حدث خطأ في التحميل"
                              : machines && machines.length === 0
                                ? "لا توجد آلات متاحة"
                                : "اختر الآلة"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {machines && machines.length > 0
                      ? machines.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id}>
                          {machine.name}
                        </SelectItem>
                      ))
                      : null}
                  </SelectContent>
                </Select>
                {errors.machineId && (
                  <p className="text-xs text-destructive">
                    {errors.machineId.message}
                  </p>
                )}
                {isMachinesError && (
                  <p className="text-xs text-destructive">
                    حدث خطأ أثناء تحميل الآلات
                  </p>
                )}
              </div>

              {/* Machine Number */}
              <div className="space-y-2">
                <Label>رقم الآلة</Label>
                <Input
                  placeholder="رقم أو كود الآلة"
                  {...register("machineNumber")}
                />
              </div>
            </div>

            {/* Components Selection - Only show if machine has components */}
            {hasComponents && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <Label className="text-base font-semibold">
                  اختيار المكونات
                </Label>
                <p className="text-sm text-muted-foreground">
                  هذه الآلة لديها مكونات. اختر ما إذا كنت تريد صيانة جميع
                  المكونات أو مكونات محددة.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="radio"
                      id="maintainAll"
                      value="all"
                      checked={watchMaintainAllComponents !== false}
                      onChange={() => {
                        setValue("maintainAllComponents", true);
                        setValue("selectedComponents", []);
                      }}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <Label
                      htmlFor="maintainAll"
                      className="cursor-pointer font-normal"
                    >
                      صيانة جميع المكونات
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="radio"
                      id="maintainSpecific"
                      value="specific"
                      checked={watchMaintainAllComponents === false}
                      onChange={() => {
                        setValue("maintainAllComponents", false);
                        setValue("selectedComponents", []);
                      }}
                      className="h-4 w-4 text-primary focus:ring-primary"
                    />
                    <Label
                      htmlFor="maintainSpecific"
                      className="cursor-pointer font-normal"
                    >
                      مكونات محددة
                    </Label>
                  </div>
                </div>

                {watchMaintainAllComponents === false && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm">
                      اختر المكونات المطلوب صيانتها *
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto p-3 border rounded-md bg-background">
                      {selectedMachine?.components?.map((component) => (
                        <div
                          key={component}
                          className="flex items-center space-x-2 space-x-reverse"
                        >
                          <input
                            type="checkbox"
                            id={`component-${component}`}
                            checked={
                              watch("selectedComponents")?.includes(
                                component
                              ) || false
                            }
                            onChange={(e) => {
                              const current = watch("selectedComponents") || [];
                              if (e.target.checked) {
                                setValue("selectedComponents", [
                                  ...current,
                                  component,
                                ]);
                              } else {
                                setValue(
                                  "selectedComponents",
                                  current.filter((c) => c !== component)
                                );
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <Label
                            htmlFor={`component-${component}`}
                            className="cursor-pointer font-normal"
                          >
                            {component}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.selectedComponents && (
                      <p className="text-xs text-destructive">
                        {errors.selectedComponents.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label>سبب طلب الصيانة *</Label>
              <Textarea
                placeholder="وصف تفصيلي للمشكلة أو سبب طلب الصيانة"
                rows={4}
                className={errors.reasonText ? "border-destructive" : ""}
                value={watch("reasonText") || ""}
                onChange={(e) => {
                  setValue("reasonText", e.target.value, { shouldValidate: true });
                }}
              />
              {errors.reasonText && (
                <p className="text-xs text-destructive">
                  {errors.reasonText.message}
                </p>
              )}
            </div>

            {/* Engineer Notes */}
            <div className="space-y-2">
              <Label>ملاحظات المهندس</Label>
              <Textarea
                placeholder="أي ملاحظات إضافية..."
                rows={3}
                {...register("engineerNotes")}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  "إرسال الطلب"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
