import { Bell, Sun, Moon, Monitor, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useNotificationsStore } from "@/store/notifications";
import { getRoleLabel } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();
  const { unreadCount, markAllAsRead } = useNotificationsStore();
  const { theme, toggleTheme } = useTheme();

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-5 w-5" />;
      case 'dark':
        return <Moon className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getThemeTooltip = () => {
    switch (theme) {
      case 'light':
        return 'الوضع الفاتح';
      case 'dark':
        return 'الوضع الداكن';
      default:
        return 'تلقائي (النظام)';
    }
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
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title={getThemeTooltip()}
        >
          {getThemeIcon()}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground"
          onClick={markAllAsRead}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -left-0.5 sm:-top-1 sm:-left-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-destructive text-[9px] sm:text-[10px] text-destructive-foreground font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
