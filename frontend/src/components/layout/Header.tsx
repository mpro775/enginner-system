import { Sun, Moon, Menu, House } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { getRoleLabel } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { NotificationDropdown } from "./NotificationDropdown";
import { InstallButton } from "@/components/InstallButton";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { Role } from "@/types";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    return theme === "dark" ? (
      <Moon className="h-5 w-5" />
    ) : (
      <Sun className="h-5 w-5" />
    );
  };

  const getThemeTooltip = () => {
    return theme === "dark" ? "الوضع الداكن" : "الوضع الفاتح";
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-6">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        {/* Hamburger menu - only visible on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">فتح القائمة</span>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-bold truncate text-foreground">
            مرحباً، {user?.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {user && getRoleLabel(user.role)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-2 sm:px-3"
          onClick={() => navigate("/")}
          title="العودة للرئيسية"
          aria-label="العودة للرئيسية"
        >
          <House className="h-4 w-4" />
          <span className="hidden sm:inline">الرئيسية</span>
        </Button>
        {user?.role === Role.ADMIN && <AdminCommandPalette />}
        <InstallButton />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title={getThemeTooltip()}
        >
          {getThemeIcon()}
        </Button>

        <NotificationDropdown />
      </div>
    </header>
  );
}
