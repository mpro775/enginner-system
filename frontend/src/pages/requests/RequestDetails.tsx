import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Building2,
  Cog,
  Wrench,
  User,
  CheckCircle2,
  StopCircle,
  MessageSquarePlus,
  Loader2,
  AlertTriangle,
  Edit,
  RefreshCw,
  AlertCircle,
  Printer,
} from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  StatusBadge,
  MaintenanceTypeBadge,
} from "@/components/shared/StatusBadge";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { requestsService } from "@/services/requests";
import { reportsService } from "@/services/reports";
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from "@/services/reference-data";
import { useAuthStore } from "@/store/auth";
import { formatDateTime } from "@/lib/utils";
import { RequestStatus, Role, MaintenanceType } from "@/types";

const updateRequestSchema = z.object({
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
});

type UpdateRequestFormData = z.infer<typeof updateRequestSchema>;

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [showStopDialog, setShowStopDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showHealthSafetyNoteDialog, setShowHealthSafetyNoteDialog] =
    useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [consultantNotes, setConsultantNotes] = useState("");
  const [healthSafetyNotes, setHealthSafetyNotes] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateRequestFormData>({
    resolver: zodResolver(updateRequestSchema),
  });

  const watchSystemId = watch("systemId");

  // Helper function to parse note with author name
  const parseNoteWithAuthor = (note: string) => {
    // Match pattern: text (author) at the end
    const match = note.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (match) {
      return { text: match[1].trim(), author: match[2].trim() };
    }
    return { text: note, author: null };
  };

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", id],
    queryFn: () => requestsService.getById(id!),
    enabled: !!id,
  });

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

  const stopMutation = useMutation({
    mutationFn: (reason: string) =>
      requestsService.stop(id!, { stopReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowStopDialog(false);
      setStopReason("");
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (notes: string) =>
      requestsService.addNote(id!, { consultantNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowNoteDialog(false);
      setConsultantNotes("");
    },
  });

  const addHealthSafetyNoteMutation = useMutation({
    mutationFn: (notes: string) =>
      requestsService.addHealthSafetyNote(id!, { healthSafetyNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowHealthSafetyNoteDialog(false);
      setHealthSafetyNotes("");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => requestsService.complete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateRequestFormData) =>
      requestsService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowEditDialog(false);
    },
  });

  // Calculate user permissions early
  const isEngineer = user?.role === Role.ENGINEER;
  const isConsultant = user?.role === Role.CONSULTANT;
  const isMaintenanceManager = user?.role === Role.MAINTENANCE_MANAGER;
  const isMaintenanceSafetyMonitor =
    user?.role === Role.MAINTENANCE_SAFETY_MONITOR;
  const isAdmin = user?.role === Role.ADMIN;

  // Open edit dialog if edit=true in URL - moved here to ensure consistent hook order
  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (
      editParam === "true" &&
      request &&
      isEngineer &&
      request.engineerId?.id === user?.id &&
      request.status === RequestStatus.IN_PROGRESS
    ) {
      reset({
        maintenanceType: request.maintenanceType,
        locationId: request.locationId?.id || "",
        departmentId: request.departmentId?.id || "",
        systemId: request.systemId?.id || "",
        machineId: request.machineId?.id || "",
        reasonText: request.reasonText,
        machineNumber: request.machineNumber || "",
        engineerNotes: request.engineerNotes || "",
      });
      setShowEditDialog(true);
      // Remove the query parameter from URL
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, searchParams, user]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">الطلب غير موجود</p>
      </div>
    );
  }

  const isOwner = isEngineer && request.engineerId?.id === user?.id;
  const canEdit = isOwner && request.status === RequestStatus.IN_PROGRESS;
  const canStop = isOwner && request.status === RequestStatus.IN_PROGRESS;
  const canComplete = isOwner && request.status === RequestStatus.IN_PROGRESS;
  const canAddNote =
    (isConsultant || isMaintenanceManager || isAdmin) &&
    request.status !== RequestStatus.STOPPED;
  const canAddHealthSafetyNote =
    (isMaintenanceSafetyMonitor || isAdmin) &&
    request.status !== RequestStatus.STOPPED;

  const handleStop = () => {
    setShowStopDialog(true);
  };

  const handleAddNote = () => {
    const notes = request.consultantNotes || "";
    // Remove author name from the end if present
    const { text } = parseNoteWithAuthor(notes);
    setConsultantNotes(text);
    setShowNoteDialog(true);
  };

  const handleAddHealthSafetyNote = () => {
    const notes = request.healthSafetyNotes || "";
    // Remove author name from the end if present
    const { text } = parseNoteWithAuthor(notes);
    setHealthSafetyNotes(text);
    setShowHealthSafetyNoteDialog(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["request", id] });
  };

  const handlePrint = async () => {
    if (!id || downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      await reportsService.downloadSingleRequestReport(id);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("حدث خطأ أثناء تحميل التقرير");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleEdit = () => {
    if (request) {
      reset({
        maintenanceType: request.maintenanceType,
        locationId: request.locationId?.id || "",
        departmentId: request.departmentId?.id || "",
        systemId: request.systemId?.id || "",
        machineId: request.machineId?.id || "",
        reasonText: request.reasonText,
        machineNumber: request.machineNumber || "",
        engineerNotes: request.engineerNotes || "",
      });
      setShowEditDialog(true);
    }
  };

  const handleSystemChange = (value: string) => {
    setValue("systemId", value);
    setValue("machineId", "");
  };

  const onSubmitEdit = (data: UpdateRequestFormData) => {
    updateMutation.mutate(data);
  };

  const submitStop = () => {
    if (stopReason.trim()) {
      stopMutation.mutate(stopReason);
    }
  };

  const submitNote = () => {
    if (consultantNotes.trim()) {
      addNoteMutation.mutate(consultantNotes);
    }
  };

  const submitHealthSafetyNote = () => {
    if (healthSafetyNotes.trim()) {
      addHealthSafetyNoteMutation.mutate(healthSafetyNotes);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {/* Header - Responsive */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
                {request.requestCode}
              </h2>
              {/* Badges inline with title on mobile */}
              <div className="flex items-center gap-2 sm:hidden">
                <StatusBadge status={request.status} />
                <MaintenanceTypeBadge type={request.maintenanceType} />
              </div>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">تفاصيل طلب الصيانة</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 justify-end">
          {/* Print button - icon only on mobile */}
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden"
            onClick={handlePrint}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
          </Button>
          {/* Print button - full on desktop */}
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={handlePrint}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="ml-2 h-4 w-4" />
            )}
            {downloadingPdf ? "جاري التحميل..." : "طباعة التقرير"}
          </Button>
          {/* Badges hidden on mobile (shown inline with title) */}
          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <StatusBadge status={request.status} />
            <MaintenanceTypeBadge type={request.maintenanceType} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل الطلب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">الموقع</p>
                    <p className="font-medium">{request.locationId?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">القسم</p>
                    <p className="font-medium">{request.departmentId?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Cog className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">النظام</p>
                    <p className="font-medium">{request.systemId?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">الآلة</p>
                    <p className="font-medium">
                      {request.machineId?.name}
                      {request.machineNumber && ` (${request.machineNumber})`}
                    </p>
                  </div>
                </div>
              </div>

              {request.machineId?.description && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    وصف الآلة
                  </p>
                  <p className="font-medium">{request.machineId.description}</p>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  المكونات المختارة
                </p>
                {request.maintainAllComponents ? (
                  <p className="font-medium">جميع المكونات</p>
                ) : (
                  <div>
                    {request.selectedComponents &&
                      request.selectedComponents.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1">
                        {request.selectedComponents.map((component, index) => (
                          <li key={index} className="font-medium">
                            {component}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">
                        لا توجد مكونات محددة
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">
                  سبب طلب الصيانة
                </p>
                <p className="font-medium">{request.reasonText}</p>
              </div>

              {request.engineerNotes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    ملاحظات المهندس
                  </p>
                  <p>{request.engineerNotes}</p>
                </div>
              )}

              {request.consultantNotes && (() => {
                const { text, author } = parseNoteWithAuthor(request.consultantNotes);
                return (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      ملاحظات المكتب الاستشاري
                    </p>
                    <p className="mb-1">{text}</p>
                    {author && (
                      <p className="text-xs text-muted-foreground text-left">
                        - {author}
                      </p>
                    )}
                  </div>
                );
              })()}

              {request.healthSafetyNotes && (() => {
                const { text, author } = parseNoteWithAuthor(request.healthSafetyNotes);
                return (
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      ملاحظات مراقب الصيانة والسلامة
                    </p>
                    <p className="mb-1">{text}</p>
                    {author && (
                      <p className="text-xs text-muted-foreground text-left">
                        - {author}
                      </p>
                    )}
                  </div>
                );
              })()}

              {request.status === RequestStatus.STOPPED &&
                request.stopReason && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <p className="text-sm text-orange-600 font-medium">
                        سبب الإيقاف
                      </p>
                    </div>
                    <p className="text-orange-700 bg-orange-50 p-3 rounded-lg">
                      {request.stopReason}
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Linked Complaint */}
          {request.complaintId && (
            <Card>
              <CardHeader>
                <CardTitle>البلاغ المرتبط</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {typeof request.complaintId === "string"
                        ? request.complaintId
                        : (request.complaintId as any).complaintCode}
                    </p>
                    {typeof request.complaintId !== "string" && (
                      <p className="text-sm text-muted-foreground">
                        مقدم البلاغ: {(request.complaintId as any).reporterName}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/app/complaints/${typeof request.complaintId === "string"
                          ? request.complaintId
                          : (request.complaintId as any).id
                        }`
                      )
                    }
                  >
                    <AlertCircle className="h-4 w-4 ml-2" />
                    عرض البلاغ
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {(canEdit ||
            canStop ||
            canComplete ||
            canAddNote ||
            canAddHealthSafetyNote) && (
              <Card>
                <CardHeader>
                  <CardTitle>الإجراءات المتاحة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {canEdit && (
                      <Button
                        variant="outline"
                        onClick={handleEdit}
                        className="flex-1"
                      >
                        <Edit className="ml-2 h-4 w-4" />
                        تعديل الطلب
                      </Button>
                    )}
                    {canComplete && (
                      <Button
                        onClick={() => completeMutation.mutate()}
                        disabled={completeMutation.isPending}
                        className="flex-1"
                      >
                        {completeMutation.isPending ? (
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                        )}
                        إكمال الطلب
                      </Button>
                    )}
                    {canStop && (
                      <Button
                        variant="destructive"
                        onClick={handleStop}
                        className="flex-1"
                      >
                        <StopCircle className="ml-2 h-4 w-4" />
                        إيقاف الطلب
                      </Button>
                    )}
                    {canAddNote && (
                      <Button
                        variant="outline"
                        onClick={handleAddNote}
                        className="flex-1"
                      >
                        <MessageSquarePlus className="ml-2 h-4 w-4" />
                        {request.consultantNotes
                          ? "تعديل الملاحظة"
                          : "إضافة ملاحظة"}
                      </Button>
                    )}
                    {canAddHealthSafetyNote && (
                      <Button
                        variant="outline"
                        onClick={handleAddHealthSafetyNote}
                        className="flex-1"
                      >
                        <MessageSquarePlus className="ml-2 h-4 w-4" />
                        {request.healthSafetyNotes
                          ? "تعديل ملاحظة الصحة والسلامة"
                          : "إضافة ملاحظة الصحة والسلامة"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleRefresh}
                      className="flex-1"
                    >
                      <RefreshCw className="ml-2 h-4 w-4" />
                      تحديث
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>المخطط الزمني</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">تاريخ الفتح</p>
                  <p className="font-medium">
                    {formatDateTime(request.openedAt)}
                  </p>
                </div>
              </div>
              {request.closedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      تاريخ الإكمال
                    </p>
                    <p className="font-medium">
                      {formatDateTime(request.closedAt)}
                    </p>
                  </div>
                </div>
              )}
              {request.stoppedAt && (
                <div className="flex items-center gap-3">
                  <StopCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      تاريخ الإيقاف
                    </p>
                    <p className="font-medium">
                      {formatDateTime(request.stoppedAt)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* People */}
          <Card>
            <CardHeader>
              <CardTitle>المعنيون</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">المهندس</p>
                  <p className="font-medium">{request.engineerId?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.engineerId?.email}
                  </p>
                </div>
              </div>
              {request.consultantId && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">الاستشاري</p>
                    <p className="font-medium">{request.consultantId?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.consultantId?.email}
                    </p>
                  </div>
                </div>
              )}
              {request.healthSafetySupervisorId && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      مراقب الصيانة والسلامة
                    </p>
                    <p className="font-medium">
                      {request.healthSafetySupervisorId?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {request.healthSafetySupervisorId?.email}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stop Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إيقاف الطلب</DialogTitle>
            <DialogDescription>
              يرجى توضيح سبب إيقاف هذا الطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">سبب الإيقاف *</label>
              <Textarea
                placeholder="أدخل سبب إيقاف الطلب..."
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStopDialog(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={submitStop}
              disabled={stopMutation.isPending || !stopReason.trim()}
            >
              {stopMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                "إيقاف الطلب"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة ملاحظة</DialogTitle>
            <DialogDescription>أضف ملاحظاتك على هذا الطلب</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                ملاحظات المكتب الاستشاري *
              </label>
              <Textarea
                placeholder="أدخل ملاحظاتك هنا..."
                value={consultantNotes}
                onChange={(e) => setConsultantNotes(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={submitNote}
              disabled={addNoteMutation.isPending || !consultantNotes.trim()}
            >
              {addNoteMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                "حفظ الملاحظة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Health Safety Note Dialog */}
      <Dialog
        open={showHealthSafetyNoteDialog}
        onOpenChange={setShowHealthSafetyNoteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة ملاحظة الصحة والسلامة</DialogTitle>
            <DialogDescription>
              أضف ملاحظاتك المتعلقة بالصحة والسلامة المهنية على هذا الطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                ملاحظات مراقب الصيانة والسلامة *
              </label>
              <Textarea
                placeholder="أدخل ملاحظاتك المتعلقة بالصحة والسلامة هنا..."
                value={healthSafetyNotes}
                onChange={(e) => setHealthSafetyNotes(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowHealthSafetyNoteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={submitHealthSafetyNote}
              disabled={
                addHealthSafetyNoteMutation.isPending ||
                !healthSafetyNotes.trim()
              }
            >
              {addHealthSafetyNoteMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                "حفظ الملاحظة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الطلب</DialogTitle>
            <DialogDescription>قم بتعديل تفاصيل الطلب</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
            {updateMutation.isError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                حدث خطأ أثناء تعديل الطلب
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Maintenance Type */}
              <div className="space-y-2">
                <Label>نوع الصيانة *</Label>
                <Select
                  onValueChange={(value) =>
                    setValue("maintenanceType", value as MaintenanceType)
                  }
                  defaultValue={request?.maintenanceType}
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
                  onValueChange={(value) => setValue("locationId", value)}
                  defaultValue={request?.locationId?.id}
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
                  onValueChange={(value) => setValue("departmentId", value)}
                  defaultValue={request?.departmentId?.id}
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
                  onValueChange={handleSystemChange}
                  defaultValue={request?.systemId?.id}
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
                  onValueChange={(value) => setValue("machineId", value)}
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

            {/* Reason */}
            <div className="space-y-2">
              <Label>سبب طلب الصيانة *</Label>
              <Textarea
                placeholder="وصف تفصيلي للمشكلة أو سبب طلب الصيانة"
                rows={4}
                className={errors.reasonText ? "border-destructive" : ""}
                {...register("reasonText")}
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  "حفظ التعديلات"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
