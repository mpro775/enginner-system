import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, RotateCcw, X, Calendar, User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { usersService } from "@/services/users";
import { scheduledTasksService } from "@/services/scheduled-tasks";
import { requestsService } from "@/services/requests";
import { complaintsService } from "@/services/complaints";
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from "@/services/reference-data";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { User as UserType, ScheduledTask, MaintenanceRequest, Complaint, Location, Department, System, Machine } from "@/types";

type TabType = "users" | "tasks" | "requests" | "complaints" | "locations" | "departments" | "systems" | "machines";

export default function Trash() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [restoreDialog, setRestoreDialog] = useState<{ type: TabType; id: string; name: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ type: TabType; id: string; name: string } | null>(null);

  // Users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users", "trash"],
    queryFn: () => usersService.getDeleted({ limit: 100 }),
  });

  // Scheduled Tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ["scheduled-tasks", "trash"],
    queryFn: () => scheduledTasksService.getDeleted({ limit: 100 }),
  });

  // Maintenance Requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["requests", "trash"],
    queryFn: () => requestsService.getDeleted({ limit: 100 }),
  });

  // Complaints
  const { data: complaintsData, isLoading: complaintsLoading } = useQuery({
    queryKey: ["complaints", "trash"],
    queryFn: () => complaintsService.getDeleted({ limit: 100 }),
  });

  // Locations
  const { data: locationsData, isLoading: locationsLoading } = useQuery({
    queryKey: ["locations", "trash"],
    queryFn: () => locationsService.getDeleted(),
  });

  // Departments
  const { data: departmentsData, isLoading: departmentsLoading } = useQuery({
    queryKey: ["departments", "trash"],
    queryFn: () => departmentsService.getDeleted(),
  });

  // Systems
  const { data: systemsData, isLoading: systemsLoading } = useQuery({
    queryKey: ["systems", "trash"],
    queryFn: () => systemsService.getDeleted(),
  });

  // Machines
  const { data: machinesData, isLoading: machinesLoading } = useQuery({
    queryKey: ["machines", "trash"],
    queryFn: () => machinesService.getDeleted(),
  });

  // Restore mutations
  const restoreUserMutation = useMutation({
    mutationFn: usersService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreTaskMutation = useMutation({
    mutationFn: scheduledTasksService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreRequestMutation = useMutation({
    mutationFn: requestsService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["requests", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreComplaintMutation = useMutation({
    mutationFn: complaintsService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaints", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreLocationMutation = useMutation({
    mutationFn: locationsService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreDepartmentMutation = useMutation({
    mutationFn: departmentsService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["departments", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreSystemMutation = useMutation({
    mutationFn: systemsService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      queryClient.invalidateQueries({ queryKey: ["systems", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  const restoreMachineMutation = useMutation({
    mutationFn: machinesService.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["machines", "trash"] });
      setRestoreDialog(null);
      toast({ title: "تم الاستعادة بنجاح" });
    },
  });

  // Hard delete mutations
  const hardDeleteUserMutation = useMutation({
    mutationFn: usersService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteTaskMutation = useMutation({
    mutationFn: scheduledTasksService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteRequestMutation = useMutation({
    mutationFn: requestsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteComplaintMutation = useMutation({
    mutationFn: complaintsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteLocationMutation = useMutation({
    mutationFn: locationsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteDepartmentMutation = useMutation({
    mutationFn: departmentsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteSystemMutation = useMutation({
    mutationFn: systemsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const hardDeleteMachineMutation = useMutation({
    mutationFn: machinesService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines", "trash"] });
      setDeleteDialog(null);
      toast({ title: "تم الحذف النهائي بنجاح", variant: "destructive" });
    },
  });

  const handleRestore = () => {
    if (!restoreDialog) return;

    const { type, id } = restoreDialog;

    switch (type) {
      case "users":
        restoreUserMutation.mutate(id);
        break;
      case "tasks":
        restoreTaskMutation.mutate(id);
        break;
      case "requests":
        restoreRequestMutation.mutate(id);
        break;
      case "complaints":
        restoreComplaintMutation.mutate(id);
        break;
      case "locations":
        restoreLocationMutation.mutate(id);
        break;
      case "departments":
        restoreDepartmentMutation.mutate(id);
        break;
      case "systems":
        restoreSystemMutation.mutate(id);
        break;
      case "machines":
        restoreMachineMutation.mutate(id);
        break;
    }
  };

  const handleHardDelete = () => {
    if (!deleteDialog) return;

    const { type, id } = deleteDialog;

    switch (type) {
      case "users":
        hardDeleteUserMutation.mutate(id);
        break;
      case "tasks":
        hardDeleteTaskMutation.mutate(id);
        break;
      case "requests":
        hardDeleteRequestMutation.mutate(id);
        break;
      case "complaints":
        hardDeleteComplaintMutation.mutate(id);
        break;
      case "locations":
        hardDeleteLocationMutation.mutate(id);
        break;
      case "departments":
        hardDeleteDepartmentMutation.mutate(id);
        break;
      case "systems":
        hardDeleteSystemMutation.mutate(id);
        break;
      case "machines":
        hardDeleteMachineMutation.mutate(id);
        break;
    }
  };

  const tabs = [
    { id: "users" as TabType, label: "المستخدمين", count: usersData?.data?.length || 0 },
    { id: "tasks" as TabType, label: "المهام المجدولة", count: tasksData?.data?.length || 0 },
    { id: "requests" as TabType, label: "طلبات الصيانة", count: requestsData?.data?.length || 0 },
    { id: "complaints" as TabType, label: "الشكاوى", count: complaintsData?.data?.length || 0 },
    { id: "locations" as TabType, label: "المواقع", count: locationsData?.length || 0 },
    { id: "departments" as TabType, label: "الأقسام", count: departmentsData?.length || 0 },
    { id: "systems" as TabType, label: "الأنظمة", count: systemsData?.length || 0 },
    { id: "machines" as TabType, label: "الآلات", count: machinesData?.length || 0 },
  ];

  const isLoading =
    (activeTab === "users" && usersLoading) ||
    (activeTab === "tasks" && tasksLoading) ||
    (activeTab === "requests" && requestsLoading) ||
    (activeTab === "complaints" && complaintsLoading) ||
    (activeTab === "locations" && locationsLoading) ||
    (activeTab === "departments" && departmentsLoading) ||
    (activeTab === "systems" && systemsLoading) ||
    (activeTab === "machines" && machinesLoading);

  const renderUsers = () => {
    if (!usersData?.data.length) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">لا يوجد مستخدمين محذوفين</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {usersData.data.map((user: UserType) => (
          <Card key={user.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{user.name}</h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    حُذف في: {user.deletedAt ? formatDate(user.deletedAt) : "-"}
                  </span>
                </div>
                {user.deletedBy && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      حذفه: {typeof user.deletedBy === "object" ? user.deletedBy.name : "-"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setRestoreDialog({ type: "users", id: user.id, name: user.name })
                  }
                >
                  <RotateCcw className="h-4 w-4 ml-2" />
                  استعادة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setDeleteDialog({ type: "users", id: user.id, name: user.name })
                  }
                >
                  <X className="h-4 w-4 ml-2" />
                  حذف نهائي
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderTasks = () => {
    if (!tasksData?.data.length) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد مهام محذوفة</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasksData.data.map((task: ScheduledTask) => (
          <Card key={task.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{task.title}</h3>
                  <p className="text-xs font-mono text-muted-foreground">{task.taskCode}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    حُذفت في: {task.deletedAt ? formatDate(task.deletedAt) : "-"}
                  </span>
                </div>
                {task.deletedBy && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      حذفها: {typeof task.deletedBy === "object" ? task.deletedBy.name : "-"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setRestoreDialog({ type: "tasks", id: task.id, name: task.title })
                  }
                >
                  <RotateCcw className="h-4 w-4 ml-2" />
                  استعادة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setDeleteDialog({ type: "tasks", id: task.id, name: task.title })
                  }
                >
                  <X className="h-4 w-4 ml-2" />
                  حذف نهائي
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderRequests = () => {
    if (!requestsData?.data.length) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد طلبات محذوفة</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requestsData.data.map((request: MaintenanceRequest) => (
          <Card key={request.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{request.requestCode}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {request.reasonText}
                  </p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    حُذف في: {request.deletedAt ? formatDate(request.deletedAt) : "-"}
                  </span>
                </div>
                {request.deletedBy && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      حذفه: {typeof request.deletedBy === "object" ? request.deletedBy.name : "-"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setRestoreDialog({ type: "requests", id: request.id, name: request.requestCode })
                  }
                >
                  <RotateCcw className="h-4 w-4 ml-2" />
                  استعادة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setDeleteDialog({ type: "requests", id: request.id, name: request.requestCode })
                  }
                >
                  <X className="h-4 w-4 ml-2" />
                  حذف نهائي
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderComplaints = () => {
    if (!complaintsData?.data.length) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد شكاوى محذوفة</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {complaintsData.data.map((complaint: Complaint) => (
          <Card key={complaint.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{complaint.complaintCode}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {complaint.descriptionAr}
                  </p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    حُذفت في: {complaint.deletedAt ? formatDate(complaint.deletedAt) : "-"}
                  </span>
                </div>
                {complaint.deletedBy && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      حذفها: {typeof complaint.deletedBy === "object" ? complaint.deletedBy.name : "-"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setRestoreDialog({ type: "complaints", id: complaint.id, name: complaint.complaintCode })
                  }
                >
                  <RotateCcw className="h-4 w-4 ml-2" />
                  استعادة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setDeleteDialog({ type: "complaints", id: complaint.id, name: complaint.complaintCode })
                  }
                >
                  <X className="h-4 w-4 ml-2" />
                  حذف نهائي
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderReferenceData = (
    data: (Location | Department | System | Machine)[] | undefined,
    type: TabType,
    label: string
  ) => {
    if (!data || !data.length) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">لا توجد {label} محذوفة</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item: Location | Department | System | Machine) => (
          <Card key={item.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  {"description" in item && item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    حُذف في: {item.deletedAt ? formatDate(item.deletedAt) : "-"}
                  </span>
                </div>
                {item.deletedBy && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      حذفه: {typeof item.deletedBy === "object" ? item.deletedBy.name : "-"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    setRestoreDialog({ type, id: item.id, name: item.name })
                  }
                >
                  <RotateCcw className="h-4 w-4 ml-2" />
                  استعادة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setDeleteDialog({ type, id: item.id, name: item.name })
                  }
                >
                  <X className="h-4 w-4 ml-2" />
                  حذف نهائي
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">سلة المهملات</h1>
        <p className="text-muted-foreground mt-2">
          عرض وإدارة جميع العناصر المحذوفة ناعماً
        </p>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-2 p-4 border-b border-border/50">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className="relative"
              >
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="mr-2">
                    {tab.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <div className="mt-4">
        {activeTab === "users" && renderUsers()}
        {activeTab === "tasks" && renderTasks()}
        {activeTab === "requests" && renderRequests()}
        {activeTab === "complaints" && renderComplaints()}
        {activeTab === "locations" && renderReferenceData(locationsData, "locations", "مواقع")}
        {activeTab === "departments" && renderReferenceData(departmentsData, "departments", "أقسام")}
        {activeTab === "systems" && renderReferenceData(systemsData, "systems", "أنظمة")}
        {activeTab === "machines" && renderReferenceData(machinesData, "machines", "آلات")}
      </div>

      {/* Restore Dialog */}
      <Dialog open={!!restoreDialog} onOpenChange={() => setRestoreDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الاستعادة</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من استعادة "{restoreDialog?.name}"؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialog(null)}>
              إلغاء
            </Button>
            <Button
              onClick={handleRestore}
              disabled={
                restoreUserMutation.isPending ||
                restoreTaskMutation.isPending ||
                restoreRequestMutation.isPending ||
                restoreComplaintMutation.isPending ||
                restoreLocationMutation.isPending ||
                restoreDepartmentMutation.isPending ||
                restoreSystemMutation.isPending ||
                restoreMachineMutation.isPending
              }
            >
              {restoreUserMutation.isPending ||
              restoreTaskMutation.isPending ||
              restoreRequestMutation.isPending ||
              restoreComplaintMutation.isPending ||
              restoreLocationMutation.isPending ||
              restoreDepartmentMutation.isPending ||
              restoreSystemMutation.isPending ||
              restoreMachineMutation.isPending
                ? "جاري الاستعادة..."
                : "استعادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من الحذف النهائي لـ "{deleteDialog?.name}"؟ هذا الإجراء لا يمكن
              التراجع عنه!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleHardDelete}
              disabled={
                hardDeleteUserMutation.isPending ||
                hardDeleteTaskMutation.isPending ||
                hardDeleteRequestMutation.isPending ||
                hardDeleteComplaintMutation.isPending ||
                hardDeleteLocationMutation.isPending ||
                hardDeleteDepartmentMutation.isPending ||
                hardDeleteSystemMutation.isPending ||
                hardDeleteMachineMutation.isPending
              }
            >
              {hardDeleteUserMutation.isPending ||
              hardDeleteTaskMutation.isPending ||
              hardDeleteRequestMutation.isPending ||
              hardDeleteComplaintMutation.isPending ||
              hardDeleteLocationMutation.isPending ||
              hardDeleteDepartmentMutation.isPending ||
              hardDeleteSystemMutation.isPending ||
              hardDeleteMachineMutation.isPending
                ? "جاري الحذف..."
                : "حذف نهائي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
