import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, Filter, Search, Calendar, Loader2 } from 'lucide-react';
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
import { StatusBadge, MaintenanceTypeBadge } from '@/components/shared/StatusBadge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { reportsService } from '@/services/reports';
import { locationsService, departmentsService, systemsService } from '@/services/reference-data';
import { usersService } from '@/services/users';
import { useAuthStore } from '@/store/auth';
import { formatDateTime } from '@/lib/utils';
import { RequestStatus, MaintenanceType, Role } from '@/types';
import type { ReportFilter } from '@/services/reports';

export default function Reports() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === Role.ADMIN;

  const [filters, setFilters] = useState<ReportFilter>({});
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: reportData, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', filters],
    queryFn: () => reportsService.getRequestsReport(filters),
  });

  const { data: summaryReport, isLoading: loadingSummary } = useQuery({
    queryKey: ['summary-report', filters],
    queryFn: () => reportsService.getSummaryReport(filters),
    enabled: isAdmin,
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsService.getAll(),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsService.getAll(),
  });

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: () => systemsService.getAll(),
  });

  const { data: engineers } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => usersService.getEngineers(),
  });

  const { data: consultants } = useQuery({
    queryKey: ['consultants'],
    queryFn: () => usersService.getConsultants(),
  });

  const handleDownload = async (format: 'excel' | 'pdf') => {
    // منع الضغط المتكرر
    if (downloadingExcel || downloadingPdf) {
      return;
    }

    try {
      // تعيين حالة التحميل
      if (format === 'excel') {
        setDownloadingExcel(true);
      } else {
        setDownloadingPdf(true);
      }

      await reportsService.downloadRequestsReport(filters, format);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('حدث خطأ أثناء تحميل التقرير');
    } finally {
      // إعادة تعيين حالة التحميل
      if (format === 'excel') {
        setDownloadingExcel(false);
      } else {
        setDownloadingPdf(false);
      }
    }
  };

  const handleFilterChange = (key: keyof ReportFilter, value: string | undefined) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (value && value.trim() !== '') {
        newFilters[key] = value as any;
      } else {
        delete newFilters[key];
      }
      return newFilters;
    });
  };

  if (isLoading || loadingSummary) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">التقارير</h2>
        <p className="text-muted-foreground">عرض وتحميل تقارير طلبات الصيانة</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            الفلاتر
          </CardTitle>
        </CardHeader>
        <CardContent dir="rtl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-2 block">من تاريخ</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="pr-10 text-right"
                  value={filters.fromDate || ''}
                  onChange={(e) => handleFilterChange('fromDate', e.target.value || undefined)}
                  aria-label="تاريخ البداية"
                />
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">التنسيق: يوم - شهر - سنة</span>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">إلى تاريخ</label>
              <div className="relative">
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  className="pr-10 text-right"
                  value={filters.toDate || ''}
                  onChange={(e) => handleFilterChange('toDate', e.target.value || undefined)}
                  aria-label="تاريخ النهاية"
                />
              </div>
              <span className="text-xs text-muted-foreground mt-1 block">التنسيق: يوم - شهر - سنة</span>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">المهندس</label>
              <Select
                value={filters.engineerId || 'all'}
                onValueChange={(value) => handleFilterChange('engineerId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع المهندسين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المهندسين</SelectItem>
                  {engineers?.map((engineer) => (
                    <SelectItem key={engineer.id} value={engineer.id}>
                      {engineer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">الاستشاري</label>
              <Select
                value={filters.consultantId || 'all'}
                onValueChange={(value) => handleFilterChange('consultantId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع الاستشاريين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الاستشاريين</SelectItem>
                  {consultants?.map((consultant) => (
                    <SelectItem key={consultant.id} value={consultant.id}>
                      {consultant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">الموقع</label>
              <Select
                value={filters.locationId || 'all'}
                onValueChange={(value) => handleFilterChange('locationId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع المواقع" />
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
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">القسم</label>
              <Select
                value={filters.departmentId || 'all'}
                onValueChange={(value) => handleFilterChange('departmentId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع الأقسام" />
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
            <div>
              <label className="text-sm font-medium mb-2 block">النظام</label>
              <Select
                value={filters.systemId || 'all'}
                onValueChange={(value) => handleFilterChange('systemId', value === 'all' ? undefined : value)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع الأنظمة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنظمة</SelectItem>
                  {systems?.map((system) => (
                    <SelectItem key={system.id} value={system.id}>
                      {system.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">نوع الصيانة</label>
              <Select
                value={filters.maintenanceType || 'all'}
                onValueChange={(value) => handleFilterChange('maintenanceType', value === 'all' ? undefined : value as MaintenanceType)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value={MaintenanceType.EMERGENCY}>طارئ</SelectItem>
                  <SelectItem value={MaintenanceType.PREVENTIVE}>وقائي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">الحالة</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value as RequestStatus)}
              >
                <SelectTrigger className="justify-between text-right">
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value={RequestStatus.IN_PROGRESS}>قيد التنفيذ</SelectItem>
                  <SelectItem value={RequestStatus.COMPLETED}>مكتمل</SelectItem>
                  <SelectItem value={RequestStatus.STOPPED}>متوقف</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => refetch()}>
              <Search className="ml-2 h-4 w-4" />
              بحث
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleDownload('excel')}
              disabled={downloadingExcel || downloadingPdf}
            >
              {downloadingExcel ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="ml-2 h-4 w-4" />
                  تحميل Excel
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleDownload('pdf')}
              disabled={downloadingExcel || downloadingPdf}
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التحميل...
                </>
              ) : (
                <>
                  <FileText className="ml-2 h-4 w-4" />
                  تحميل PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Report - Admin Only */}
      {isAdmin && summaryReport && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                إجمالي الطلبات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryReport.overview?.totalRequests || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">قيد التنفيذ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryReport.byStatus?.in_progress || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">مكتمل</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryReport.byStatus?.completed || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">متوقف</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryReport.byStatus?.stopped || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات التقرير</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="text-center py-12">
              <p className="text-destructive text-lg mb-2">حدث خطأ أثناء تحميل التقرير</p>
              <p className="text-muted-foreground text-sm">يرجى المحاولة مرة أخرى</p>
            </div>
          ) : !reportData || reportData.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رمز الطلب</th>
                    <th>المهندس</th>
                    <th>الاستشاري</th>
                    <th>نوع الصيانة</th>
                    <th>الحالة</th>
                    <th>الموقع</th>
                    <th>القسم</th>
                    <th>النظام</th>
                    <th>الآلة</th>
                    <th>تاريخ الفتح</th>
                    <th>تاريخ الإغلاق</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, index) => (
                    <tr key={index}>
                      <td className="font-medium">{row.requestCode}</td>
                      <td>{row.engineerName}</td>
                      <td>{row.consultantName || '-'}</td>
                      <td>
                        <MaintenanceTypeBadge
                          type={row.maintenanceType as MaintenanceType}
                        />
                      </td>
                      <td>
                        <StatusBadge status={row.status as RequestStatus} />
                      </td>
                      <td>{row.locationName}</td>
                      <td>{row.departmentName}</td>
                      <td>{row.systemName}</td>
                      <td>
                        {row.machineName}
                        {row.machineNumber && ` (${row.machineNumber})`}
                      </td>
                      <td>{formatDateTime(row.openedAt)}</td>
                      <td>{row.closedAt ? formatDateTime(row.closedAt) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

