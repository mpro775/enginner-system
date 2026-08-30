import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Monitor,
  Moon,
  Sun,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { complaintsService } from "@/services/complaints";
import { useTheme } from "@/hooks/useTheme";
import type { CreateComplaintForm } from "@/types";

type ComplaintLanguage = "ar" | "en";

type ComplaintUiForm = {
  reporterName: string;
  location: string;
  description: string;
  notes?: string;
};

const createComplaintSchema = (language: ComplaintLanguage) =>
  z.object({
    reporterName: z
      .string()
      .trim()
      .min(
        2,
        language === "ar"
          ? "اسم مقدم البلاغ يجب أن يكون حرفين على الأقل"
          : "Reporter name must be at least 2 characters"
      ),
    location: z
      .string()
      .trim()
      .min(
        2,
        language === "ar"
          ? "الموقع يجب أن يكون حرفين على الأقل"
          : "Location must be at least 2 characters"
      ),
    description: z
      .string()
      .trim()
      .min(
        10,
        language === "ar"
          ? "وصف البلاغ يجب أن يكون 10 أحرف على الأقل"
          : "Description must be at least 10 characters"
      ),
    notes: z.string().trim().optional(),
  });

const emptyForm: ComplaintUiForm = {
  reporterName: "",
  location: "",
  description: "",
  notes: "",
};

export default function NewComplaint() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [language, setLanguage] = useState<ComplaintLanguage>("ar");
  const [pendingLanguage, setPendingLanguage] =
    useState<ComplaintLanguage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [complaintCode, setComplaintCode] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    reset,
  } = useForm<ComplaintUiForm>({
    resolver: zodResolver(createComplaintSchema(language)),
    defaultValues: emptyForm,
  });

  const isArabic = language === "ar";

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

  const changeLanguage = (nextLanguage: ComplaintLanguage) => {
    reset(emptyForm);
    setError("");
    setLanguage(nextLanguage);
    setPendingLanguage(null);
  };

  const requestLanguageChange = (nextLanguage: ComplaintLanguage) => {
    if (nextLanguage === language) return;

    const hasEnteredData = Object.values(getValues()).some(
      (value) => typeof value === "string" && value.trim().length > 0
    );

    if (hasEnteredData) {
      setPendingLanguage(nextLanguage);
      return;
    }

    changeLanguage(nextLanguage);
  };

  const onSubmit = async (data: ComplaintUiForm) => {
    try {
      setIsSubmitting(true);
      setError("");

      const notes = data.notes?.trim();
      const payload: CreateComplaintForm = isArabic
        ? {
            submissionLanguage: "ar",
            reporterNameAr: data.reporterName.trim(),
            locationAr: data.location.trim(),
            descriptionAr: data.description.trim(),
            ...(notes ? { notesAr: notes } : {}),
          }
        : {
            submissionLanguage: "en",
            reporterNameEn: data.reporterName.trim(),
            locationEn: data.location.trim(),
            descriptionEn: data.description.trim(),
            ...(notes ? { notesEn: notes } : {}),
          };

      const complaint = await complaintsService.create(payload);
      setComplaintCode(complaint.complaintCode);
      setSuccessDialog(true);
      reset(emptyForm);
    } catch (err: unknown) {
      const requestError = err as {
        response?: { data?: { message?: string | string[] } };
      };
      const message = requestError.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join("، ")
          : message ||
              (isArabic
                ? "فشل تقديم البلاغ"
                : "Failed to submit the complaint")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background py-6">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary dark:from-background dark:via-background/95 dark:to-background" />
      <div className="absolute inset-0 opacity-10 dark:opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-foreground rounded-full filter blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-foreground rounded-full filter blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

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

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-20 text-white/90 hover:text-white hover:bg-white/10 dark:text-white/80 dark:hover:text-white"
        onClick={() => navigate("/")}
        title={isArabic ? "العودة للرئيسية" : "Back to home"}
        aria-label={isArabic ? "العودة للرئيسية" : "Back to home"}
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="w-full max-w-2xl relative z-10 p-4">
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
              {isArabic ? "تقديم بلاغ" : "Submit a Complaint"}
            </CardTitle>
            <CardDescription>
              {isArabic
                ? "يرجى ملء جميع الحقول المطلوبة لتقديم البلاغ"
                : "Complete the required fields to submit your complaint"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 rounded-lg border bg-muted/30 p-4 text-center">
              <p className="font-semibold text-foreground">
                اختر لغة تقديم البلاغ / Choose complaint language
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isArabic
                  ? "يمكنك تقديم البلاغ بلغة واحدة فقط، ولا تحتاج إلى كتابة نفس المعلومات مرتين."
                  : "Submit the complaint in one language only; you do not need to enter the same information twice."}
              </p>
              <div
                className="mt-4 grid grid-cols-2 gap-2"
                role="group"
                aria-label="لغة تقديم البلاغ"
              >
                <Button
                  type="button"
                  variant={isArabic ? "default" : "outline"}
                  className="min-h-11"
                  aria-pressed={isArabic}
                  onClick={() => requestLanguageChange("ar")}
                >
                  العربية {isArabic && <span aria-hidden="true">✓</span>}
                </Button>
                <Button
                  type="button"
                  variant={!isArabic ? "default" : "outline"}
                  className="min-h-11"
                  aria-pressed={!isArabic}
                  onClick={() => requestLanguageChange("en")}
                >
                  English {!isArabic && <span aria-hidden="true">✓</span>}
                </Button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              dir={isArabic ? "rtl" : "ltr"}
              lang={language}
            >
              {error && (
                <div
                  className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reporterName" className="text-primary">
                  {isArabic ? "اسم مقدم البلاغ" : "Reporter name"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reporterName"
                  autoComplete="name"
                  placeholder={
                    isArabic ? "مثال: أحمد محمد العلي" : "Example: Ahmed Al-Ali"
                  }
                  {...register("reporterName")}
                  className={errors.reporterName ? "border-destructive" : ""}
                />
                {errors.reporterName && (
                  <p className="text-xs text-destructive">
                    {errors.reporterName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-primary">
                  {isArabic ? "الموقع" : "Location"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="location"
                  placeholder={
                    isArabic
                      ? "مثال: مبنى كلية الهندسة - الطابق الثاني - مكتب 205"
                      : "Example: Engineering College - 2nd Floor - Office 205"
                  }
                  {...register("location")}
                  className={errors.location ? "border-destructive" : ""}
                />
                {errors.location && (
                  <p className="text-xs text-destructive">
                    {errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-primary">
                  {isArabic ? "وصف البلاغ" : "Complaint description"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  rows={5}
                  placeholder={
                    isArabic
                      ? "صف المشكلة وموقعها وتأثيرها بوضوح"
                      : "Clearly describe the issue, its location, and its impact"
                  }
                  {...register("description")}
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-primary">
                  {isArabic
                    ? "ملاحظات / تفاصيل إضافية (اختياري)"
                    : "Notes / Additional details (optional)"}
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder={
                    isArabic
                      ? "أي معلومات إضافية قد تساعد فريق الصيانة"
                      : "Any additional information that may help the maintenance team"
                  }
                  {...register("notes")}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2
                      className={`${isArabic ? "ml-2" : "mr-2"} h-4 w-4 animate-spin`}
                    />
                    {isArabic ? "جاري تقديم البلاغ..." : "Submitting..."}
                  </>
                ) : isArabic ? (
                  "تقديم البلاغ"
                ) : (
                  "Submit complaint"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-white/70 dark:text-white/60 text-xs mt-3">
          © 2025 جامعة الملك سعود - جميع الحقوق محفوظة
        </p>
      </div>

      <Dialog
        open={pendingLanguage !== null}
        onOpenChange={(open) => !open && setPendingLanguage(null)}
      >
        <DialogContent dir={isArabic ? "rtl" : "ltr"} lang={language}>
          <DialogHeader>
            <DialogTitle>
              {isArabic ? "تغيير لغة البلاغ" : "Change complaint language"}
            </DialogTitle>
            <DialogDescription>
              {isArabic
                ? "تغيير اللغة سيمسح البيانات التي أدخلتها في النموذج الحالي. هل تريد المتابعة؟"
                : "Changing the language will clear the data entered in the current form. Continue?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingLanguage(null)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() =>
                pendingLanguage && changeLanguage(pendingLanguage)
              }
            >
              {isArabic ? "تغيير اللغة" : "Change language"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent dir={isArabic ? "rtl" : "ltr"} lang={language}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {isArabic
                ? "تم تقديم البلاغ بنجاح"
                : "Complaint submitted successfully"}
            </DialogTitle>
            <DialogDescription className="pt-4 text-start">
              <span className="block text-lg font-semibold text-foreground mb-2">
                {isArabic ? "رقم البلاغ:" : "Complaint code:"}{" "}
                <span className="text-primary">{complaintCode}</span>
              </span>
              {isArabic
                ? "تم استلام بلاغك وسيتم متابعته من قبل الفريق المختص."
                : "Your complaint was received and will be reviewed by the responsible team."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setSuccessDialog(false);
                navigate("/");
              }}
            >
              {isArabic ? "العودة للرئيسية" : "Back to home"}
            </Button>
            <Button
              onClick={() => {
                setSuccessDialog(false);
                reset(emptyForm);
              }}
            >
              {isArabic ? "تقديم بلاغ آخر" : "Submit another complaint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
