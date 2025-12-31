import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sun, Moon, Monitor, ArrowRight, CheckCircle2 } from "lucide-react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const complaintSchema = z.object({
  reporterName: z.string().min(2, "اسم مقدم البلاغ يجب أن يكون حرفين على الأقل"),
  location: z.string().min(2, "الموقع مطلوب"),
  description: z.string().min(10, "وصف البلاغ يجب أن يكون 10 أحرف على الأقل"),
  notes: z.string().optional(),
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
            <CardTitle className="text-2xl text-primary">
              تقديم بلاغ
            </CardTitle>
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

              <div className="space-y-2">
                <Label htmlFor="reporterName" className="text-primary">
                  اسم مقدم البلاغ <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reporterName"
                  placeholder="أدخل اسم مقدم البلاغ"
                  {...register("reporterName")}
                  className={`focus:border-primary focus:ring-primary ${
                    errors.reporterName ? "border-destructive" : ""
                  }`}
                />
                {errors.reporterName && (
                  <p className="text-xs text-destructive">
                    {errors.reporterName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-primary">
                  الموقع <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="location"
                  placeholder="أدخل الموقع"
                  {...register("location")}
                  className={`focus:border-primary focus:ring-primary ${
                    errors.location ? "border-destructive" : ""
                  }`}
                />
                {errors.location && (
                  <p className="text-xs text-destructive">
                    {errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-primary">
                  وصف البلاغ <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="أدخل وصف تفصيلي للبلاغ"
                  rows={4}
                  {...register("description")}
                  className={`focus:border-primary focus:ring-primary ${
                    errors.description ? "border-destructive" : ""
                  }`}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-primary">
                  ملاحظات / تفاصيل إضافية
                </Label>
                <Textarea
                  id="notes"
                  placeholder="أدخل أي ملاحظات أو تفاصيل إضافية (اختياري)"
                  rows={3}
                  {...register("notes")}
                  className="focus:border-primary focus:ring-primary"
                />
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
            <DialogDescription className="pt-4">
              <p className="text-lg font-semibold mb-2">
                رقم البلاغ: <span className="text-primary">{complaintCode}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                تم استلام بلاغك بنجاح وسيتم متابعته من قبل الفريق المختص.
              </p>
            </DialogDescription>
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

