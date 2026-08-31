import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { complaintsService } from "@/services/complaints";
import { useTheme } from "@/hooks/useTheme";
import type { CreateComplaintForm } from "@/types";

type ComplaintLanguage = "ar" | "en";
type ComplaintUiForm = {
  reporterName: string;
  locationId: string;
  floorId: string;
  detailedLocation: string;
  departmentId: string;
  contactPhone?: string;
  description: string;
  notes?: string;
};

const isSaudiMobile = (value: string) => {
  const compact = value.replace(/[\s-]/g, "");
  return /^(?:05\d{8}|5\d{8}|9665\d{8}|\+9665\d{8})$/.test(compact);
};

const createComplaintSchema = (language: ComplaintLanguage) =>
  z.object({
    reporterName: z.string().trim().min(2, language === "ar" ? "اسم مقدم البلاغ مطلوب" : "Reporter name is required"),
    locationId: z.string().min(1, language === "ar" ? "اختر الموقع" : "Select a location"),
    floorId: z.string().min(1, language === "ar" ? "اختر الطابق" : "Select a floor"),
    detailedLocation: z.string().trim().min(2, language === "ar" ? "أدخل الموقع التفصيلي" : "Enter the detailed location"),
    departmentId: z.string().min(1, language === "ar" ? "اختر القسم" : "Select a department"),
    contactPhone: z.string().trim().refine((value) => !value || isSaudiMobile(value), language === "ar" ? "رقم الجوال السعودي غير صالح" : "Invalid Saudi mobile number").optional(),
    description: z.string().trim().min(10, language === "ar" ? "وصف البلاغ يجب أن يكون 10 أحرف على الأقل" : "Description must be at least 10 characters"),
    notes: z.string().trim().optional(),
  });

const emptyForm: ComplaintUiForm = {
  reporterName: "",
  locationId: "",
  floorId: "",
  detailedLocation: "",
  departmentId: "",
  contactPhone: "",
  description: "",
  notes: "",
};

export default function NewComplaint() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [language, setLanguage] = useState<ComplaintLanguage>("ar");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [complaintCode, setComplaintCode] = useState("");
  const isArabic = language === "ar";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ComplaintUiForm>({
    resolver: zodResolver(createComplaintSchema(language)),
    defaultValues: emptyForm,
  });

  const locationId = watch("locationId");
  const floorId = watch("floorId");
  const departmentId = watch("departmentId");

  const { data: referenceData, isLoading: loadingReferences } = useQuery({
    queryKey: ["public-complaint-reference-data"],
    queryFn: complaintsService.getPublicReferenceData,
  });

  const { data: floors, isFetching: loadingFloors } = useQuery({
    queryKey: ["public-complaint-floors", locationId],
    queryFn: () => complaintsService.getPublicFloors(locationId),
    enabled: Boolean(locationId),
  });

  const onSubmit = async (data: ComplaintUiForm) => {
    try {
      setIsSubmitting(true);
      setError("");
      const payload: CreateComplaintForm = {
        submissionLanguage: language,
        locationId: data.locationId,
        floorId: data.floorId,
        detailedLocation: data.detailedLocation.trim(),
        departmentId: data.departmentId,
        ...(data.contactPhone?.trim() ? { contactPhone: data.contactPhone.trim() } : {}),
        ...(isArabic
          ? {
              reporterNameAr: data.reporterName.trim(),
              descriptionAr: data.description.trim(),
              ...(data.notes?.trim() ? { notesAr: data.notes.trim() } : {}),
            }
          : {
              reporterNameEn: data.reporterName.trim(),
              descriptionEn: data.description.trim(),
              ...(data.notes?.trim() ? { notesEn: data.notes.trim() } : {}),
            }),
      };
      const complaint = await complaintsService.create(payload);
      setComplaintCode(complaint.complaintCode);
      setSuccessDialog(true);
      reset(emptyForm);
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setError(Array.isArray(message) ? message.join("، ") : message || (isArabic ? "فشل تقديم البلاغ" : "Failed to submit the complaint"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const themeIcon = theme === "light" ? <Sun className="h-4 w-4" /> : theme === "dark" ? <Moon className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary px-4 py-8 dark:from-background dark:via-background/95 dark:to-background">
      <Button variant="ghost" size="icon" className="fixed left-4 top-4 text-white" onClick={toggleTheme}>{themeIcon}</Button>
      <Button variant="ghost" size="icon" className="fixed right-4 top-4 text-white" onClick={() => navigate("/")}><ArrowRight className="h-4 w-4" /></Button>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="text-center text-white">
          <img src="/assets/logo.png" alt="جامعة الملك سعود" className="mx-auto h-24 w-auto" />
          <p className="mt-2 text-sm">إدارة التشغيل والصيانة لكليات الجامعة - فرع المزاحمية</p>
        </div>
        <Card className="border-0 bg-card/95 shadow-2xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-primary">{isArabic ? "تقديم بلاغ" : "Submit a Complaint"}</CardTitle>
            <CardDescription>{isArabic ? "اختر بيانات الموقع والقسم ثم صف سبب البلاغ" : "Select the location and department, then describe the issue"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3">
              <Button type="button" variant={isArabic ? "default" : "outline"} onClick={() => { setLanguage("ar"); reset(emptyForm); }}>العربية</Button>
              <Button type="button" variant={!isArabic ? "default" : "outline"} onClick={() => { setLanguage("en"); reset(emptyForm); }}>English</Button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
              {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <Field label={isArabic ? "الموقع" : "Location"} error={errors.locationId?.message}>
                <Select value={locationId} onValueChange={(value) => { setValue("locationId", value, { shouldValidate: true }); setValue("floorId", ""); }} disabled={loadingReferences}>
                  <SelectTrigger><SelectValue placeholder={isArabic ? "اختر الموقع" : "Select location"} /></SelectTrigger>
                  <SelectContent>{referenceData?.locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={isArabic ? "الطابق" : "Floor"} error={errors.floorId?.message}>
                <Select value={floorId} onValueChange={(value) => setValue("floorId", value, { shouldValidate: true })} disabled={!locationId || loadingFloors}>
                  <SelectTrigger><SelectValue placeholder={isArabic ? "اختر الطابق" : "Select floor"} /></SelectTrigger>
                  <SelectContent>{floors?.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={isArabic ? "الموقع التفصيلي" : "Detailed location"} error={errors.detailedLocation?.message}>
                <Input {...register("detailedLocation")} placeholder={isArabic ? "المبنى، الغرفة أو أقرب معلم" : "Building, room, or nearest landmark"} />
              </Field>
              <Field label={isArabic ? "القسم" : "Department"} error={errors.departmentId?.message}>
                <Select value={departmentId} onValueChange={(value) => setValue("departmentId", value, { shouldValidate: true })} disabled={loadingReferences}>
                  <SelectTrigger><SelectValue placeholder={isArabic ? "اختر القسم" : "Select department"} /></SelectTrigger>
                  <SelectContent>{referenceData?.departments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={isArabic ? "رقم التواصل (اختياري)" : "Contact number (optional)"} error={errors.contactPhone?.message}>
                <Input {...register("contactPhone")} inputMode="tel" dir="ltr" placeholder="05XXXXXXXX" />
              </Field>
              <Field label={isArabic ? "اسم مقدم البلاغ" : "Reporter name"} error={errors.reporterName?.message}>
                <Input {...register("reporterName")} autoComplete="name" />
              </Field>
              <Field label={isArabic ? "وصف البلاغ" : "Complaint description"} error={errors.description?.message}>
                <Textarea {...register("description")} rows={5} placeholder={isArabic ? "صف سبب البلاغ بوضوح" : "Clearly describe the reason for the complaint"} />
              </Field>
              <Field label={isArabic ? "ملاحظات مقدم البلاغ (اختياري)" : "Reporter notes (optional)"}>
                <Textarea {...register("notes")} rows={3} />
              </Field>
              <Button type="submit" className="w-full" disabled={isSubmitting || loadingReferences}>
                {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {isArabic ? "تقديم البلاغ" : "Submit complaint"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" />{isArabic ? "تم تقديم البلاغ بنجاح" : "Complaint submitted successfully"}</DialogTitle>
            <DialogDescription className="pt-4 text-start">{isArabic ? "رقم البلاغ" : "Complaint code"}: <strong className="text-primary">{complaintCode}</strong></DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate("/")}>{isArabic ? "العودة للرئيسية" : "Back home"}</Button>
            <Button onClick={() => { setSuccessDialog(false); reset(emptyForm); }}>{isArabic ? "تقديم بلاغ آخر" : "Submit another"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-primary">{label} <span className="text-destructive">*</span></Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
