import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, MapPin, MessageSquarePlus, Send, Trash2, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { complaintsService } from "@/services/complaints";
import { departmentsService, machinesService, systemsService } from "@/services/reference-data";
import { usersService } from "@/services/users";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { ComplaintStatus, CreateComplaintRequestForm, MaintenanceType, Role } from "@/types";
import { formatDateTime } from "@/lib/utils";

const emptyRequest: CreateComplaintRequestForm = {
  maintenanceType: MaintenanceType.EMERGENCY,
  engineerId: "",
  systemId: "",
  machineId: "",
  maintainAllComponents: true,
  selectedComponents: [],
  requestNeeds: "",
};

export default function ComplaintDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const isAdmin = user?.role === Role.ADMIN;
  const isConsultant = user?.role === Role.CONSULTANT;
  const isEngineer = user?.role === Role.ENGINEER;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [toDepartmentId, setToDepartmentId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<CreateComplaintRequestForm>(emptyRequest);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>(ComplaintStatus.NEW);

  const { data: complaint, isLoading } = useQuery({
    queryKey: ["complaint", id],
    queryFn: () => complaintsService.getById(id!),
    enabled: Boolean(id),
  });

  const departmentId = complaint?.departmentId?.id;
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsService.getAll(),
  });
  const { data: engineers } = useQuery({
    queryKey: ["engineers", departmentId],
    queryFn: () => usersService.getEngineers(departmentId),
    enabled: Boolean(departmentId && (isAdmin || isConsultant)),
  });
  const { data: systems } = useQuery({
    queryKey: ["systems", departmentId],
    queryFn: () => systemsService.getByDepartment(departmentId!),
    enabled: Boolean(departmentId && requestOpen),
  });
  const { data: machines } = useQuery({
    queryKey: ["machines", requestForm.systemId],
    queryFn: () => machinesService.getBySystem(requestForm.systemId),
    enabled: Boolean(requestForm.systemId && requestOpen),
  });
  const selectedMachine = machines?.find((item) => item.id === requestForm.machineId);

  useEffect(() => {
    if (!requestOpen) return;
    setRequestForm((current) => ({
      ...current,
      engineerId:
        isEngineer
          ? user?.id || ""
          : complaint?.assignedEngineerId?.id || current.engineerId || "",
    }));
  }, [complaint?.assignedEngineerId, isEngineer, requestOpen, user?.id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["complaint", id] });
    queryClient.invalidateQueries({ queryKey: ["complaints"] });
  };
  const mutationOptions = (message: string, close: () => void) => ({
    onSuccess: () => {
      refresh();
      close();
      toast({ title: "تم بنجاح", description: message });
    },
    onError: (error: any) => toast({
      title: "تعذر تنفيذ الإجراء",
      description: error?.response?.data?.message || error?.message,
      variant: "destructive" as const,
    }),
  });

  const noteMutation = useMutation({
    mutationFn: () => complaintsService.addReviewNote(id!, noteBody),
    ...mutationOptions("تمت إضافة ملاحظة المراجعة", () => { setNoteOpen(false); setNoteBody(""); }),
  });
  const transferMutation = useMutation({
    mutationFn: () => complaintsService.transferDepartment(id!, toDepartmentId, transferReason || undefined),
    ...mutationOptions("تم تحويل البلاغ إلى القسم الجديد", () => { setTransferOpen(false); setToDepartmentId(""); setTransferReason(""); }),
  });
  const requestMutation = useMutation({
    mutationFn: () => complaintsService.createMaintenanceRequest(id!, requestForm),
    ...mutationOptions("تم إنشاء طلب الصيانة من البلاغ", () => { setRequestOpen(false); setRequestForm(emptyRequest); }),
  });
  const assignMutation = useMutation({
    mutationFn: (engineerId: string) => complaintsService.assign(id!, engineerId),
    ...mutationOptions("تم إسناد البلاغ", () => { setAssignOpen(false); setSelectedEngineerId(""); }),
  });
  const statusMutation = useMutation({
    mutationFn: () => complaintsService.changeStatus(id!, selectedStatus),
    ...mutationOptions("تم تحديث حالة البلاغ", () => setStatusOpen(false)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => complaintsService.softDelete(id!),
    onSuccess: () => navigate("/app/complaints"),
  });

  const originalDescription = useMemo(
    () => [complaint?.descriptionAr, complaint?.descriptionEn].filter(Boolean),
    [complaint?.descriptionAr, complaint?.descriptionEn],
  );
  if (isLoading) return <PageLoader />;
  if (!complaint) return <p className="py-12 text-center text-muted-foreground">البلاغ غير موجود</p>;

  const canOperate = isAdmin || isConsultant || isEngineer;
  const canReview = canOperate || user?.role === Role.MAINTENANCE_MANAGER;
  const linkedRequestId =
    typeof complaint.maintenanceRequestId === "string"
      ? complaint.maintenanceRequestId
      : complaint.maintenanceRequestId?.id;
  const requestReady =
    requestForm.maintenanceType &&
    requestForm.engineerId &&
    requestForm.systemId &&
    requestForm.machineId &&
    (requestForm.maintainAllComponents || Boolean(requestForm.selectedComponents?.length));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowRight className="h-5 w-5" /></Button>
          <div><h1 className="text-2xl font-bold">{complaint.complaintCode}</h1><p className="text-sm text-muted-foreground">تفاصيل البلاغ ومراجعته</p></div>
        </div>
        <ComplaintStatusBadge status={complaint.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5" />سبب البلاغ الأصلي</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {originalDescription.map((text, index) => <p key={index} className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-4">{text}</p>)}
              {!originalDescription.length && <p className="text-muted-foreground">لا يوجد وصف محفوظ</p>}
              <p className="text-xs text-muted-foreground">هذا المحتوى ثابت ولا يمكن تعديله بعد الإرسال.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />بيانات الموقع الأصلية</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="الموقع" value={complaint.locationId?.name || complaint.locationAr || complaint.locationEn} />
              <Info label="الطابق" value={complaint.floorId?.name} />
              <Info label="الموقع التفصيلي" value={complaint.detailedLocation} />
              <Info label="القسم" value={complaint.departmentId?.name} />
              <Info label="مقدم البلاغ" value={complaint.reporterNameAr || complaint.reporterNameEn} />
              <Info label="رقم التواصل" value={complaint.contactPhone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5" />ملاحظات مراجعة البلاغ</CardTitle>{canReview && <Button size="sm" onClick={() => setNoteOpen(true)}>إضافة ملاحظة</Button>}</CardHeader>
            <CardContent>
              {complaint.reviewNotes?.length ? <div className="space-y-3">{[...complaint.reviewNotes].reverse().map((note, index) => <div key={note.id || index} className="rounded-lg border p-3"><p className="whitespace-pre-wrap">{note.body}</p><p className="mt-2 text-xs text-muted-foreground">{note.authorName} · {formatDateTime(note.createdAt)}</p></div>)}</div> : <p className="text-muted-foreground">لا توجد ملاحظات مراجعة بعد.</p>}
            </CardContent>
          </Card>

          {!!complaint.departmentTransferHistory?.length && <Card><CardHeader><CardTitle>سجل تحويل القسم</CardTitle></CardHeader><CardContent className="space-y-3">{[...complaint.departmentTransferHistory].reverse().map((item, index) => <div key={item.id || index} className="rounded-lg border p-3"><p>{item.fromDepartmentName} ← {item.toDepartmentName}</p><p className="text-xs text-muted-foreground">{item.transferredByName} · {formatDateTime(item.transferredAt)}</p>{item.reason && <p className="mt-1 text-sm">السبب: {item.reason}</p>}</div>)}</CardContent></Card>}
        </div>

        <div className="space-y-6">
          <Card><CardHeader><CardTitle>الحالة التشغيلية</CardTitle></CardHeader><CardContent className="space-y-3">
            <Info label="المهندس" value={complaint.assignedEngineerId?.name} />
            <Info label="تاريخ الإنشاء" value={formatDateTime(complaint.createdAt)} />
            {linkedRequestId ? <Button className="w-full" variant="outline" onClick={() => navigate(`/app/requests/${linkedRequestId}`)}><Wrench className="ml-2 h-4 w-4" />فتح طلب الصيانة المرتبط</Button> : null}
          </CardContent></Card>

          {canOperate && <Card><CardHeader><CardTitle>الإجراءات</CardTitle></CardHeader><CardContent className="grid gap-2">
            {isEngineer && !complaint.assignedEngineerId && <Button variant="outline" onClick={() => assignMutation.mutate(user!.id)} disabled={assignMutation.isPending}><User className="ml-2 h-4 w-4" />إسناد البلاغ لنفسي</Button>}
            {(isAdmin || isConsultant) && <Button variant="outline" onClick={() => setAssignOpen(true)}><User className="ml-2 h-4 w-4" />إسناد مهندس من القسم</Button>}
            {!complaint.maintenanceRequestId && <><Button variant="outline" onClick={() => setTransferOpen(true)}><Send className="ml-2 h-4 w-4" />تحويل إلى قسم آخر</Button><Button onClick={() => setRequestOpen(true)}><Wrench className="ml-2 h-4 w-4" />إنشاء طلب صيانة</Button></>}
            <Button variant="outline" onClick={() => { setSelectedStatus(complaint.status); setStatusOpen(true); }}><CheckCircle2 className="ml-2 h-4 w-4" />تغيير الحالة</Button>
            {isAdmin && <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}><Trash2 className="ml-2 h-4 w-4" />نقل إلى سلة المهملات</Button>}
          </CardContent></Card>}
        </div>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}><DialogContent><DialogHeader><DialogTitle>إضافة ملاحظة مراجعة</DialogTitle><DialogDescription>تضاف كسجل جديد دون تعديل نص البلاغ.</DialogDescription></DialogHeader><Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={5} /><DialogFooter><Button variant="outline" onClick={() => setNoteOpen(false)}>إلغاء</Button><Button onClick={() => noteMutation.mutate()} disabled={!noteBody.trim() || noteMutation.isPending}>حفظ</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}><DialogContent><DialogHeader><DialogTitle>تحويل البلاغ إلى قسم آخر</DialogTitle></DialogHeader><Select value={toDepartmentId} onValueChange={setToDepartmentId}><SelectTrigger><SelectValue placeholder="اختر القسم الجديد" /></SelectTrigger><SelectContent>{departments?.filter((item) => item.id !== departmentId).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="سبب التحويل (اختياري)" /><DialogFooter><Button variant="outline" onClick={() => setTransferOpen(false)}>إلغاء</Button><Button onClick={() => transferMutation.mutate()} disabled={!toDepartmentId || transferMutation.isPending}>تحويل</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}><DialogContent><DialogHeader><DialogTitle>إسناد مهندس من القسم</DialogTitle></DialogHeader><Select value={selectedEngineerId} onValueChange={setSelectedEngineerId}><SelectTrigger><SelectValue placeholder="اختر المهندس" /></SelectTrigger><SelectContent>{engineers?.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setAssignOpen(false)}>إلغاء</Button><Button onClick={() => assignMutation.mutate(selectedEngineerId)} disabled={!selectedEngineerId || assignMutation.isPending}>إسناد</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>إنشاء طلب صيانة من البلاغ</DialogTitle><DialogDescription>الموقع والطابق والقسم وسبب الطلب ستُنقل تلقائيًا من البلاغ.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع الصيانة"><Select value={requestForm.maintenanceType} onValueChange={(value) => setRequestForm((f) => ({ ...f, maintenanceType: value as MaintenanceType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={MaintenanceType.EMERGENCY}>طارئة</SelectItem><SelectItem value={MaintenanceType.PREVENTIVE}>وقائية</SelectItem></SelectContent></Select></Field>
        {(isAdmin || isConsultant) && <Field label="المهندس"><Select value={requestForm.engineerId} onValueChange={(value) => setRequestForm((f) => ({ ...f, engineerId: value }))}><SelectTrigger><SelectValue placeholder="اختر المهندس" /></SelectTrigger><SelectContent>{engineers?.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}
        <Field label="النظام"><Select value={requestForm.systemId} onValueChange={(value) => setRequestForm((f) => ({ ...f, systemId: value, machineId: "", selectedComponents: [], maintainAllComponents: true }))}><SelectTrigger><SelectValue placeholder="اختر النظام" /></SelectTrigger><SelectContent>{systems?.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="الآلة"><Select value={requestForm.machineId} disabled={!requestForm.systemId} onValueChange={(value) => setRequestForm((f) => ({ ...f, machineId: value, selectedComponents: [], maintainAllComponents: true }))}><SelectTrigger><SelectValue placeholder="اختر الآلة" /></SelectTrigger><SelectContent>{machines?.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="احتياجات الطلب"><Input value={requestForm.requestNeeds || ""} onChange={(e) => setRequestForm((f) => ({ ...f, requestNeeds: e.target.value }))} /></Field>
        {selectedMachine?.components?.length ? <div className="sm:col-span-2 space-y-2"><Label>نطاق الصيانة</Label><Select value={requestForm.maintainAllComponents ? "all" : "selected"} onValueChange={(value) => setRequestForm((f) => ({ ...f, maintainAllComponents: value === "all", selectedComponents: [] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">جميع المكونات</SelectItem><SelectItem value="selected">مكونات محددة</SelectItem></SelectContent></Select>{!requestForm.maintainAllComponents && <div className="flex flex-wrap gap-2">{selectedMachine.components.map((component) => { const checked = requestForm.selectedComponents?.includes(component); return <Button key={component} type="button" size="sm" variant={checked ? "default" : "outline"} onClick={() => setRequestForm((f) => ({ ...f, selectedComponents: checked ? f.selectedComponents?.filter((item) => item !== component) : [...(f.selectedComponents || []), component] }))}>{component}</Button>; })}</div>}</div> : null}
      </div><DialogFooter><Button variant="outline" onClick={() => setRequestOpen(false)}>إلغاء</Button><Button onClick={() => requestMutation.mutate()} disabled={!requestReady || requestMutation.isPending}>{requestMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}إنشاء الطلب</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}><DialogContent><DialogHeader><DialogTitle>تغيير حالة البلاغ</DialogTitle></DialogHeader><Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as ComplaintStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ComplaintStatus.NEW}>جديد</SelectItem><SelectItem value={ComplaintStatus.IN_PROGRESS}>قيد العمل</SelectItem><SelectItem value={ComplaintStatus.RESOLVED}>تم الحل</SelectItem><SelectItem value={ComplaintStatus.CLOSED}>مغلق</SelectItem></SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setStatusOpen(false)}>إلغاء</Button><Button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}>حفظ</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value || "—"}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const labels: Record<ComplaintStatus, string> = {
    [ComplaintStatus.NEW]: "جديد",
    [ComplaintStatus.IN_PROGRESS]: "قيد العمل",
    [ComplaintStatus.RESOLVED]: "تم الحل",
    [ComplaintStatus.CLOSED]: "مغلق",
  };
  return <span className="rounded-full border bg-muted px-3 py-1 text-sm font-medium">{labels[status]}</span>;
}
