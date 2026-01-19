import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { auditLogsService } from '@/services/audit-logs';
import { usersService } from '@/services/users';
import { formatDate } from '@/lib/utils';
import { AuditAction, AuditLog } from '@/types';

const actionLabels: Record<AuditAction, string> = {
  [AuditAction.CREATE]: 'إنشاء',
  [AuditAction.UPDATE]: 'تحديث',
  [AuditAction.DELETE]: 'حذف',
  [AuditAction.LOGIN]: 'تسجيل دخول',
  [AuditAction.LOGOUT]: 'تسجيل خروج',
  [AuditAction.STATUS_CHANGE]: 'تغيير الحالة',
  [AuditAction.SOFT_DELETE]: 'نقل إلى سلة المهملات',
  [AuditAction.HARD_DELETE]: 'حذف نهائي',
  [AuditAction.RESTORE]: 'استعادة',
};

const actionColors: Record<AuditAction, string> = {
  [AuditAction.CREATE]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [AuditAction.UPDATE]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [AuditAction.DELETE]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [AuditAction.LOGIN]: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  [AuditAction.LOGOUT]: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  [AuditAction.STATUS_CHANGE]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [AuditAction.SOFT_DELETE]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  [AuditAction.HARD_DELETE]: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-200',
  [AuditAction.RESTORE]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
};

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    action: '',
    entity: '',
    userId: '',
    fromDate: '',
    toDate: '',
  });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      auditLogsService.getAll({
        ...filters,
        action: filters.action || undefined,
        entity: filters.entity || undefined,
        userId: filters.userId || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
      }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersService.getAll({ limit: 100 }),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const openDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const renderChanges = (changes?: Record<string, unknown>) => {
    if (!changes || Object.keys(changes).length === 0) return '-';
    
    return (
      <div className="space-y-1">
        {Object.entries(changes).map(([key, value]) => (
          <div key={key} className="text-sm">
            <span className="font-medium">{key}:</span>{' '}
            <span className="text-muted-foreground">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <PageLoader />;
  }

  if (isError) {
    return (
      <div className="space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">سجل العمليات</h2>
            <p className="text-muted-foreground">عرض جميع العمليات المسجلة في النظام</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-destructive text-lg mb-2">حدث خطأ أثناء تحميل السجل</p>
              <p className="text-muted-foreground text-sm">
                {error instanceof Error ? error.message : 'يرجى المحاولة مرة أخرى'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">سجل العمليات</h2>
          <p className="text-muted-foreground">عرض جميع العمليات المسجلة في النظام</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            الفلاتر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">الإجراء</label>
              <Select
                value={filters.action || 'all'}
                onValueChange={(value) => handleFilterChange('action', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الإجراءات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الإجراءات</SelectItem>
                  {Object.entries(actionLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">الكيان</label>
              <Input
                placeholder="مثال: User, MaintenanceRequest"
                value={filters.entity}
                onChange={(e) => handleFilterChange('entity', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">المستخدم</label>
              <Select
                value={filters.userId || 'all'}
                onValueChange={(value) => handleFilterChange('userId', value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع المستخدمين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المستخدمين</SelectItem>
                  {usersData?.data.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">من تاريخ</label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">إلى تاريخ</label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ والوقت</th>
                  <th>المستخدم</th>
                  <th>الإجراء</th>
                  <th>الكيان</th>
                  <th>معرف الكيان</th>
                  <th>عنوان IP</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد سجلات
                    </td>
                  </tr>
                ) : (
                  data?.data.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.createdAt)}</td>
                      <td className="font-medium">{log.userName}</td>
                      <td>
                        <Badge className={actionColors[log.action]}>
                          {actionLabels[log.action]}
                        </Badge>
                      </td>
                      <td>{log.entity}</td>
                      <td className="font-mono text-xs">
                        {log.entityId ? log.entityId.toString().slice(-8) : '-'}
                      </td>
                      <td className="font-mono text-xs">{log.ipAddress || '-'}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetails(log)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            عرض {((data.meta.page - 1) * data.meta.limit) + 1} إلى{' '}
            {Math.min(data.meta.page * data.meta.limit, data.meta.total)} من{' '}
            {data.meta.total} سجل
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.meta.page - 1)}
              disabled={!data.meta.hasPrevPage}
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>
            <div className="text-sm">
              صفحة {data.meta.page} من {data.meta.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.meta.page + 1)}
              disabled={!data.meta.hasNextPage}
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل السجل</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">المستخدم</label>
                  <p className="font-medium">{selectedLog.userName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">الإجراء</label>
                  <div className="mt-1">
                    <Badge className={actionColors[selectedLog.action]}>
                      {actionLabels[selectedLog.action]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">الكيان</label>
                  <p>{selectedLog.entity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">معرف الكيان</label>
                  <p className="font-mono text-xs">{selectedLog.entityId || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">عنوان IP</label>
                  <p className="font-mono text-xs">{selectedLog.ipAddress || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">التاريخ والوقت</label>
                  <p>{formatDate(selectedLog.createdAt)}</p>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">متصفح المستخدم</label>
                  <p className="text-sm break-all">{selectedLog.userAgent}</p>
                </div>
              )}

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    التغييرات
                  </label>
                  <Card>
                    <CardContent className="pt-4">
                      {renderChanges(selectedLog.changes)}
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedLog.previousValues && Object.keys(selectedLog.previousValues).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    القيم السابقة
                  </label>
                  <Card>
                    <CardContent className="pt-4">
                      {renderChanges(selectedLog.previousValues)}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}



