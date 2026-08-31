import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Users,
  MapPin,
  Building2,
  Layers3,
  Cog,
  Wrench,
  BarChart3,
  FileSpreadsheet,
  History,
  LogOut,
  X,
  Calendar,
  ClipboardList,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { Role } from "@/types";
import { Button } from "@/components/ui/button";

interface NavItem {
  icon: React.ElementType;
  label: string;
  href?: string;
  roles?: Role[];
  isAction?: boolean;
  onClick?: () => void;
}

const navItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: "لوحة التحكم",
    href: "/app/dashboard",
  },
  {
    icon: FileText,
    label: "طلبات الصيانة",
    href: "/app/requests",
  },
  {
    icon: AlertCircle,
    label: "البلاغات",
    href: "/app/complaints",
    roles: [
      Role.ADMIN,
      Role.CONSULTANT,
      Role.ENGINEER,
      Role.MAINTENANCE_MANAGER,
    ],
  },
  {
    icon: ClipboardList,
    label: "صيانتي الوقائية",
    href: "/app/engineer/my-tasks",
    roles: [Role.ENGINEER],
  },
  {
    icon: BarChart3,
    label: "الإحصائيات",
    href: "/app/statistics",
    roles: [Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER],
  },
  {
    icon: BarChart3,
    label: "مركز التحليلات",
    href: "/app/admin/analytics",
    roles: [Role.ADMIN],
  },
  {
    icon: FileSpreadsheet,
    label: "التقارير",
    href: "/app/reports",
    roles: [Role.ADMIN, Role.CONSULTANT, Role.MAINTENANCE_MANAGER],
  },
  {
    icon: Users,
    label: "المستخدمين",
    href: "/app/admin/users",
    roles: [Role.ADMIN],
  },
  {
    icon: MapPin,
    label: "المواقع",
    href: "/app/admin/locations",
    roles: [Role.ADMIN],
  },
  {
    icon: Building2,
    label: "الأقسام",
    href: "/app/admin/departments",
    roles: [Role.ADMIN],
  },
  {
    icon: Layers3,
    label: "الطوابق",
    href: "/app/admin/floors",
    roles: [Role.ADMIN],
  },
  {
    icon: Cog,
    label: "الأنظمة",
    href: "/app/admin/systems",
    roles: [Role.ADMIN],
  },
  {
    icon: Wrench,
    label: "الآلات",
    href: "/app/admin/machines",
    roles: [Role.ADMIN],
  },
  {
    icon: Calendar,
    label: "الصيانة الوقائية",
    href: "/app/admin/scheduled-tasks",
    roles: [Role.ADMIN, Role.CONSULTANT],
  },
  {
    icon: Calendar,
    label: "تقويم الصيانة الوقائية",
    href: "/app/admin/preventive-calendar",
    roles: [Role.ADMIN],
  },
  {
    icon: History,
    label: "سجل العمليات",
    href: "/app/admin/audit-logs",
    roles: [Role.ADMIN],
  },
  {
    icon: Trash2,
    label: "سلة المهملات",
    href: "/app/admin/trash",
    roles: [Role.ADMIN],
  },
  {
    icon: LogOut,
    label: "تسجيل الخروج",
    isAction: true,
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [isMobile, setIsMobile] = useState(false);

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );
  const adminNavigationGroups = [
    {
      label: "مساحة العمل",
      hrefs: [
        "/app/dashboard",
        "/app/requests",
        "/app/complaints",
        "/app/admin/scheduled-tasks",
      ],
    },
    {
      label: "التحليل والتخطيط",
      hrefs: [
        "/app/admin/analytics",
        "/app/admin/preventive-calendar",
        "/app/statistics",
        "/app/reports",
      ],
    },
    {
      label: "إدارة البيانات",
      hrefs: [
        "/app/admin/users",
        "/app/admin/locations",
        "/app/admin/floors",
        "/app/admin/departments",
        "/app/admin/systems",
        "/app/admin/machines",
      ],
    },
    {
      label: "النظام",
      hrefs: ["/app/admin/audit-logs", "/app/admin/trash"],
    },
  ];

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Only hide from screen readers when closed on mobile
  const shouldHideFromScreenReader = !isOpen && isMobile;

  const renderNavigationItem = (item: NavItem, key: string) => {
    const isActive =
      item.href &&
      (location.pathname === item.href ||
        location.pathname.startsWith(item.href + "/"));
    const Icon = item.icon;

    if (item.isAction) {
      return (
        <li key={key}>
          <button
            onClick={() => {
              if (item.onClick) item.onClick();
              else {
                logout();
                onClose();
              }
              handleLinkClick();
            }}
            className="sidebar-link w-full text-right"
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        </li>
      );
    }

    return (
      <li key={key}>
        <Link
          to={item.href!}
          onClick={handleLinkClick}
          className={cn("sidebar-link", isActive && "active")}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-screen w-72 border-l bg-card shadow-xl transition-transform duration-300 ease-in-out lg:w-64 lg:shadow-none",
          isOpen
            ? "translate-x-0"
            : "translate-x-full lg:translate-x-0 pointer-events-none lg:pointer-events-auto",
        )}
        {...(shouldHideFromScreenReader && { "aria-hidden": "true" })}
      >
        <div className="flex h-full flex-col">
          {/* Logo & Close Button - KSU Brand */}
          <div className="flex h-14 sm:h-16 items-center justify-between border-b border-border/50 px-4 sm:px-6 bg-gradient-to-l from-transparent to-[#0099B7]/5 dark:to-[#0099B7]/20 flex-shrink-0">
            <div className="flex items-center gap-3">
              <img
                src="/assets/logo.png"
                alt="جامعة الملك سعود"
                className="h-10 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#0099B7] font-medium">
                  نظام الصيانة
                </span>
              </div>
            </div>
            {/* Close button - only visible on mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">إغلاق القائمة</span>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0">
            {user?.role === Role.ADMIN ? (
              <div className="space-y-5">
                {adminNavigationGroups.map((group) => {
                  const items = filteredNavItems.filter(
                    (item) => item.href && group.hrefs.includes(item.href),
                  );
                  if (!items.length) return null;
                  return (
                    <section
                      key={group.label}
                      aria-labelledby={`nav-${group.label}`}
                    >
                      <h2
                        id={`nav-${group.label}`}
                        className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {group.label}
                      </h2>
                      <ul className="space-y-1">
                        {items.map((item) =>
                          renderNavigationItem(item, item.href!),
                        )}
                      </ul>
                    </section>
                  );
                })}
                <ul className="space-y-1 border-t pt-3">
                  {filteredNavItems
                    .filter((item) => item.isAction)
                    .map((item, index) =>
                      renderNavigationItem(item, `action-${index}`),
                    )}
                </ul>
              </div>
            ) : (
              <ul className="space-y-1">
                {filteredNavItems.map((item, index) =>
                  renderNavigationItem(item, item.href || `action-${index}`),
                )}
              </ul>
            )}
          </nav>

          {/* User info */}
          <div className="border-t border-border/50 p-3 sm:p-4 flex-shrink-0">
            <div className="rounded-lg bg-muted/50 dark:bg-muted/30 p-3">
              <p className="font-medium text-sm sm:text-base text-foreground truncate">
                {user?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
