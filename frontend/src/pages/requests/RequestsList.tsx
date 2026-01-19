import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Filter,
  Eye,
  Calendar,
  MapPin,
  Building2,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Trash2,
  MoreVertical,
  AlertTriangle,
  Loader2,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  StatusBadge,
  MaintenanceTypeBadge,
} from "@/components/shared/StatusBadge";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { requestsService } from "@/services/requests";
import { useToast } from "@/hooks/use-toast";
import {
  locationsService,
  departmentsService,
} from "@/services/reference-data";
import { useAuthStore } from "@/store/auth";
import { formatDate, formatDuration } from "@/lib/utils";
import {
  RequestStatus,
  MaintenanceType,
  Role,
  MaintenanceRequest,
} from "@/types";

export default function RequestsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isEngineer = user?.role === Role.ENGINEER;
  const isAdmin = user?.role === Role.ADMIN;

  const [now, setNow] = useState<Date>(new Date());
  const [softDeleteDialog, setSoftDeleteDialog] = useState<MaintenanceRequest | null>(null);
  const [hardDeleteDialog, setHardDeleteDialog] = useState<MaintenanceRequest | null>(null);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: "",
    maintenanceType: "",
    locationId: "",
    departmentId: "",
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["requests", filters],
    queryFn: () =>
      requestsService.getAll({
        ...filters,
        status: filters.status || undefined,
        maintenanceType: filters.maintenanceType || undefined,
        locationId: filters.locationId || undefined,
        departmentId: filters.departmentId || undefined,
      }),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => locationsService.getAll(),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: requestsService.softDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setSoftDeleteDialog(null);
      toast({ title: "تم نقل الطلب إلى سلة المهملات بنجاح" });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: requestsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setHardDeleteDialog(null);
      toast({ title: "تم حذف الطلب نهائياً", variant: "destructive" });
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getRequestDuration = (request: MaintenanceRequest) => {
    const isClosed =
      request.status === RequestStatus.COMPLETED ||
      request.status === RequestStatus.STOPPED;

    const endTime: Date | string =
      (isClosed &&
        (request.closedAt || request.stoppedAt || request.updatedAt)) ||
      now;

    return formatDuration(request.createdAt, endTime);
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-in px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              طلبات الصيانة
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {isEngineer
                ? "إدارة طلبات الصيانة الخاصة بك"
                : "عرض ومراجعة جميع الطلبات"}
            </p>
          </div>
        </div>
        <Card className="border-destructive/50 bg-destructive/5 dark:bg-destructive/10">
          <CardContent className="py-8 sm:py-12">
            <div className="text-center">
              <p className="text-destructive text-base sm:text-lg mb-2">
                حدث خطأ أثناء تحميل الطلبات
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {error instanceof Error
                  ? error.message
                  : "يرجى المحاولة مرة أخرى"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            طلبات الصيانة
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isEngineer
              ? "إدارة طلبات الصيانة الخاصة بك"
              : "عرض ومراجعة جميع الطلبات"}
          </p>
        </div>
        {isEngineer && (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/app/requests/new">
              <Plus className="ml-2 h-4 w-4" />
              طلب جديد
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="dark:border-border/50">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            تصفية النتائج
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value === "all" ? "" : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value={RequestStatus.IN_PROGRESS}>
                  قيد التنفيذ
                </SelectItem>
                <SelectItem value={RequestStatus.COMPLETED}>منتهي</SelectItem>
                <SelectItem value={RequestStatus.STOPPED}>متوقف</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.maintenanceType || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  maintenanceType: value === "all" ? "" : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="نوع الصيانة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value={MaintenanceType.EMERGENCY}>طارئة</SelectItem>
                <SelectItem value={MaintenanceType.PREVENTIVE}>
                  وقائية
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.locationId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  locationId: value === "all" ? "" : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="الموقع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المواقع</SelectItem>
                {locations?.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.departmentId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  departmentId: value === "all" ? "" : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="القسم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأقسام</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Cards View */}
      <div className="block lg:hidden space-y-3">
        {!data || !data.data || data.data.length === 0 ? (
          <Card className="dark:border-border/50">
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد طلبات</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          data.data.map((request) => (
            <Card
              key={request.id}
              className="dark:border-border/50 hover:shadow-md dark:hover:shadow-primary/5 transition-all duration-200 cursor-pointer active:scale-[0.99]"
              onClick={() => navigate(`/app/requests/${request.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      #{request.requestCode}
                    </span>
                    <MaintenanceTypeBadge type={request.maintenanceType} />
                  </div>
                  <StatusBadge status={request.status} />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {request.locationId?.name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">
                      {request.departmentId?.name || "—"}
                    </span>
                  </div>
                  {!isEngineer && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {request.engineerId?.name || "—"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{getRequestDuration(request)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-center text-primary hover:text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/app/requests/${request.id}`);
                    }}
                  >
                    <Eye className="h-4 w-4 ml-2" />
                    عرض
                  </Button>
                  {isEngineer &&
                    request.engineerId?.id === user?.id &&
                    request.status === RequestStatus.IN_PROGRESS && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-center text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/requests/${request.id}?edit=true`);
                        }}
                      >
                        <Edit className="h-4 w-4 ml-2" />
                        تعديل
                      </Button>
                    )}
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSoftDeleteDialog(request);
                          }}
                        >
                          <Trash2 className="h-4 w-4 ml-2" />
                          نقل إلى سلة المهملات
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHardDeleteDialog(request);
                          }}
                        >
                          <AlertTriangle className="h-4 w-4 ml-2" />
                          حذف نهائي
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden lg:block dark:border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="bg-muted/50 dark:bg-muted/20">
                  <th className="text-foreground/80">رقم الطلب</th>
                  <th className="text-foreground/80">النوع</th>
                  <th className="text-foreground/80">الحالة</th>
                  <th className="text-foreground/80">الموقع</th>
                  <th className="text-foreground/80">القسم</th>
                  {!isEngineer && (
                    <th className="text-foreground/80">المهندس</th>
                  )}
                  <th className="text-foreground/80">تاريخ الإنشاء</th>
                  <th className="text-foreground/80">المدة</th>
                  <th className="text-foreground/80">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {!data || !data.data || data.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isEngineer ? 8 : 9}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا توجد طلبات</p>
                    </td>
                  </tr>
                ) : (
                  data.data.map((request) => (
                    <tr
                      key={request.id}
                      className="hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors cursor-pointer"
                      onClick={() => navigate(`/app/requests/${request.id}`)}
                    >
                      <td className="font-medium text-foreground">
                        {request.requestCode}
                      </td>
                      <td>
                        <MaintenanceTypeBadge type={request.maintenanceType} />
                      </td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="text-foreground/80">
                        {request.locationId?.name || "—"}
                      </td>
                      <td className="text-foreground/80">
                        {request.departmentId?.name || "—"}
                      </td>
                      {!isEngineer && (
                        <td className="text-foreground/80">
                          {request.engineerId?.name || "—"}
                        </td>
                      )}
                      <td className="text-foreground/70">
                        {formatDate(request.createdAt)}
                      </td>
                      <td className="text-foreground/70">
                        {getRequestDuration(request)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/requests/${request.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            عرض
                          </Button>
                          {isEngineer &&
                            request.engineerId?.id === user?.id &&
                            request.status === RequestStatus.IN_PROGRESS && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/app/requests/${request.id}?edit=true`);
                                }}
                              >
                                <Edit className="h-4 w-4 ml-1" />
                                تعديل
                              </Button>
                            )}
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSoftDeleteDialog(request);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 ml-2" />
                                  نقل إلى سلة المهملات
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHardDeleteDialog(request);
                                  }}
                                >
                                  <AlertTriangle className="h-4 w-4 ml-2" />
                                  حذف نهائي
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data?.meta && (
        <Card className="dark:border-border/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right order-2 sm:order-1">
                عرض {(filters.page - 1) * filters.limit + 1} إلى{" "}
                {Math.min(filters.page * filters.limit, data.meta.total)} من{" "}
                <span className="font-semibold text-foreground">
                  {data.meta.total}
                </span>{" "}
                طلب
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasPrevPage}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page - 1 })
                  }
                  className="flex items-center gap-1"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="hidden sm:inline">السابق</span>
                </Button>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-muted/50 dark:bg-muted/20">
                  <span className="text-sm font-medium text-foreground">
                    {filters.page}
                  </span>
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="text-sm text-muted-foreground">
                    {data.meta.totalPages ||
                      Math.ceil(data.meta.total / filters.limit)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.meta.hasNextPage}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page + 1 })
                  }
                  className="flex items-center gap-1"
                >
                  <span className="hidden sm:inline">التالي</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Soft Delete Dialog */}
      <Dialog open={!!softDeleteDialog} onOpenChange={() => setSoftDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد النقل إلى سلة المهملات
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من نقل طلب الصيانة "{softDeleteDialog?.requestCode}" إلى سلة المهملات؟ يمكنك استعادته لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoftDeleteDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (softDeleteDialog) {
                  deleteMutation.mutate(softDeleteDialog.id);
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
      <Dialog open={!!hardDeleteDialog} onOpenChange={() => setHardDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من الحذف النهائي لطلب الصيانة "{hardDeleteDialog?.requestCode}"؟ هذا الإجراء لا يمكن
              التراجع عنه!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (hardDeleteDialog) {
                  hardDeleteMutation.mutate(hardDeleteDialog.id);
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
