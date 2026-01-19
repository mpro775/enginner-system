import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  MapPin,
  User,
  RefreshCw,
  Link as LinkIcon,
  Plus,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { complaintsService } from "@/services/complaints";
import { requestsService } from "@/services/requests";
import { usersService } from "@/services/users";
import { useAuthStore } from "@/store/auth";
import { formatDateTime } from "@/lib/utils";
import { ComplaintStatus, Role } from "@/types";
import { ComplaintStatusBadge } from "./ComplaintsList";
import { useToast } from "@/hooks/use-toast";
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from "@/services/reference-data";
import { MaintenanceType } from "@/types";

export default function ComplaintDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showCreateRequestDialog, setShowCreateRequestDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [softDeleteDialog, setSoftDeleteDialog] = useState(false);
  const [hardDeleteDialog, setHardDeleteDialog] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>(
    ComplaintStatus.NEW
  );

  const isEngineer = user?.role === Role.ENGINEER;
  const isAdmin = user?.role === Role.ADMIN;
  const canEdit = isEngineer || isAdmin;

  const { data: complaint, isLoading } = useQuery({
    queryKey: ["complaint", id],
    queryFn: () => complaintsService.getById(id!),
    enabled: !!id,
  });

  // Check if complaint is assigned to current user
  const isAssignedToMe =
    complaint?.assignedEngineerId &&
    typeof complaint.assignedEngineerId === "object" &&
    complaint.assignedEngineerId.id === user?.id;

  // Can modify if admin or if engineer and assigned to them
  const canModify =
    isAdmin ||
    (isEngineer && (isAssignedToMe || !complaint?.assignedEngineerId));

  const { data: engineers } = useQuery({
    queryKey: ["engineers"],
    queryFn: () => usersService.getAll({ role: Role.ENGINEER }),
    enabled: canEdit,
  });

  const { data: requests } = useQuery({
    queryKey: ["requests"],
    queryFn: () => requestsService.getAll({ limit: 100 }),
    enabled: canEdit && showLinkDialog,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsService.getAll(),
    enabled: showCreateRequestDialog,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsService.getAll(),
    enabled: showCreateRequestDialog,
  });

  const { data: allSystems } = useQuery({
    queryKey: ["systems"],
    queryFn: () => systemsService.getAll(),
    enabled: showCreateRequestDialog,
  });

  const assignMutation = useMutation({
    mutationFn: (engineerId: string) =>
      complaintsService.assign(id!, engineerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint", id] });
      setShowAssignDialog(false);
      setSelectedEngineerId("");
      toast({
        title: "تم بنجاح",
        description: "تم إسناد البلاغ بنجاح",
        variant: "default",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل إسناد البلاغ. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: (requestId: string) =>
      complaintsService.linkMaintenanceRequest(id!, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint", id] });
      setShowLinkDialog(false);
      setSelectedRequestId("");
      toast({
        title: "تم بنجاح",
        description: "تم ربط البلاغ بطلب الصيانة بنجاح",
        variant: "default",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل ربط البلاغ بطلب الصيانة. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: ComplaintStatus) =>
      complaintsService.changeStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint", id] });
      setShowStatusDialog(false);
      toast({
        title: "تم بنجاح",
        description: "تم تغيير حالة البلاغ بنجاح",
        variant: "default",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل تغيير حالة البلاغ. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const request = await requestsService.create(data);
      await complaintsService.linkMaintenanceRequest(id!, request.id);
      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setShowCreateRequestDialog(false);
      // Reset form
      setCreateRequestForm({
        maintenanceType: MaintenanceType.EMERGENCY,
        locationId: "",
        departmentId: "",
        systemId: "",
        machineId: "",
        reasonText: complaint?.descriptionAr || complaint?.descriptionEn || "",
        maintainAllComponents: true,
        selectedComponents: [],
      });
      toast({
        title: "تم بنجاح",
        description: "تم إنشاء طلب الصيانة وربطه بالبلاغ بنجاح",
        variant: "default",
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "فشل إنشاء طلب الصيانة. يرجى المحاولة مرة أخرى.";
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: complaintsService.softDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setSoftDeleteDialog(false);
      toast({ title: "تم نقل البلاغ إلى سلة المهملات بنجاح" });
      navigate("/app/complaints");
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: complaintsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setHardDeleteDialog(false);
      toast({ title: "تم حذف البلاغ نهائياً", variant: "destructive" });
      navigate("/app/complaints");
    },
  });

  const [createRequestForm, setCreateRequestForm] = useState({
    maintenanceType: MaintenanceType.EMERGENCY,
    locationId: "",
    departmentId: "",
    systemId: "",
    machineId: "",
    reasonText: complaint?.descriptionAr || complaint?.descriptionEn || "",
    maintainAllComponents: true,
    selectedComponents: [] as string[],
  });

  const { data: machines } = useQuery({
    queryKey: ["machines", createRequestForm.systemId],
    queryFn: () => machinesService.getBySystem(createRequestForm.systemId),
    enabled: showCreateRequestDialog && !!createRequestForm.systemId,
  });

  // Get selected machine and check if it has components
  const selectedMachine = machines?.find(
    (m) => m.id === createRequestForm.machineId
  );
  const hasComponents =
    selectedMachine?.components && selectedMachine.components.length > 0;

  // Auto-fill form when dialog opens and data is loaded
  useEffect(() => {
    if (!showCreateRequestDialog || !complaint) return;
    if (!locations) return;

    // Find location ID by name (try Arabic first, then English)
    const foundLocation = locations.find(
      (loc) =>
        loc.name === complaint.locationAr || loc.name === complaint.locationEn
    );
    const locationId = foundLocation?.id || "";

    // Update form with found location ID and description (use Arabic, fallback to English)
    setCreateRequestForm({
      maintenanceType: MaintenanceType.EMERGENCY,
      locationId,
      departmentId: "",
      systemId: "",
      machineId: "",
      reasonText: complaint.descriptionAr || complaint.descriptionEn || "",
      maintainAllComponents: true,
      selectedComponents: [],
    });
  }, [showCreateRequestDialog, complaint, locations]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!complaint) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">البلاغ غير موجود</p>
      </div>
    );
  }

  const handleAssignToMe = () => {
    if (user?.id) {
      assignMutation.mutate(user.id);
    }
  };

  const handleAssign = () => {
    if (selectedEngineerId) {
      assignMutation.mutate(selectedEngineerId);
    }
  };

  const handleLink = () => {
    if (selectedRequestId) {
      linkMutation.mutate(selectedRequestId);
    }
  };

  const handleStatusChange = () => {
    if (selectedStatus) {
      statusMutation.mutate(selectedStatus);
    }
  };

  const handleCreateRequest = () => {
    // Validate required fields
    if (
      !createRequestForm.locationId ||
      !createRequestForm.departmentId ||
      !createRequestForm.systemId ||
      !createRequestForm.machineId ||
      !createRequestForm.reasonText
    ) {
      return;
    }

    // If maintainAllComponents is false, selectedComponents must not be empty
    if (
      createRequestForm.maintainAllComponents === false &&
      (!createRequestForm.selectedComponents ||
        createRequestForm.selectedComponents.length === 0)
    ) {
      return;
    }

    createRequestMutation.mutate(createRequestForm);
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {complaint.complaintCode}
            </h2>
            <p className="text-muted-foreground">تفاصيل البلاغ</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ComplaintStatusBadge status={complaint.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Complaint Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تفاصيل البلاغ</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reporter Name - Bilingual */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">
                      مقدم البلاغ / Reporter Name
                    </p>
                    <div className="space-y-2">
                      <div className="p-2 bg-muted/50 rounded border-r-2 border-r-primary">
                        <p className="text-xs text-muted-foreground mb-1">
                          بالعربية:
                        </p>
                        <p className="font-medium">
                          {complaint.reporterNameAr}
                        </p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded border-r-2 border-r-primary">
                        <p className="text-xs text-muted-foreground mb-1">
                          In English:
                        </p>
                        <p className="font-medium">
                          {complaint.reporterNameEn}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">
                      الموقع / Location
                    </p>
                    <div className="space-y-2">
                      <div className="p-2 bg-muted/50 rounded border-r-2 border-r-primary">
                        <p className="text-xs text-muted-foreground mb-1">
                          بالعربية:
                        </p>
                        <p className="font-medium">{complaint.locationAr}</p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded border-r-2 border-r-primary">
                        <p className="text-xs text-muted-foreground mb-1">
                          In English:
                        </p>
                        <p className="font-medium">{complaint.locationEn}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description - Bilingual */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  وصف البلاغ / Description
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-3 bg-muted/50 rounded border-r-2 border-r-primary">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">
                      بالعربية:
                    </p>
                    <p className="font-medium whitespace-pre-wrap text-sm">
                      {complaint.descriptionAr}
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded border-r-2 border-r-primary">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">
                      In English:
                    </p>
                    <p className="font-medium whitespace-pre-wrap text-sm">
                      {complaint.descriptionEn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes - Bilingual */}
              {(complaint.notesAr || complaint.notesEn) && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    ملاحظات / تفاصيل إضافية / Notes / Additional Details
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {complaint.notesAr && (
                      <div className="p-3 bg-muted/50 rounded border-r-2 border-r-primary">
                        <p className="text-xs text-muted-foreground mb-2 font-semibold">
                          بالعربية:
                        </p>
                        <p className="font-medium whitespace-pre-wrap text-sm">
                          {complaint.notesAr}
                        </p>
                      </div>
                    )}
                    {complaint.notesEn && (
                      <div className="p-3 bg-muted/50 rounded border-r-2 border-r-primary">
                        <p className="text-xs text-muted-foreground mb-2 font-semibold">
                          In English:
                        </p>
                        <p className="font-medium whitespace-pre-wrap text-sm">
                          {complaint.notesEn}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 grid gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>تم الإنشاء: {formatDateTime(complaint.createdAt)}</span>
                </div>
                {complaint.updatedAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    <span>
                      آخر تحديث: {formatDateTime(complaint.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assigned Engineer */}
          {complaint.assignedEngineerId && (
            <Card>
              <CardHeader>
                <CardTitle>المهندس المسؤول</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {(complaint.assignedEngineerId as any).name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(complaint.assignedEngineerId as any).email}
                    </p>
                  </div>
                </div>
                {!isAssignedToMe && isEngineer && !isAdmin && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      هذا البلاغ مسند لمهندس آخر. فقط المهندس المسند يمكنه
                      تعديله.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Linked Maintenance Request */}
          {complaint.maintenanceRequestId && (
            <Card>
              <CardHeader>
                <CardTitle>طلب الصيانة المرتبط</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {(complaint.maintenanceRequestId as any).requestCode}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      الحالة: {(complaint.maintenanceRequestId as any).status}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/app/requests/${
                          typeof complaint.maintenanceRequestId === "string"
                            ? complaint.maintenanceRequestId
                            : (complaint.maintenanceRequestId as any).id
                        }`
                      )
                    }
                  >
                    عرض الطلب
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions Sidebar */}
        {canEdit && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>الإجراءات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!complaint.assignedEngineerId && (
                  <Button
                    className="w-full"
                    onClick={handleAssignToMe}
                    disabled={assignMutation.isPending}
                  >
                    <User className="h-4 w-4 ml-2" />
                    إسناد البلاغ لي
                  </Button>
                )}

                {complaint.assignedEngineerId && canModify && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowAssignDialog(true)}
                    disabled={assignMutation.isPending}
                  >
                    <User className="h-4 w-4 ml-2" />
                    تغيير الإسناد
                  </Button>
                )}

                {!complaint.maintenanceRequestId && canModify && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowCreateRequestDialog(true)}
                    >
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة طلب صيانة
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowLinkDialog(true)}
                    >
                      <LinkIcon className="h-4 w-4 ml-2" />
                      ربط بطلب صيانة موجود
                    </Button>
                  </>
                )}

                {canModify && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedStatus(complaint.status);
                      setShowStatusDialog(true);
                    }}
                    disabled={statusMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                    تغيير الحالة
                  </Button>
                )}

                {isAdmin && (
                  <>
                    <div className="border-t border-border/50 pt-2 mt-2 space-y-2">
                      <Button
                        variant="outline"
                        className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                        onClick={() => setSoftDeleteDialog(true)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        نقل إلى سلة المهملات
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setHardDeleteDialog(true)}
                        disabled={hardDeleteMutation.isPending}
                      >
                        <AlertTriangle className="h-4 w-4 ml-2" />
                        حذف نهائي
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Assign Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إسناد البلاغ</DialogTitle>
            <DialogDescription>
              اختر المهندس الذي سيتم إسناد البلاغ له
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedEngineerId}
              onValueChange={setSelectedEngineerId}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المهندس" />
              </SelectTrigger>
              <SelectContent>
                {engineers?.data?.map((engineer) => (
                  <SelectItem key={engineer.id} value={engineer.id}>
                    {engineer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAssignDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedEngineerId || assignMutation.isPending}
            >
              إسناد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ربط بطلب صيانة</DialogTitle>
            <DialogDescription>
              اختر طلب الصيانة المراد ربطه بهذا البلاغ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedRequestId}
              onValueChange={setSelectedRequestId}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر طلب الصيانة" />
              </SelectTrigger>
              <SelectContent>
                {requests?.data?.map((request) => (
                  <SelectItem key={request.id} value={request.id}>
                    {request.requestCode} - {request.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleLink}
              disabled={!selectedRequestId || linkMutation.isPending}
            >
              ربط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Request Dialog */}
      <Dialog
        open={showCreateRequestDialog}
        onOpenChange={(open) => {
          setShowCreateRequestDialog(open);
          if (!open) {
            // Reset form when dialog closes
            setCreateRequestForm({
              maintenanceType: MaintenanceType.EMERGENCY,
              locationId: "",
              departmentId: "",
              systemId: "",
              machineId: "",
              reasonText:
                complaint?.descriptionAr || complaint?.descriptionEn || "",
              maintainAllComponents: true,
              selectedComponents: [],
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إنشاء طلب صيانة</DialogTitle>
            <DialogDescription>
              سيتم إنشاء طلب صيانة وربطه تلقائياً بهذا البلاغ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الموقع</Label>
                <Select
                  value={createRequestForm.locationId}
                  onValueChange={(value) =>
                    setCreateRequestForm({
                      ...createRequestForm,
                      locationId: value,
                      systemId: "",
                      machineId: "",
                    })
                  }
                >
                  <SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select
                  value={createRequestForm.departmentId}
                  onValueChange={(value) =>
                    setCreateRequestForm({
                      ...createRequestForm,
                      departmentId: value,
                    })
                  }
                >
                  <SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label>النظام</Label>
                <Select
                  value={createRequestForm.systemId}
                  onValueChange={(value) =>
                    setCreateRequestForm({
                      ...createRequestForm,
                      systemId: value,
                      machineId: "",
                      maintainAllComponents: true,
                      selectedComponents: [],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النظام" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSystems?.map((system) => (
                      <SelectItem key={system.id} value={system.id}>
                        {system.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الآلة</Label>
                <Select
                  value={createRequestForm.machineId}
                  onValueChange={(value) =>
                    setCreateRequestForm({
                      ...createRequestForm,
                      machineId: value,
                      maintainAllComponents: true,
                      selectedComponents: [],
                    })
                  }
                  disabled={!createRequestForm.systemId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الآلة" />
                  </SelectTrigger>
                  <SelectContent>
                    {machines?.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      checked={
                        createRequestForm.maintainAllComponents !== false
                      }
                      onChange={() => {
                        setCreateRequestForm({
                          ...createRequestForm,
                          maintainAllComponents: true,
                          selectedComponents: [],
                        });
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
                      checked={
                        createRequestForm.maintainAllComponents === false
                      }
                      onChange={() => {
                        setCreateRequestForm({
                          ...createRequestForm,
                          maintainAllComponents: false,
                          selectedComponents: [],
                        });
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

                {createRequestForm.maintainAllComponents === false && (
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
                              createRequestForm.selectedComponents?.includes(
                                component
                              ) || false
                            }
                            onChange={(e) => {
                              const current =
                                createRequestForm.selectedComponents || [];
                              if (e.target.checked) {
                                setCreateRequestForm({
                                  ...createRequestForm,
                                  selectedComponents: [...current, component],
                                });
                              } else {
                                setCreateRequestForm({
                                  ...createRequestForm,
                                  selectedComponents: current.filter(
                                    (c) => c !== component
                                  ),
                                });
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
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>سبب الطلب</Label>
              <Textarea
                value={createRequestForm.reasonText}
                onChange={(e) =>
                  setCreateRequestForm({
                    ...createRequestForm,
                    reasonText: e.target.value,
                  })
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateRequestDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCreateRequest}
              disabled={
                !createRequestForm.locationId ||
                !createRequestForm.departmentId ||
                !createRequestForm.systemId ||
                !createRequestForm.machineId ||
                !createRequestForm.reasonText ||
                (createRequestForm.maintainAllComponents === false &&
                  (!createRequestForm.selectedComponents ||
                    createRequestForm.selectedComponents.length === 0)) ||
                createRequestMutation.isPending
              }
            >
              إنشاء وربط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغيير الحالة</DialogTitle>
            <DialogDescription>اختر الحالة الجديدة للبلاغ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedStatus}
              onValueChange={(value) =>
                setSelectedStatus(value as ComplaintStatus)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ComplaintStatus.NEW}>جديد</SelectItem>
                <SelectItem value={ComplaintStatus.IN_PROGRESS}>
                  قيد العمل
                </SelectItem>
                <SelectItem value={ComplaintStatus.RESOLVED}>
                  تم الحل
                </SelectItem>
                <SelectItem value={ComplaintStatus.CLOSED}>مغلق</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={statusMutation.isPending}
            >
              تغيير
            </Button>
          </DialogFooter>
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
              هل أنت متأكد من نقل البلاغ "{complaint?.complaintCode}" إلى سلة المهملات؟ يمكنك استعادته لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoftDeleteDialog(false)}>
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
              هل أنت متأكد من الحذف النهائي للبلاغ "{complaint?.complaintCode}"؟ هذا الإجراء لا يمكن
              التراجع عنه!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteDialog(false)}>
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
    </div>
  );
}
