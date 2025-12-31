import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Sun,
  Moon,
  Monitor,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { complaintsService } from "@/services/complaints";
import { useTheme } from "@/hooks/useTheme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const complaintSchema = z.object({
  reporterNameAr: z
    .string()
    .min(2, "اسم مقدم البلاغ (عربي) يجب أن يكون حرفين على الأقل"),
  reporterNameEn: z
    .string()
    .min(2, "اسم مقدم البلاغ (إنجليزي) يجب أن يكون حرفين على الأقل"),
  locationAr: z.string().min(2, "الموقع (عربي) مطلوب"),
  locationEn: z.string().min(2, "الموقع (إنجليزي) مطلوب"),
  descriptionAr: z
    .string()
    .min(10, "وصف البلاغ (عربي) يجب أن يكون 10 أحرف على الأقل"),
  descriptionEn: z
    .string()
    .min(10, "وصف البلاغ (إنجليزي) يجب أن يكون 10 أحرف على الأقل"),
  notesAr: z.string().optional(),
  notesEn: z.string().optional(),
});

type ComplaintForm = z.infer<typeof complaintSchema>;

export default function NewComplaint() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [complaintCode, setComplaintCode] = useState("");

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />;
      case "dark":
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ComplaintForm>({
    resolver: zodResolver(complaintSchema),
  });

  const onSubmit = async (data: ComplaintForm) => {
    try {
      setIsSubmitting(true);
      setError("");
      const complaint = await complaintsService.create(data);
      setComplaintCode(complaint.complaintCode);
      setSuccessDialog(true);
      reset();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "فشل تقديم البلاغ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* KSU Brand Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary dark:from-background dark:via-background/95 dark:to-background" />
      <div className="absolute inset-0 opacity-10 dark:opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-foreground rounded-full filter blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-foreground rounded-full filter blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      {/* Theme Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-20 text-white/90 hover:text-white hover:bg-white/10 dark:text-white/80 dark:hover:text-white"
        onClick={toggleTheme}
        title={
          theme === "light"
            ? "الوضع الفاتح"
            : theme === "dark"
            ? "الوضع الداكن"
            : "تلقائي (النظام)"
        }
      >
        {getThemeIcon()}
      </Button>

      {/* Back Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-20 text-white/90 hover:text-white hover:bg-white/10 dark:text-white/80 dark:hover:text-white"
        onClick={() => navigate("/")}
        title="العودة للصفحة الرئيسية"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="w-full max-w-2xl relative z-10 p-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <p className="text-white/90 dark:text-white/85 text-base font-semibold mb-1">
            المملكة العربية السعودية
          </p>
          <div className="flex h-24 w-auto items-center justify-center mb-4">
            <img
              src="/assets/logo.png"
              alt="جامعة الملك سعود"
              className="h-24 w-auto object-contain"
            />
          </div>

          <p className="text-white/90 dark:text-white/85 text-sm">
            نائب رئيس الجامعة للمشاريع
          </p>
          <p className="text-white/80 dark:text-white/75 text-xs mt-1">
            إدارة التشغيل والصيانة لكليات الجامعة - فرع المزاحمية
          </p>
        </div>

        <Card className="border-0 shadow-2xl bg-card/95 dark:bg-card/90 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-4">
            <p className="text-sm text-primary/80 mb-1">
              نظام إدارة طلبات الصيانة
            </p>
            <CardTitle className="text-2xl text-primary">تقديم بلاغ</CardTitle>
            <CardDescription>
              يرجى ملء جميع الحقول المطلوبة لتقديم البلاغ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Reporter Name - Bilingual */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-primary text-base font-semibold">
                    اسم مقدم البلاغ / Reporter Name{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <span
                    className="inline-flex items-center cursor-help"
                    title="مثال: أحمد محمد العلي / Example: Ahmed Mohammed Al-Ali"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reporterNameAr" className="text-sm">
                      بالعربية <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="reporterNameAr"
                      placeholder="مثال: أحمد محمد العلي"
                      title="مثال احترافي: أحمد محمد العلي - استخدم الاسم الكامل الرسمي"
                      {...register("reporterNameAr")}
                      className={`focus:border-primary focus:ring-primary ${
                        errors.reporterNameAr ? "border-destructive" : ""
                      }`}
                    />
                    {errors.reporterNameAr && (
                      <p className="text-xs text-destructive">
                        {errors.reporterNameAr.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reporterNameEn" className="text-sm">
                      In English <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="reporterNameEn"
                      placeholder="Example: Ahmed Mohammed Al-Ali"
                      title="Professional Example: Ahmed Mohammed Al-Ali - Use full official name"
                      {...register("reporterNameEn")}
                      className={`focus:border-primary focus:ring-primary ${
                        errors.reporterNameEn ? "border-destructive" : ""
                      }`}
                    />
                    {errors.reporterNameEn && (
                      <p className="text-xs text-destructive">
                        {errors.reporterNameEn.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Location - Bilingual */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-primary text-base font-semibold">
                    الموقع / Location{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <span
                    className="inline-flex items-center cursor-help"
                    title="مثال: مبنى كلية الهندسة - الطابق الثاني - مكتب 205 / Example: Engineering College Building - 2nd Floor - Office 205"
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="locationAr" className="text-sm">
                      بالعربية <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="locationAr"
                      placeholder="مثال: مبنى كلية الهندسة - الطابق الثاني - مكتب 205"
                      title="مثال احترافي: مبنى كلية الهندسة - الطابق الثاني - مكتب 205 - وصف دقيق مع الطابق والغرفة/المكتب"
                      {...register("locationAr")}
                      className={`focus:border-primary focus:ring-primary ${
                        errors.locationAr ? "border-destructive" : ""
                      }`}
                    />
                    {errors.locationAr && (
                      <p className="text-xs text-destructive">
                        {errors.locationAr.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationEn" className="text-sm">
                      In English <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="locationEn"
                      placeholder="Example: Engineering College Building - 2nd Floor - Office 205"
                      title="Professional Example: Engineering College Building - 2nd Floor - Office 205 - Precise description with floor and room/office"
                      {...register("locationEn")}
                      className={`focus:border-primary focus:ring-primary ${
                        errors.locationEn ? "border-destructive" : ""
                      }`}
                    />
                    {errors.locationEn && (
                      <p className="text-xs text-destructive">
                        {errors.locationEn.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Description - Bilingual */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-primary text-base font-semibold">
                    وصف البلاغ / Description{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <span
                    className="inline-flex items-center cursor-help"
                    title="مثال: تم ملاحظة تسرب مياه من نظام التكييف في المكتب. يرجى إرسال فريق الصيانة للفحص والإصلاح. / Example: Water leakage observed from the air conditioning system in the office. Please send maintenance team for inspection and repair."
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="descriptionAr" className="text-sm">
                      بالعربية <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="descriptionAr"
                      placeholder="مثال: تم ملاحظة تسرب مياه من نظام التكييف في المكتب. يرجى إرسال فريق الصيانة للفحص والإصلاح."
                      title="مثال احترافي: وصف واضح ومفصل للمشكلة مع السياق - اذكر نوع المشكلة، موقعها، وتأثيرها"
                      rows={4}
                      {...register("descriptionAr")}
                      className={`focus:border-primary focus:ring-primary ${
                        errors.descriptionAr ? "border-destructive" : ""
                      }`}
                    />
                    {errors.descriptionAr && (
                      <p className="text-xs text-destructive">
                        {errors.descriptionAr.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descriptionEn" className="text-sm">
                      In English <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="descriptionEn"
                      placeholder="Example: Water leakage observed from the air conditioning system in the office. Please send maintenance team for inspection and repair."
                      title="Professional Example: Clear and detailed description of the problem with context - mention problem type, location, and impact"
                      rows={4}
                      {...register("descriptionEn")}
                      className={`focus:border-primary focus:ring-primary ${
                        errors.descriptionEn ? "border-destructive" : ""
                      }`}
                    />
                    {errors.descriptionEn && (
                      <p className="text-xs text-destructive">
                        {errors.descriptionEn.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes - Bilingual */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Label className="text-primary text-base font-semibold">
                    ملاحظات / تفاصيل إضافية / Notes / Additional Details
                  </Label>
                  <span
                    className="inline-flex items-center cursor-help"
                    title="مثال: المشكلة بدأت صباح اليوم وتزداد سوءاً. يرجى المعالجة العاجلة. / Example: The issue started this morning and is getting worse. Please handle urgently."
                  >
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="notesAr" className="text-sm">
                      بالعربية
                    </Label>
                    <Textarea
                      id="notesAr"
                      placeholder="مثال: المشكلة بدأت صباح اليوم وتزداد سوءاً. يرجى المعالجة العاجلة."
                      title="مثال احترافي: معلومات إضافية مفيدة للمهندسين - التوقيت، الحالة الحالية، الأولوية"
                      rows={3}
                      {...register("notesAr")}
                      className="focus:border-primary focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notesEn" className="text-sm">
                      In English
                    </Label>
                    <Textarea
                      id="notesEn"
                      placeholder="Example: The issue started this morning and is getting worse. Please handle urgently."
                      title="Professional Example: Additional information useful for engineers - timing, current status, priority"
                      rows={3}
                      {...register("notesEn")}
                      className="focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري تقديم البلاغ...
                  </>
                ) : (
                  "تقديم البلاغ"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-white/70 dark:text-white/60 text-xs mt-3">
          © 2025 جامعة الملك سعود - جميع الحقوق محفوظة
        </p>
      </div>

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              تم تقديم البلاغ بنجاح
            </DialogTitle>
            <div className="pt-4">
              <p className="text-lg font-semibold mb-2">
                رقم البلاغ:{" "}
                <span className="text-primary">{complaintCode}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                تم استلام بلاغك بنجاح وسيتم متابعته من قبل الفريق المختص.
              </p>
            </div>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setSuccessDialog(false);
                navigate("/");
              }}
            >
              العودة للصفحة الرئيسية
            </Button>
            <Button
              onClick={() => {
                setSuccessDialog(false);
                reset();
              }}
            >
              تقديم بلاغ آخر
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
