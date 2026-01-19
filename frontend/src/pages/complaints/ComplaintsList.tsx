import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Filter,
  Eye,
  Calendar,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { complaintsService } from "@/services/complaints";
import { formatDate } from "@/lib/utils";
import { ComplaintStatus, Complaint, Role } from "@/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const getComplaintStatusLabel = (status: ComplaintStatus): string => {
  const labels: Record<ComplaintStatus, string> = {
    [ComplaintStatus.NEW]: "جديد",
    [ComplaintStatus.IN_PROGRESS]: "قيد العمل",
    [ComplaintStatus.RESOLVED]: "تم الحل",
    [ComplaintStatus.CLOSED]: "مغلق",
  };
  return labels[status] || status;
};

const getComplaintStatusColor = (status: ComplaintStatus): string => {
  const colors: Record<ComplaintStatus, string> = {
    [ComplaintStatus.NEW]: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    [ComplaintStatus.IN_PROGRESS]: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
    [ComplaintStatus.RESOLVED]: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    [ComplaintStatus.CLOSED]: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-800",
  };
  return colors[status] || "";
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        getComplaintStatusColor(status)
      )}
    >
      {getComplaintStatusLabel(status)}
    </span>
  );
}

export default function ComplaintsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isAdmin = user?.role === Role.ADMIN;

  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    status: "all" as ComplaintStatus | "all",
    search: "",
  });

  const [softDeleteDialog, setSoftDeleteDialog] = useState<Complaint | null>(null);
  const [hardDeleteDialog, setHardDeleteDialog] = useState<Complaint | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["complaints", filters],
    queryFn: () =>
      complaintsService.getAll({
        ...filters,
        status: filters.status === "all" ? undefined : filters.status,
        search: filters.search || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: complaintsService.softDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setSoftDeleteDialog(null);
      toast({ title: "تم نقل البلاغ إلى سلة المهملات بنجاح" });
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: complaintsService.hardDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      setHardDeleteDialog(null);
      toast({ title: "تم حذف البلاغ نهائياً", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-in px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              البلاغات
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              عرض ومراجعة جميع البلاغات
            </p>
          </div>
        </div>
        <Card className="border-destructive/50 bg-destructive/5 dark:bg-destructive/10">
          <CardContent className="py-8 sm:py-12">
            <div className="text-center">
              <p className="text-destructive text-base sm:text-lg mb-2">
                حدث خطأ أثناء تحميل البلاغات
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

  const complaints = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            البلاغات
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            عرض ومراجعة جميع البلاغات
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            الفلترة والبحث
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث في البلاغات..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value, page: 1 })
                  }
                  className="pr-10"
                />
              </div>
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters({ ...filters, status: value as ComplaintStatus | "all", page: 1 })
              }
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="جميع الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value={ComplaintStatus.NEW}>جديد</SelectItem>
                <SelectItem value={ComplaintStatus.IN_PROGRESS}>قيد العمل</SelectItem>
                <SelectItem value={ComplaintStatus.RESOLVED}>تم الحل</SelectItem>
                <SelectItem value={ComplaintStatus.CLOSED}>مغلق</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Complaints List */}
      {complaints.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground mb-2">
                لا توجد بلاغات
              </p>
              <p className="text-sm text-muted-foreground">
                لم يتم العثور على أي بلاغات تطابق معايير البحث
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {complaints.map((complaint: Complaint) => (
              <Card
                key={complaint.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/app/complaints/${complaint.id}`)}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {complaint.complaintCode}
                            </h3>
                            <ComplaintStatusBadge status={complaint.status} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              مقدم البلاغ / Reporter:
                            </p>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium text-sm">{complaint.reporterNameAr}</span>
                              <span className="font-medium text-xs text-muted-foreground">{complaint.reporterNameEn}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium">{complaint.locationAr}</p>
                            <p className="truncate text-xs text-muted-foreground">{complaint.locationEn}</p>
                          </div>
                        </div>
                        {complaint.assignedEngineerId && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">
                              {(complaint.assignedEngineerId as any).name}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm text-foreground line-clamp-2 font-medium">
                          {complaint.descriptionAr}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {complaint.descriptionEn}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>تم الإنشاء: {formatDate(complaint.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/complaints/${complaint.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4 ml-2" />
                        عرض التفاصيل
                      </Button>
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
                                setSoftDeleteDialog(complaint);
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
                                setHardDeleteDialog(complaint);
                              }}
                            >
                              <AlertTriangle className="h-4 w-4 ml-2" />
                              حذف نهائي
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                عرض {((filters.page - 1) * filters.limit) + 1} -{" "}
                {Math.min(filters.page * filters.limit, meta.total)} من أصل{" "}
                {meta.total} بلاغ
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                  disabled={!meta.hasPrevPage}
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {filters.page} من {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                  disabled={!meta.hasNextPage}
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
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
              هل أنت متأكد من نقل البلاغ "{softDeleteDialog?.complaintCode}" إلى سلة المهملات؟ يمكنك استعادته لاحقاً.
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
              هل أنت متأكد من الحذف النهائي للبلاغ "{hardDeleteDialog?.complaintCode}"؟ هذا الإجراء لا يمكن
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

