import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/store/auth";
import { useTheme } from "@/hooks/useTheme";

const loginSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

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
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError("");
      const response = await authService.login(data);
      login(response.user, response.accessToken, response.refreshToken);

      const from =
        (location.state as { from?: Location })?.from?.pathname || "/app/dashboard";
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || "فشل تسجيل الدخول");
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

      <div className="w-full max-w-md relative z-10 p-4">
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
              تسجيل الدخول
            </CardTitle>
            <CardDescription>
              أدخل بيانات حسابك للوصول إلى النظام
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
                <Label htmlFor="email" className="text-primary">
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@ksu.edu.sa"
                  {...register("email")}
                  className={`focus:border-primary focus:ring-primary ${
                    errors.email ? "border-destructive" : ""
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-primary">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                    className={`focus:border-primary focus:ring-primary ${
                      errors.password ? "border-destructive pl-10" : "pl-10"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  "تسجيل الدخول"
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
    </div>
  );
}
