import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogIn } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Sun, Moon, Monitor } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

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

      <div className="w-full max-w-2xl relative z-10 p-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-16">
          <p className="text-white/95 dark:text-white/90 text-lg font-bold mb-2 drop-shadow-lg">
            المملكة العربية السعودية
          </p>
          <div className="flex h-28 w-auto items-center justify-center mb-6 transition-transform hover:scale-105 duration-300">
            <img
              src="/assets/logo.png"
              alt="جامعة الملك سعود"
              className="h-28 w-auto object-contain drop-shadow-2xl"
            />
          </div>

          <p className="text-white/95 dark:text-white/90 text-base font-semibold mb-1">
            نائب رئيس الجامعة للمشاريع
          </p>
          <p className="text-white/85 dark:text-white/80 text-sm mt-1">
            إدارة التشغيل والصيانة لكليات الجامعة - فرع المزاحمية
          </p>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-8">
          <h1 className="text-white/95 dark:text-white/90 text-2xl font-bold mb-2 drop-shadow-lg">
            مرحباً بك في نظام البلاغات
          </h1>
          <p className="text-white/80 dark:text-white/75 text-sm">
            يمكنك تقديم بلاغ جديد أو الدخول إلى حسابك
          </p>
        </div>

        {/* Main Options */}
        <div className="space-y-5">
          <Button
            onClick={() => navigate("/complaint/new")}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-7 text-xl h-auto shadow-2xl shadow-red-500/50 hover:shadow-red-600/60 transition-all duration-300 transform hover:scale-[1.02] border-2 border-red-500/30 hover:border-red-400/50"
            size="lg"
          >
            <AlertCircle className="ml-2 h-6 w-6 animate-pulse" />
            تقديم بلاغ
          </Button>

          <Button
            onClick={() => navigate("/login")}
            variant="outline"
            className="w-full border-2 border-white/30 hover:border-white/50 bg-white/10 hover:bg-white/20 text-white font-medium py-6 text-lg h-auto backdrop-blur-sm transition-all duration-300"
            size="lg"
          >
            <LogIn className="ml-2 h-5 w-5" />
            الدخول إلى النظام
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-white/70 dark:text-white/60 text-xs mt-8">
          © 2025 جامعة الملك سعود - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}

