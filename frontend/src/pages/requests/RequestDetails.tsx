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
  Trash2,
  Eye,
  Download,
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
import { useToast } from "@/hooks/use-toast";

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
  requestNeeds: z.string().optional(),
  implementedWork: z.string().optional(),
});

type UpdateRequestFormData = z.infer<typeof updateRequestSchema>;

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [showStopDialog, setShowStopDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showHealthSafetyNoteDialog, setShowHealthSafetyNoteDialog] =
    useState(false);
  const [showProjectManagerNoteDialog, setShowProjectManagerNoteDialog] =
    useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [softDeleteDialog, setSoftDeleteDialog] = useState(false);
  const [hardDeleteDialog, setHardDeleteDialog] = useState(false);
  const [stopReason, setStopReason] = useState("");
  const [consultantNotes, setConsultantNotes] = useState("");
  const [healthSafetyNotes, setHealthSafetyNotes] = useState("");
  const [projectManagerNotes, setProjectManagerNotes] = useState("");
  const [implementedWork, setImplementedWork] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pdfIframeRef, setPdfIframeRef] = useState<HTMLIFrameElement | null>(
    null
  );
  const [expandedDescriptions, setExpandedDescriptions] = useState<
    Record<string, boolean>
  >({});

  const toggleDescription = (key: string) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderFormattedText = (text: string, key: string, maxLength = 100) => {
    if (!text?.trim()) return null;
    const isLong = text.length > maxLength;
    return (
      <div className="space-y-2">
        <div className="text-sm text-foreground leading-relaxed">
          {isLong ? (
            <>
              <p className="whitespace-pre-wrap">
                {expandedDescriptions[key]
                  ? text
                  : text.slice(0, maxLength) + "..."}
              </p>
              <button
                type="button"
                onClick={() => toggleDescription(key)}
                className="text-primary hover:underline text-sm mt-1 font-medium"
              >
                {expandedDescriptions[key] ? "عرض أقل" : "قراءة المزيد"}
              </button>
            </>
          ) : (
            <p className="whitespace-pre-wrap">{text}</p>
          )}
        </div>
      </div>
    );
  };

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
  const watchDepartmentId = watch("departmentId");

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

  // Filter systems based on selected department
  const filteredSystems = systems?.filter((system) => {
    if (!watchDepartmentId) {
      return true;
    }
    const ids = system.departmentIds || [];
    if (ids.length === 0) return true;
    return ids.some(
      (d) => (typeof d === "object" && d ? d.id : d) === watchDepartmentId
    );
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

  const addProjectManagerNoteMutation = useMutation({
    mutationFn: (notes: string) =>
      requestsService.addProjectManagerNote(id!, {
        projectManagerNotes: notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowProjectManagerNoteDialog(false);
      setProjectManagerNotes("");
      toast({
        title: "تم بنجاح",
        description: "تم إضافة ملاحظة مدير المشروع بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الملاحظة",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (data: { implementedWork?: string }) =>
      requestsService.complete(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowCompleteDialog(false);
      setImplementedWork("");
      toast({
        title: "تم بنجاح",
        description: "تم إكمال الطلب بنجاح",
        variant: "default",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل إكمال الطلب. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
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

  const deleteMutation = useMutation({
    mutationFn: requestsService.softDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSoftDeleteDialog(false);
      toast({
        title: "تم بنجاح",
        description: "تم نقل الطلب إلى سلة المهملات بنجاح",
        variant: "default",
      });
      navigate("/app/requests");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل نقل الطلب إلى سلة المهملات. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: requestsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setHardDeleteDialog(false);
      toast({
        title: "تم بنجاح",
        description: "تم حذف الطلب نهائياً",
        variant: "destructive",
      });
      navigate("/app/requests");
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل حذف الطلب. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Calculate user permissions early
  const isEngineer = user?.role === Role.ENGINEER;
  const isConsultant = user?.role === Role.CONSULTANT;
  const isMaintenanceManager = user?.role === Role.MAINTENANCE_MANAGER;
  const isMaintenanceSafetyMonitor =
    user?.role === Role.MAINTENANCE_SAFETY_MONITOR;
  const isProjectManager = user?.role === Role.PROJECT_MANAGER;
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

  // Reset system when department changes if current system is not available for new department
  // This must be before early returns to maintain consistent hook order
  useEffect(() => {
    if (watchDepartmentId && watchSystemId && filteredSystems) {
      const currentSystemAvailable = filteredSystems.some(
        (sys) => sys.id === watchSystemId
      );
      if (!currentSystemAvailable) {
        setValue("systemId", "");
        setValue("machineId", "");
      }
    }
  }, [watchDepartmentId, watchSystemId, filteredSystems, setValue]);

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
  const canAddProjectManagerNote =
    (isProjectManager || isAdmin) && request.status !== RequestStatus.STOPPED;

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

  const handleAddProjectManagerNote = () => {
    const notes = request.projectManagerNotes || "";
    // Remove author name from the end if present
    const { text } = parseNoteWithAuthor(notes);
    setProjectManagerNotes(text);
    setShowProjectManagerNoteDialog(true);
  };

  const submitProjectManagerNote = () => {
    if (projectManagerNotes.trim()) {
      addProjectManagerNoteMutation.mutate(projectManagerNotes);
    }
  };

  const handleComplete = () => {
    setShowCompleteDialog(true);
  };

  const submitComplete = () => {
    const work = implementedWork?.trim();
    completeMutation.mutate({
      implementedWork: work && work.length > 0 ? work : undefined,
    });
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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل التقرير",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePreview = async () => {
    if (!id || loadingPreview) return;

    try {
      setLoadingPreview(true);
      const url = await reportsService.previewSingleRequestReport(id);
      setPdfPreviewUrl(url);
      setShowPreviewDialog(true);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء معاينة التقرير",
        variant: "destructive",
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePdfLoad = () => {
    // Force iframe to resize and show full content
    if (pdfIframeRef) {
      // Try to access iframe content to ensure full display
      setTimeout(() => {
        try {
          const iframeDoc =
            pdfIframeRef.contentDocument ||
            pdfIframeRef.contentWindow?.document;
          if (iframeDoc) {
            // Ensure iframe shows full content
            const body = iframeDoc.body;
            if (body) {
              body.style.overflow = "auto";
              body.style.height = "auto";
            }
            // Scroll to ensure footer visibility
            iframeDoc.documentElement.scrollTop =
              iframeDoc.documentElement.scrollHeight;
          }
        } catch (e) {
          // Cross-origin restrictions may prevent access - this is normal
          // The PDF viewer will handle display internally
        }
      }, 500);

      // Additional attempt after longer delay
      setTimeout(() => {
        if (pdfIframeRef) {
          // Force iframe to recalculate height
          pdfIframeRef.style.height = pdfIframeRef.offsetHeight + "px";
        }
      }, 1500);
    }
  };

  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    if (pdfPreviewUrl) {
      window.URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  const handleDownloadFromPreview = async () => {
    if (!id) return;
    handleClosePreview();
    await handlePrint();
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
        requestNeeds: request.requestNeeds || "",
        implementedWork: request.implementedWork || "",
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
            <p className="text-muted-foreground text-sm sm:text-base">
              تفاصيل طلب الصيانة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 justify-end">
          {/* Preview button - icon only on mobile */}
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden"
            onClick={handlePreview}
            disabled={loadingPreview || downloadingPdf}
          >
            {loadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          {/* Preview button - full on desktop */}
          <Button
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={handlePreview}
            disabled={loadingPreview || downloadingPdf}
          >
            {loadingPreview ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="ml-2 h-4 w-4" />
            )}
            {loadingPreview ? "جاري التحميل..." : "معاينة التقرير"}
          </Button>
          {/* Print button - icon only on mobile */}
          <Button
            variant="outline"
            size="icon"
            className="sm:hidden"
            onClick={handlePrint}
            disabled={downloadingPdf || loadingPreview}
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
            disabled={downloadingPdf || loadingPreview}
          >
            {downloadingPdf ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="ml-2 h-4 w-4" />
            )}
            {downloadingPdf ? "جاري التحميل..." : "تحميل التقرير"}
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
                    <p className="text-sm text-muted-foreground">
                      النظام / الفرع
                    </p>
                    <p className="font-medium">{request.systemId?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      الآلة / البند
                    </p>
                    <p className="font-medium">
                      {request.machineId?.name}
                      {request.machineNumber && ` (${request.machineNumber})`}
                    </p>
                  </div>
                </div>
              </div>

              {request.machineId?.description && (
                <div className="space-y-2 pt-4 border-t">
                  <span className="text-sm font-medium text-muted-foreground block">
                    وصف الآلة
                  </span>
                  {renderFormattedText(
                    request.machineId.description,
                    "machine-description"
                  )}
                </div>
              )}

              <div className="space-y-2 pt-4 border-t">
                <span className="text-sm font-medium text-muted-foreground block">
                  المكونات المختارة
                </span>
                {request.maintainAllComponents ? (
                  <p className="font-medium text-foreground">جميع المكونات</p>
                ) : request.selectedComponents &&
                  request.selectedComponents.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {request.selectedComponents.map((component, index) => (
                      <span
                        key={index}
                        className="text-sm bg-muted text-foreground px-3 py-1 rounded-full font-medium"
                      >
                        {component}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">لا توجد مكونات محددة</p>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t">
                <span className="text-sm font-medium text-muted-foreground block">
                  سبب طلب الصيانة
                </span>
                {renderFormattedText(request.reasonText, "reason-text")}
              </div>

              {request.engineerNotes && (
                <div className="space-y-2 pt-4 border-t">
                  <span className="text-sm font-medium text-muted-foreground block">
                    ملاحظات المهندس
                  </span>
                  {renderFormattedText(request.engineerNotes, "engineer-notes")}
                </div>
              )}

              {request.requestNeeds && (
                <div className="space-y-2 pt-4 border-t">
                  <span className="text-sm font-medium text-muted-foreground block">
                    احتياجات الطلب
                  </span>
                  {renderFormattedText(request.requestNeeds, "request-needs")}
                </div>
              )}

              {request.consultantNotes &&
                (() => {
                  const { text, author } = parseNoteWithAuthor(
                    request.consultantNotes
                  );
                  return (
                    <div className="space-y-2 pt-4 border-t">
                      <span className="text-sm font-medium text-muted-foreground block">
                        ملاحظات المكتب الاستشاري
                      </span>
                      {renderFormattedText(text, "consultant-notes")}
                      {author && (
                        <p className="text-xs text-muted-foreground text-left pt-1">
                          — {author}
                        </p>
                      )}
                    </div>
                  );
                })()}

              {request.healthSafetyNotes &&
                (() => {
                  const { text, author } = parseNoteWithAuthor(
                    request.healthSafetyNotes
                  );
                  return (
                    <div className="space-y-2 pt-4 border-t">
                      <span className="text-sm font-medium text-muted-foreground block">
                        ملاحظات مراقب الصيانة والسلامة
                      </span>
                      {renderFormattedText(text, "health-safety-notes")}
                      {author && (
                        <p className="text-xs text-muted-foreground text-left pt-1">
                          — {author}
                        </p>
                      )}
                    </div>
                  );
                })()}

              {request.projectManagerNotes &&
                (() => {
                  const { text, author } = parseNoteWithAuthor(
                    request.projectManagerNotes
                  );
                  return (
                    <div className="space-y-2 pt-4 border-t">
                      <span className="text-sm font-medium text-muted-foreground block">
                        ملاحظات مدير المشروع
                      </span>
                      {renderFormattedText(text, "project-manager-notes")}
                      {author && (
                        <p className="text-xs text-muted-foreground text-left pt-1">
                          — {author}
                        </p>
                      )}
                    </div>
                  );
                })()}

              {request.status === RequestStatus.STOPPED &&
                request.stopReason && (
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-orange-600">
                        سبب الإيقاف
                      </span>
                    </div>
                    <div className="text-foreground bg-orange-50 dark:bg-orange-950/30 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                      {renderFormattedText(
                        request.stopReason,
                        "stop-reason",
                        120
                      )}
                    </div>
                  </div>
                )}

              {request.status === RequestStatus.COMPLETED &&
                request.implementedWork && (
                  <div className="space-y-2 pt-4 border-t">
                    <span className="text-sm font-medium text-muted-foreground block">
                      ما تم تنفيذه
                    </span>
                    {renderFormattedText(
                      request.implementedWork,
                      "implemented-work",
                      120
                    )}
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
                        `/app/complaints/${
                          typeof request.complaintId === "string"
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
            canAddHealthSafetyNote ||
            canAddProjectManagerNote ||
            isAdmin) && (
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
                      onClick={handleComplete}
                      disabled={completeMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle2 className="ml-2 h-4 w-4" />
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
                  {canAddProjectManagerNote && (
                    <Button
                      variant="outline"
                      onClick={handleAddProjectManagerNote}
                      className="flex-1"
                    >
                      <MessageSquarePlus className="ml-2 h-4 w-4" />
                      {request.projectManagerNotes
                        ? "تعديل ملاحظة مدير المشروع"
                        : "إضافة ملاحظة مدير المشروع"}
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

                  {isAdmin && (
                    <>
                      <div className="w-full border-t border-border/50 pt-3 mt-2">
                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="outline"
                            className="flex-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                            onClick={() => setSoftDeleteDialog(true)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="ml-2 h-4 w-4" />
                            نقل إلى سلة المهملات
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setHardDeleteDialog(true)}
                            disabled={hardDeleteMutation.isPending}
                          >
                            <AlertTriangle className="ml-2 h-4 w-4" />
                            حذف نهائي
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
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

      {/* Add Project Manager Note Dialog */}
      <Dialog
        open={showProjectManagerNoteDialog}
        onOpenChange={setShowProjectManagerNoteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة ملاحظة مدير المشروع</DialogTitle>
            <DialogDescription>
              أضف ملاحظاتك المتعلقة بالمشروع على هذا الطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                ملاحظات مدير المشروع *
              </label>
              <Textarea
                placeholder="أدخل ملاحظاتك المتعلقة بالمشروع هنا..."
                value={projectManagerNotes}
                onChange={(e) => setProjectManagerNotes(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProjectManagerNoteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={submitProjectManagerNote}
              disabled={
                addProjectManagerNoteMutation.isPending ||
                !projectManagerNotes.trim()
              }
            >
              {addProjectManagerNoteMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                "حفظ الملاحظة"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Request Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إكمال الطلب</DialogTitle>
            <DialogDescription>
              يرجى إدخال ما تم تنفيذه في هذا الطلب (اختياري)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ما تم تنفيذه</Label>
              <Textarea
                placeholder="أدخل تفاصيل ما تم تنفيذه في هذا الطلب..."
                value={implementedWork}
                onChange={(e) => setImplementedWork(e.target.value)}
                rows={6}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={submitComplete}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                "إكمال الطلب"
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
                <Label>النظام / الفرع *</Label>
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
                    {filteredSystems && filteredSystems.length > 0 ? (
                      filteredSystems.map((system) => (
                        <SelectItem key={system.id} value={system.id}>
                          {system.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        لا توجد أنظمة متاحة
                      </SelectItem>
                    )}
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
                <Label>الآلة / البند *</Label>
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
                <Label>رقم الآلة / البند / التوصيف</Label>
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

            {/* Request Needs */}
            <div className="space-y-2">
              <Label>احتياجات الطلب</Label>
              <Textarea
                placeholder="احتياجات الطلب (اختياري)"
                rows={3}
                {...register("requestNeeds")}
              />
            </div>

            {/* Implemented Work */}
            <div className="space-y-2">
              <Label>معلومات الإجراء المتخذ</Label>
              <Textarea
                placeholder="ما تم تنفيذه (اختياري)"
                rows={3}
                {...register("implementedWork")}
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

      {/* Soft Delete Dialog */}
      <Dialog open={softDeleteDialog} onOpenChange={setSoftDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد النقل إلى سلة المهملات
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من نقل طلب الصيانة "{request?.requestCode}" إلى سلة
              المهملات؟ يمكنك استعادته لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSoftDeleteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (id) {
                  deleteMutation.mutate(id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              نقل إلى سلة المهملات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Dialog */}
      <Dialog open={hardDeleteDialog} onOpenChange={setHardDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من الحذف النهائي لطلب الصيانة "{request?.requestCode}
              "؟ هذا الإجراء لا يمكن التراجع عنه!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHardDeleteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (id) {
                  hardDeleteMutation.mutate(id);
                }
              }}
              disabled={hardDeleteMutation.isPending}
            >
              {hardDeleteMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle>معاينة التقرير</DialogTitle>
              <DialogDescription>
                معاينة تقرير طلب الصيانة قبل التحميل
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-hidden min-h-0 px-6 pb-6">
            {pdfPreviewUrl ? (
              <div
                className="w-full border rounded-lg overflow-hidden bg-muted/50 relative"
                style={{
                  height: "calc(90vh - 200px)",
                  minHeight: "600px",
                  maxHeight: "calc(90vh - 200px)",
                }}
              >
                <iframe
                  ref={setPdfIframeRef}
                  src={`${pdfPreviewUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH&zoom=page-width`}
                  className="w-full h-full border-0"
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "600px",
                    display: "block",
                    overflow: "auto",
                  }}
                  title="PDF Preview"
                  onLoad={handlePdfLoad}
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="px-6 pb-6 pt-4 border-t">
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClosePreview}>
                إغلاق
              </Button>
              <Button
                onClick={handleDownloadFromPreview}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التحميل...
                  </>
                ) : (
                  <>
                    <Download className="ml-2 h-4 w-4" />
                    تحميل التقرير
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
