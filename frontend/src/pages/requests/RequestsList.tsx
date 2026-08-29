import { useEffect, useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Filter,
  Eye,
  Calendar,
  MapPin,
  Building2,
  User,
  FileText,
  Clock,
  Edit,
  Trash2,
  MoreVertical,
  AlertTriangle,
  Loader2,
  Columns3,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
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
import { Pagination } from "@/components/shared/Pagination";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { TableSkeleton } from "@/components/shared/AdminSkeletons";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
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

const defaultFilters = {
  page: 1,
  limit: 10,
  status: "",
  maintenanceType: "",
  locationId: "",
  departmentId: "",
  fromDate: "",
  toDate: "",
  openedBefore: "",
  sortBy: "createdAt",
  sortOrder: "desc" as "asc" | "desc",
};

type RequestFiltersState = typeof defaultFilters;
type ColumnKey =
  | "requestCode"
  | "maintenanceType"
  | "status"
  | "location"
  | "department"
  | "engineer"
  | "createdAt"
  | "duration";

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  requestCode: true,
  maintenanceType: true,
  status: true,
  location: true,
  department: true,
  engineer: true,
  createdAt: true,
  duration: true,
};

interface SavedRequestView {
  id: string;
  name: string;
  filters: RequestFiltersState;
  visibleColumns: Record<ColumnKey, boolean>;
}

function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): RequestFiltersState {
  const page = searchParams.get("page");
  return {
    ...defaultFilters,
    page: page ? Math.max(1, parseInt(page, 10) || 1) : 1,
    status: searchParams.get("status") ?? "",
    maintenanceType: searchParams.get("maintenanceType") ?? "",
    locationId: searchParams.get("locationId") ?? "",
    departmentId: searchParams.get("departmentId") ?? "",
    fromDate: searchParams.get("fromDate") ?? "",
    toDate: searchParams.get("toDate") ?? "",
    openedBefore: searchParams.get("openedBefore") ?? "",
    sortBy: searchParams.get("sortBy") ?? "createdAt",
    sortOrder: searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
  };
}

export default function RequestsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isEngineer = user?.role === Role.ENGINEER;
  const isAdmin = user?.role === Role.ADMIN;
  const [now, setNow] = useState<Date>(new Date());
  const fromDateInputRef = useRef<HTMLInputElement | null>(null);
  const toDateInputRef = useRef<HTMLInputElement | null>(null);
  const [softDeleteDialog, setSoftDeleteDialog] =
    useState<MaintenanceRequest | null>(null);
  const [hardDeleteDialog, setHardDeleteDialog] =
    useState<MaintenanceRequest | null>(null);

  const filtersFromUrl = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  const [filters, setFiltersState] = useState(() =>
    parseFiltersFromSearchParams(new URLSearchParams(window.location.search)),
  );

  const setFilters = (
    next:
      | RequestFiltersState
      | ((prev: RequestFiltersState) => RequestFiltersState),
  ) => {
    setFiltersState((prev) => {
      const nextFilters = typeof next === "function" ? next(prev) : next;
      const params = new URLSearchParams(searchParams);
      if (nextFilters.page !== 1) params.set("page", String(nextFilters.page));
      else params.delete("page");
      if (nextFilters.status) params.set("status", nextFilters.status);
      else params.delete("status");
      if (nextFilters.maintenanceType)
        params.set("maintenanceType", nextFilters.maintenanceType);
      else params.delete("maintenanceType");
      if (nextFilters.locationId)
        params.set("locationId", nextFilters.locationId);
      else params.delete("locationId");
      if (nextFilters.departmentId)
        params.set("departmentId", nextFilters.departmentId);
      else params.delete("departmentId");
      if (nextFilters.fromDate) params.set("fromDate", nextFilters.fromDate);
      else params.delete("fromDate");
      if (nextFilters.toDate) params.set("toDate", nextFilters.toDate);
      else params.delete("toDate");
      if (nextFilters.openedBefore)
        params.set("openedBefore", nextFilters.openedBefore);
      else params.delete("openedBefore");
      if (nextFilters.sortBy !== "createdAt")
        params.set("sortBy", nextFilters.sortBy);
      else params.delete("sortBy");
      if (nextFilters.sortOrder !== "desc")
        params.set("sortOrder", nextFilters.sortOrder);
      else params.delete("sortOrder");
      setSearchParams(params, { replace: true });
      return nextFilters;
    });
  };

  useEffect(() => {
    setFiltersState(filtersFromUrl);
  }, [filtersFromUrl]);

  const [quickPeekRequest, setQuickPeekRequest] =
    useState<MaintenanceRequest | null>(null);
  const [visibleColumns, setVisibleColumns] =
    useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [savedViews, setSavedViews] = useState<SavedRequestView[]>([]);
  const [savedViewName, setSavedViewName] = useState("");
  const savedViewsKey = user?.id
    ? `maintenance:admin-request-views:v1:${user.id}`
    : null;

  useEffect(() => {
    if (!isAdmin || !savedViewsKey) return;
    try {
      const stored = localStorage.getItem(savedViewsKey);
      setSavedViews(stored ? (JSON.parse(stored) as SavedRequestView[]) : []);
    } catch {
      setSavedViews([]);
    }
  }, [isAdmin, savedViewsKey]);

  const persistViews = (views: SavedRequestView[]) => {
    setSavedViews(views);
    if (savedViewsKey)
      localStorage.setItem(savedViewsKey, JSON.stringify(views));
  };

  const saveCurrentView = () => {
    const name = savedViewName.trim();
    if (!name) return;
    persistViews([
      ...savedViews.filter((view) => view.name !== name),
      { id: crypto.randomUUID(), name, filters, visibleColumns },
    ]);
    setSavedViewName("");
    toast({ title: "تم حفظ العرض محليًا" });
  };

  const applySavedView = (viewId: string) => {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;
    setVisibleColumns(view.visibleColumns);
    setFilters({ ...view.filters, page: 1 });
  };

  const toDateInput = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };

  const applyQuickFilter = (
    key:
      | "all"
      | "emergency"
      | "inProgress"
      | "stopped"
      | "today"
      | "week"
      | "over24",
  ) => {
    const current = new Date();
    const base = {
      ...defaultFilters,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
    if (key === "emergency") base.maintenanceType = MaintenanceType.EMERGENCY;
    if (key === "inProgress") base.status = RequestStatus.IN_PROGRESS;
    if (key === "stopped") base.status = RequestStatus.STOPPED;
    if (key === "today") base.fromDate = toDateInput(current);
    if (key === "week") {
      const start = new Date(current);
      start.setDate(start.getDate() - start.getDay());
      base.fromDate = toDateInput(start);
    }
    if (key === "over24")
      base.openedBefore = new Date(
        current.getTime() - 24 * 60 * 60 * 1000,
      ).toISOString();
    setFilters(base);
  };

  const activeFilterCount = [
    filters.status,
    filters.maintenanceType,
    filters.locationId,
    filters.departmentId,
    filters.fromDate,
    filters.toDate,
    filters.openedBefore,
  ].filter(Boolean).length;

  const visibleTableColumnCount =
    Object.entries(visibleColumns).filter(
      ([key, visible]) => visible && (key !== "engineer" || !isEngineer),
    ).length + 1;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["requests", filters],
    queryFn: () => {
      // Clean filters: remove empty strings and only include defined values
      const cleanFilters: {
        page: number;
        limit: number;
        status?: string;
        maintenanceType?: string;
        locationId?: string;
        departmentId?: string;
        fromDate?: string;
        toDate?: string;
        openedBefore?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
      } = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.status && filters.status.trim() !== "") {
        cleanFilters.status = filters.status;
      }

      if (filters.maintenanceType && filters.maintenanceType.trim() !== "") {
        cleanFilters.maintenanceType = filters.maintenanceType;
      }

      if (filters.locationId && filters.locationId.trim() !== "") {
        cleanFilters.locationId = filters.locationId;
      }

      if (filters.departmentId && filters.departmentId.trim() !== "") {
        cleanFilters.departmentId = filters.departmentId;
      }

      if (filters.fromDate && filters.fromDate.trim() !== "") {
        cleanFilters.fromDate = filters.fromDate;
      }

      if (filters.toDate && filters.toDate.trim() !== "") {
        cleanFilters.toDate = filters.toDate;
      }

      if (filters.openedBefore)
        cleanFilters.openedBefore = filters.openedBefore;
      cleanFilters.sortBy = filters.sortBy;
      cleanFilters.sortOrder = filters.sortOrder;

      return requestsService.getAll(cleanFilters);
    },
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

  const returnState = {
    fromPage: filters.page,
    fromFilters: filters,
  };

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
    return isAdmin ? <TableSkeleton rows={8} /> : <PageLoader />;
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
      {isAdmin && <Breadcrumbs items={[{ label: "طلبات الصيانة" }]} />}
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

      {isAdmin && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2" aria-label="فلاتر سريعة">
              {(
                [
                  ["all", "الكل"],
                  ["emergency", "طارئة"],
                  ["inProgress", "قيد التنفيذ"],
                  ["stopped", "متوقفة"],
                  ["today", "اليوم"],
                  ["week", "هذا الأسبوع"],
                  ["over24", "أكثر من 24 ساعة"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  onClick={() => applyQuickFilter(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select onValueChange={applySavedView}>
                <SelectTrigger>
                  <SelectValue placeholder="العروض المحفوظة" />
                </SelectTrigger>
                <SelectContent>
                  {savedViews.length ? (
                    savedViews.map((view) => (
                      <SelectItem key={view.id} value={view.id}>
                        {view.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      لا توجد عروض محفوظة
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  value={savedViewName}
                  onChange={(event) => setSavedViewName(event.target.value)}
                  placeholder="اسم العرض"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={saveCurrentView}
                  disabled={!savedViewName.trim()}
                  aria-label="حفظ العرض الحالي"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <Select
                value={filters.sortBy}
                onValueChange={(sortBy) =>
                  setFilters({ ...filters, sortBy, page: 1 })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="ترتيب حسب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">تاريخ الإنشاء</SelectItem>
                  <SelectItem value="openedAt">تاريخ الفتح</SelectItem>
                  <SelectItem value="requestCode">رقم الطلب</SelectItem>
                  <SelectItem value="status">الحالة</SelectItem>
                  <SelectItem value="maintenanceType">النوع</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Select
                  value={filters.sortOrder}
                  onValueChange={(sortOrder) =>
                    setFilters({
                      ...filters,
                      sortOrder: sortOrder as "asc" | "desc",
                      page: 1,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">تنازلي</SelectItem>
                    <SelectItem value="asc">تصاعدي</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="اختيار الأعمدة"
                    >
                      <Columns3 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>الأعمدة الظاهرة</DropdownMenuLabel>
                    {(
                      [
                        ["requestCode", "رقم الطلب"],
                        ["maintenanceType", "النوع"],
                        ["status", "الحالة"],
                        ["location", "الموقع"],
                        ["department", "القسم"],
                        ["engineer", "المهندس"],
                        ["createdAt", "تاريخ الإنشاء"],
                        ["duration", "المدة"],
                      ] as const
                    ).map(([key, label]) => (
                      <DropdownMenuCheckboxItem
                        key={key}
                        checked={visibleColumns[key]}
                        onCheckedChange={(checked) =>
                          setVisibleColumns((current) => ({
                            ...current,
                            [key]: Boolean(checked),
                          }))
                        }
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="dark:border-border/50">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            تصفية النتائج
            {isAdmin && activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
            {isAdmin && activeFilterCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="mr-auto"
                onClick={() => applyQuickFilter("all")}
              >
                <X className="ml-1 h-3.5 w-3.5" />
                مسح الكل
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
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

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                من تاريخ الإنشاء
              </label>
              <div
                className="relative cursor-pointer"
                onClick={() => {
                  const input = fromDateInputRef.current;
                  if (input) {
                    input.focus();
                    const showPicker = (
                      input as HTMLInputElement & { showPicker?: () => void }
                    ).showPicker;
                    if (typeof showPicker === "function")
                      showPicker.call(input);
                  }
                }}
              >
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={fromDateInputRef}
                  type="date"
                  className="pr-10 cursor-pointer"
                  value={filters.fromDate}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      fromDate: e.target.value,
                      page: 1,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">
                إلى تاريخ الإنشاء
              </label>
              <div
                className="relative cursor-pointer"
                onClick={() => {
                  const input = toDateInputRef.current;
                  if (input) {
                    input.focus();
                    const showPicker = (
                      input as HTMLInputElement & { showPicker?: () => void }
                    ).showPicker;
                    if (typeof showPicker === "function")
                      showPicker.call(input);
                  }
                }}
              >
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={toDateInputRef}
                  type="date"
                  className="pr-10 cursor-pointer"
                  value={filters.toDate}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      toDate: e.target.value,
                      page: 1,
                    })
                  }
                />
              </div>
            </div>
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
              onClick={() =>
                navigate(`/app/requests/${request.id}`, { state: returnState })
              }
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
                      navigate(`/app/requests/${request.id}`, {
                        state: returnState,
                      });
                    }}
                  >
                    <Eye className="h-4 w-4 ml-2" />
                    عرض
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickPeekRequest(request);
                      }}
                    >
                      معاينة
                    </Button>
                  )}
                  {isEngineer &&
                    request.engineerId?.id === user?.id &&
                    request.status === RequestStatus.IN_PROGRESS && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-center text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/requests/${request.id}?edit=true`, {
                            state: returnState,
                          });
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
              <thead className="sticky top-0 z-10 bg-background shadow-sm">
                <tr className="bg-muted/50 dark:bg-muted/20">
                  {visibleColumns.requestCode && (
                    <th className="text-foreground/80">رقم الطلب</th>
                  )}
                  {visibleColumns.maintenanceType && (
                    <th className="text-foreground/80">النوع</th>
                  )}
                  {visibleColumns.status && (
                    <th className="text-foreground/80">الحالة</th>
                  )}
                  {visibleColumns.location && (
                    <th className="text-foreground/80">الموقع</th>
                  )}
                  {visibleColumns.department && (
                    <th className="text-foreground/80">القسم</th>
                  )}
                  {!isEngineer && visibleColumns.engineer && (
                    <th className="text-foreground/80">المهندس</th>
                  )}
                  {visibleColumns.createdAt && (
                    <th className="text-foreground/80">تاريخ الإنشاء</th>
                  )}
                  {visibleColumns.duration && (
                    <th className="text-foreground/80">المدة</th>
                  )}
                  <th className="text-foreground/80">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {!data || !data.data || data.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleTableColumnCount}
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
                      onClick={() =>
                        navigate(`/app/requests/${request.id}`, {
                          state: returnState,
                        })
                      }
                    >
                      {visibleColumns.requestCode && (
                        <td className="font-medium text-foreground">
                          {request.requestCode}
                        </td>
                      )}
                      {visibleColumns.maintenanceType && (
                        <td>
                          <MaintenanceTypeBadge
                            type={request.maintenanceType}
                          />
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td>
                          <StatusBadge status={request.status} />
                        </td>
                      )}
                      {visibleColumns.location && (
                        <td className="text-foreground/80">
                          {request.locationId?.name || "—"}
                        </td>
                      )}
                      {visibleColumns.department && (
                        <td className="text-foreground/80">
                          {request.departmentId?.name || "—"}
                        </td>
                      )}
                      {!isEngineer && visibleColumns.engineer && (
                        <td className="text-foreground/80">
                          {request.engineerId?.name || "—"}
                        </td>
                      )}
                      {visibleColumns.createdAt && (
                        <td className="text-foreground/70">
                          {formatDate(request.createdAt)}
                        </td>
                      )}
                      {visibleColumns.duration && (
                        <td className="text-foreground/70">
                          {getRequestDuration(request)}
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/requests/${request.id}`, {
                                state: returnState,
                              });
                            }}
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            عرض
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickPeekRequest(request);
                              }}
                            >
                              معاينة
                            </Button>
                          )}
                          {isEngineer &&
                            request.engineerId?.id === user?.id &&
                            request.status === RequestStatus.IN_PROGRESS && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/app/requests/${request.id}?edit=true`,
                                    { state: returnState },
                                  );
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
            <Pagination
              currentPage={filters.page}
              totalPages={
                data.meta.totalPages ||
                Math.ceil(data.meta.total / filters.limit)
              }
              onPageChange={(page) => setFilters({ ...filters, page })}
              showInfo
              total={data.meta.total}
              limit={filters.limit}
              itemLabel="طلب"
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!quickPeekRequest}
        onOpenChange={(open) => !open && setQuickPeekRequest(null)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              معاينة الطلب {quickPeekRequest?.requestCode}
            </DialogTitle>
            <DialogDescription>
              ملخص سريع للقراءة فقط دون مغادرة قائمة الطلبات.
            </DialogDescription>
          </DialogHeader>
          {quickPeekRequest && (
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">الحالة:</span>{" "}
                <StatusBadge status={quickPeekRequest.status} />
              </div>
              <div>
                <span className="text-muted-foreground">النوع:</span>{" "}
                <MaintenanceTypeBadge type={quickPeekRequest.maintenanceType} />
              </div>
              <div>
                <span className="text-muted-foreground">الآلة:</span>{" "}
                {quickPeekRequest.machineId?.name || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">الموقع:</span>{" "}
                {quickPeekRequest.locationId?.name || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">المهندس:</span>{" "}
                {quickPeekRequest.engineerId?.name || "—"}
              </div>
              <div>
                <span className="text-muted-foreground">العمر:</span>{" "}
                {getRequestDuration(quickPeekRequest)}
              </div>
              <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3">
                <p className="mb-1 text-muted-foreground">سبب الطلب</p>
                <p>{quickPeekRequest.reasonText || "لم يُسجل سبب"}</p>
              </div>
              {(quickPeekRequest.engineerNotes ||
                quickPeekRequest.consultantNotes ||
                quickPeekRequest.projectManagerNotes ||
                quickPeekRequest.healthSafetyNotes) && (
                <div className="sm:col-span-2 rounded-lg border p-3">
                  <p className="mb-1 text-muted-foreground">
                    أحدث ملاحظة متاحة
                  </p>
                  <p>
                    {quickPeekRequest.projectManagerNotes ||
                      quickPeekRequest.healthSafetyNotes ||
                      quickPeekRequest.consultantNotes ||
                      quickPeekRequest.engineerNotes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickPeekRequest(null)}>
              إغلاق
            </Button>
            {quickPeekRequest && (
              <Button
                onClick={() =>
                  navigate(`/app/requests/${quickPeekRequest.id}`, {
                    state: returnState,
                  })
                }
              >
                فتح التفاصيل
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Dialog */}
      <Dialog
        open={!!softDeleteDialog}
        onOpenChange={() => setSoftDeleteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد النقل إلى سلة المهملات
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من نقل طلب الصيانة "{softDeleteDialog?.requestCode}"
              إلى سلة المهملات؟ يمكنك استعادته لاحقاً.
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
      <Dialog
        open={!!hardDeleteDialog}
        onOpenChange={() => setHardDeleteDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من الحذف النهائي لطلب الصيانة "
              {hardDeleteDialog?.requestCode}"؟ هذا الإجراء لا يمكن التراجع عنه!
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
