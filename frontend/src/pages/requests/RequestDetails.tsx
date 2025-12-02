import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge, MaintenanceTypeBadge } from '@/components/shared/StatusBadge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { requestsService } from '@/services/requests';
import { useAuthStore } from '@/store/auth';
import { formatDateTime } from '@/lib/utils';
import { RequestStatus, Role } from '@/types';

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [showStopDialog, setShowStopDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [consultantNotes, setConsultantNotes] = useState('');

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsService.getById(id!),
    enabled: !!id,
  });

  const stopMutation = useMutation({
    mutationFn: (reason: string) => requestsService.stop(id!, { stopReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setShowStopDialog(false);
      setStopReason('');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (notes: string) => requestsService.addNote(id!, { consultantNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      setShowNoteDialog(false);
      setConsultantNotes('');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => requestsService.complete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

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

  const isEngineer = user?.role === Role.ENGINEER;
  const isConsultant = user?.role === Role.CONSULTANT;
  const isAdmin = user?.role === Role.ADMIN;
  const isOwner = isEngineer && request.engineerId?._id === user?.id;
  
  const canStop = isOwner && request.status === RequestStatus.IN_PROGRESS;
  const canComplete = isOwner && request.status === RequestStatus.IN_PROGRESS;
  const canAddNote = (isConsultant || isAdmin) && request.status !== RequestStatus.STOPPED;

  const handleStop = () => {
    setShowStopDialog(true);
  };

  const handleAddNote = () => {
    setConsultantNotes(request.consultantNotes || '');
    setShowNoteDialog(true);
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

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{request.requestCode}</h2>
            <p className="text-muted-foreground">تفاصيل طلب الصيانة</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={request.status} />
          <MaintenanceTypeBadge type={request.maintenanceType} />
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

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">سبب طلب الصيانة</p>
                <p className="font-medium">{request.reasonText}</p>
              </div>

              {request.engineerNotes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">ملاحظات المهندس</p>
                  <p>{request.engineerNotes}</p>
                </div>
              )}

              {request.consultantNotes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">ملاحظات المكتب الاستشاري</p>
                  <p>{request.consultantNotes}</p>
                </div>
              )}

              {request.status === RequestStatus.STOPPED && request.stopReason && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <p className="text-sm text-orange-600 font-medium">سبب الإيقاف</p>
                  </div>
                  <p className="text-orange-700 bg-orange-50 p-3 rounded-lg">{request.stopReason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {(canStop || canComplete || canAddNote) && (
            <Card>
              <CardHeader>
                <CardTitle>الإجراءات المتاحة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
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
                      {request.consultantNotes ? 'تعديل الملاحظة' : 'إضافة ملاحظة'}
                    </Button>
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
                  <p className="font-medium">{formatDateTime(request.openedAt)}</p>
                </div>
              </div>
              {request.closedAt && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">تاريخ الإكمال</p>
                    <p className="font-medium">{formatDateTime(request.closedAt)}</p>
                  </div>
                </div>
              )}
              {request.stoppedAt && (
                <div className="flex items-center gap-3">
                  <StopCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">تاريخ الإيقاف</p>
                    <p className="font-medium">{formatDateTime(request.stoppedAt)}</p>
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
                  <p className="text-xs text-muted-foreground">{request.engineerId?.email}</p>
                </div>
              </div>
              {request.consultantId && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">الاستشاري</p>
                    <p className="font-medium">{request.consultantId?.name}</p>
                    <p className="text-xs text-muted-foreground">{request.consultantId?.email}</p>
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
                'إيقاف الطلب'
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
            <DialogDescription>
              أضف ملاحظاتك على هذا الطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">ملاحظات المكتب الاستشاري *</label>
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
                'حفظ الملاحظة'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
