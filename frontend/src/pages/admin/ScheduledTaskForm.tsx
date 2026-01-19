import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { scheduledTasksService } from "@/services/scheduled-tasks";
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from "@/services/reference-data";
import { usersService } from "@/services/users";
import { RepetitionInterval } from "@/types";
import { PageLoader } from "@/components/shared/LoadingSpinner";

const taskSchema = z
  .object({
    title: z.string().min(3, "العنوان يجب أن يكون 3 أحرف على الأقل"),
    engineerId: z.string().optional(),
    locationId: z.string().min(1, "اختر الموقع"),
    departmentId: z.string().min(1, "اختر القسم"),
    systemId: z.string().min(1, "اختر النظام"),
    machineId: z.string().min(1, "اختر الآلة"),
    maintainAllComponents: z.boolean().optional(),
    selectedComponents: z.array(z.string()).optional(),
    scheduledMonth: z.number().min(1).max(12),
    scheduledYear: z.number().min(2020),
    scheduledDay: z.number().min(1).max(31).optional(),
    description: z.string().optional(),
    repetitionInterval: z.nativeEnum(RepetitionInterval).optional(),
  })
  .refine(
    (data) => {
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

type TaskFormData = z.infer<typeof taskSchema>;

export default function ScheduledTaskForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
  });

  const watchSystemId = watch("systemId");
  const watchMachineId = watch("machineId");
  const watchMaintainAllComponents = watch("maintainAllComponents");

  const { data: task, isLoading: isLoadingTask } = useQuery({
    queryKey: ["scheduled-task", id],
    queryFn: () => scheduledTasksService.getById(id!),
    enabled: isEditing,
  });

  const { data: locations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsService.getAll(),
  });

  const { data: departments, isLoading: isLoadingDepartments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsService.getAll(),
  });

  const { data: systems, isLoading: isLoadingSystems } = useQuery({
    queryKey: ["systems"],
    queryFn: () => systemsService.getAll(),
  });

  const { data: engineers } = useQuery({
    queryKey: ["engineers"],
    queryFn: () => usersService.getEngineers(),
  });

  // Helper function to get ID from field (used in multiple places)
  const getIdFromFieldHelper = (field: { id?: string; _id?: string } | string | undefined | null): string => {
    if (!field) return "";
    if (typeof field === "string") return field;
    return field.id || field._id || "";
  };

  const taskSystemId = task ? getIdFromFieldHelper(task.systemId) : "";

  // Load machines for the task's system when editing
  const { data: taskMachines, isLoading: isLoadingTaskMachines } = useQuery({
    queryKey: ["machines", taskSystemId],
    queryFn: () => machinesService.getBySystem(taskSystemId),
    enabled: !!(isEditing && taskSystemId),
  });

  const { data: machines, isLoading: isLoadingMachines } = useQuery({
    queryKey: ["machines", watchSystemId],
    queryFn: () => machinesService.getBySystem(watchSystemId),
    enabled: !!watchSystemId && watchSystemId !== taskSystemId,
  });

  // Track if form has been initialized
  const [formInitialized, setFormInitialized] = useState(false);

  // Check if all reference data is loaded
  const isReferenceDataLoaded = !isLoadingLocations && !isLoadingDepartments && !isLoadingSystems && locations && departments && systems;
  const isEditDataReady = isEditing ? (task && !isLoadingTask && !isLoadingTaskMachines && taskMachines) : true;

  useEffect(() => {
    if (task && isEditing && isReferenceDataLoaded && isEditDataReady && !formInitialized) {
      // Get IDs from nested objects - handle both object format and direct ID format
      const getIdFromField = (field: { id?: string; _id?: string } | string | undefined | null): string => {
        if (!field) return "";
        if (typeof field === "string") return field;
        return field.id || field._id || "";
      };

      const locationId = getIdFromField(task.locationId);
      const departmentId = getIdFromField(task.departmentId);
      const systemId = getIdFromField(task.systemId);
      const machineId = getIdFromField(task.machineId);
      const engineerId = getIdFromField(task.engineerId);

      console.log("Setting form values:", {
        locationId,
        departmentId,
        systemId,
        machineId,
        engineerId,
        repetitionInterval: task.repetitionInterval
      });

      // Use setTimeout to ensure components are rendered before setting values
      setTimeout(() => {
        // Set each field individually using setValue with shouldValidate: false
        setValue("title", task.title, { shouldValidate: false, shouldDirty: false });
        setValue("engineerId", engineerId || undefined, { shouldValidate: false, shouldDirty: false });
        setValue("locationId", locationId, { shouldValidate: false, shouldDirty: false });
        setValue("departmentId", departmentId, { shouldValidate: false, shouldDirty: false });
        setValue("systemId", systemId, { shouldValidate: false, shouldDirty: false });
        setValue("machineId", machineId, { shouldValidate: false, shouldDirty: false });
        setValue("maintainAllComponents", task.maintainAllComponents ?? true, { shouldValidate: false, shouldDirty: false });
        setValue("selectedComponents", task.selectedComponents || [], { shouldValidate: false, shouldDirty: false });
        setValue("scheduledMonth", task.scheduledMonth, { shouldValidate: false, shouldDirty: false });
        setValue("scheduledYear", task.scheduledYear, { shouldValidate: false, shouldDirty: false });
        setValue("scheduledDay", task.scheduledDay || 1, { shouldValidate: false, shouldDirty: false });
        setValue("description", task.description || "", { shouldValidate: false, shouldDirty: false });
        setValue("repetitionInterval", task.repetitionInterval, { shouldValidate: false, shouldDirty: false });
        
        console.log("Form values set, current values:", {
          locationId: watch("locationId"),
          departmentId: watch("departmentId"),
          systemId: watch("systemId"),
        });
      }, 100);
      
      setFormInitialized(true);
      
      // Set the date picker value
      const day = task.scheduledDay || 1;
      setScheduledDate(new Date(task.scheduledYear, task.scheduledMonth - 1, day));
    }
  }, [task, isEditing, setValue, isReferenceDataLoaded, isEditDataReady, formInitialized]);

  const createMutation = useMutation({
    mutationFn: scheduledTasksService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      navigate("/app/admin/scheduled-tasks");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TaskFormData>) =>
      scheduledTasksService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      navigate("/app/admin/scheduled-tasks");
    },
  });

  const onSubmit = (data: TaskFormData) => {
    // Remove engineerId if it's empty string
    const submitData = {
      ...data,
      engineerId: data.engineerId || undefined,
    };
    
    if (isEditing) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleSystemChange = (value: string) => {
    setValue("systemId", value);
    setValue("machineId", "");
    setValue("maintainAllComponents", true);
    setValue("selectedComponents", []);
  };

  const handleMachineChange = (value: string) => {
    setValue("machineId", value);
    setValue("maintainAllComponents", true);
    setValue("selectedComponents", []);
  };

  // Use taskMachines when editing, otherwise use machines
  const availableMachines = taskMachines || machines;
  
  const selectedMachine = availableMachines?.find((m) => m.id === watchMachineId);

  // Show loader while loading data for editing
  const isLoadingEditData = isEditing && (!isReferenceDataLoaded || !isEditDataReady);

  // Debug logging
  if (isEditing && formInitialized) {
    console.log("Current form values:", {
      locationId: watch("locationId"),
      departmentId: watch("departmentId"),
      systemId: watch("systemId"),
      machineId: watch("machineId"),
      engineerId: watch("engineerId"),
      repetitionInterval: watch("repetitionInterval"),
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {isEditing ? "تعديل صيانة وقائية" : "إضافة صيانة وقائية جديدة"}
          </h2>
          <p className="text-muted-foreground">
            {isEditing
              ? "تعديل بيانات الصيانة الوقائية"
              : "إنشاء صيانة وقائية جديدة للمهندسين"}
          </p>
        </div>
      </div>

      {isLoadingEditData ? (
        <PageLoader />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>بيانات الصيانة الوقائية</CardTitle>
            <CardDescription>أدخل تفاصيل الصيانة الوقائية</CardDescription>
          </CardHeader>
          <CardContent>
            <form key={isEditing ? task?.id : 'new'} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {(createMutation.isError || updateMutation.isError) && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  حدث خطأ أثناء {isEditing ? "تعديل" : "إنشاء"} الصيانة الوقائية
                </div>
              )}

            <div className="space-y-2">
              <Label>عنوان المهمة *</Label>
              <Input
                placeholder="مثال: صيانة دورية - تشيلر #5"
                {...register("title")}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>المهندس (اختياري)</Label>
                <Select
                  onValueChange={(value) => setValue("engineerId", value === "__none__" ? undefined : value)}
                  value={watch("engineerId") || "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اتركه فارغاً للمهام المتاحة لجميع المهندسين" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">لا يوجد (مهمة متاحة لجميع المهندسين)</SelectItem>
                    {engineers?.map(
                      (engineer: { id: string; name: string }) => (
                        <SelectItem key={engineer.id} value={engineer.id}>
                          {engineer.name}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  اتركه فارغاً لجعل المهمة متاحة لجميع المهندسين
                </p>
              </div>

              <div className="space-y-2">
                <Label>الموقع *</Label>
                <Select
                  onValueChange={(value) => setValue("locationId", value)}
                  value={watch("locationId") || undefined}
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

              <div className="space-y-2">
                <Label>القسم *</Label>
                <Select
                  onValueChange={(value) => setValue("departmentId", value)}
                  value={watch("departmentId") || undefined}
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

              <div className="space-y-2">
                <Label>النظام *</Label>
                <Select
                  onValueChange={handleSystemChange}
                  value={watch("systemId") || undefined}
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

              <div className="space-y-2">
                <Label>الآلة *</Label>
                <Select
                  onValueChange={handleMachineChange}
                  value={watch("machineId")}
                  disabled={!watchSystemId || isLoadingMachines}
                >
                  <SelectTrigger
                    className={errors.machineId ? "border-destructive" : ""}
                  >
                    <SelectValue
                      placeholder={
                        isLoadingMachines
                          ? "جاري التحميل..."
                          : !watchSystemId
                          ? "اختر النظام أولاً"
                          : "اختر الآلة"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMachines?.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.machineId && (
                  <p className="text-xs text-destructive">
                    {errors.machineId.message}
                  </p>
                )}
              </div>

            </div>

            <div className="space-y-2">
              <Label>تاريخ المهمة المجدولة *</Label>
              <DatePicker
                date={scheduledDate}
                onDateChange={(date) => {
                  setScheduledDate(date);
                  if (date) {
                    setValue("scheduledYear", date.getFullYear());
                    setValue("scheduledMonth", date.getMonth() + 1);
                    setValue("scheduledDay", date.getDate());
                  }
                }}
                placeholder="اختر تاريخ المهمة"
              />
              {(errors.scheduledYear || errors.scheduledMonth || errors.scheduledDay) && (
                <p className="text-xs text-destructive">
                  {errors.scheduledYear?.message || errors.scheduledMonth?.message || errors.scheduledDay?.message}
                </p>
              )}
            </div>

            {watchMachineId && selectedMachine && selectedMachine.components && selectedMachine.components.length > 0 && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-3">
                  <Label className="text-base font-semibold">المكونات</Label>
                  
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <Checkbox
                      id="all-components"
                      checked={watchMaintainAllComponents !== false}
                      onCheckedChange={(checked) => {
                        setValue("maintainAllComponents", checked as boolean);
                        if (checked) {
                          setValue("selectedComponents", []);
                        }
                      }}
                    />
                    <Label
                      htmlFor="all-components"
                      className="cursor-pointer font-medium"
                    >
                      جميع المكونات ({selectedMachine.components.length})
                    </Label>
                  </div>

                  {watchMaintainAllComponents === false && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          المكونات المحددة ({watch("selectedComponents")?.length || 0}/{selectedMachine.components.length})
                        </Label>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => {
                            setValue("selectedComponents", selectedMachine.components || []);
                          }}
                        >
                          تحديد الكل
                        </Button>
                      </div>
                      
                      <div className="grid gap-2 max-h-48 overflow-y-auto p-3 border rounded-md bg-background">
                        {selectedMachine.components.map((component) => (
                          <div
                            key={component}
                            className="flex items-center space-x-3 space-x-reverse"
                          >
                            <Checkbox
                              id={`component-${component}`}
                              checked={
                                watch("selectedComponents")?.includes(
                                  component
                                ) || false
                              }
                              onCheckedChange={(checked) => {
                                const current =
                                  watch("selectedComponents") || [];
                                if (checked) {
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
              </div>
            )}

            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                placeholder="وصف إضافي للصيانة الوقائية..."
                rows={3}
                {...register("description")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>معدل التكرار (اختياري)</Label>
                <Select
                  onValueChange={(value) =>
                    setValue("repetitionInterval", value === "__none__" ? undefined : value as RepetitionInterval)
                  }
                  value={watch("repetitionInterval") || "__none__"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر معدل التكرار" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">لا يوجد تكرار</SelectItem>
                    <SelectItem value={RepetitionInterval.WEEKLY}>
                      أسبوعي
                    </SelectItem>
                    <SelectItem value={RepetitionInterval.MONTHLY}>
                      شهري
                    </SelectItem>
                    <SelectItem value={RepetitionInterval.QUARTERLY}>
                      كل 3 أشهر
                    </SelectItem>
                    <SelectItem value={RepetitionInterval.SEMI_ANNUALLY}>
                      كل 6 أشهر
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  سيتم إنشاء مهام جديدة تلقائياً حسب المعدل المحدد
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : isEditing ? (
                  "تحديث"
                ) : (
                  "إنشاء"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
