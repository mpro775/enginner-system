import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  MapPin,
  Building2,
  Cog,
  Wrench,
  BarChart3,
  FileSpreadsheet,
  History,
  LogOut,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { Role } from '@/types';
import { Button } from '@/components/ui/button';

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  roles?: Role[];
}

const navItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'لوحة التحكم',
    href: '/dashboard',
  },
  {
    icon: FileText,
    label: 'طلبات الصيانة',
    href: '/requests',
  },
  {
    icon: BarChart3,
    label: 'الإحصائيات',
    href: '/statistics',
    roles: [Role.ADMIN, Role.CONSULTANT],
  },
  {
    icon: FileSpreadsheet,
    label: 'التقارير',
    href: '/reports',
    roles: [Role.ADMIN, Role.CONSULTANT],
  },
  {
    icon: Users,
    label: 'المستخدمين',
    href: '/admin/users',
    roles: [Role.ADMIN],
  },
  {
    icon: MapPin,
    label: 'المواقع',
    href: '/admin/locations',
    roles: [Role.ADMIN],
  },
  {
    icon: Building2,
    label: 'الأقسام',
    href: '/admin/departments',
    roles: [Role.ADMIN],
  },
  {
    icon: Cog,
    label: 'الأنظمة',
    href: '/admin/systems',
    roles: [Role.ADMIN],
  },
  {
    icon: Wrench,
    label: 'الآلات',
    href: '/admin/machines',
    roles: [Role.ADMIN],
  },
  {
    icon: History,
    label: 'سجل العمليات',
    href: '/admin/audit-logs',
    roles: [Role.ADMIN],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 h-screen w-72 border-l bg-card shadow-xl transition-transform duration-300 ease-in-out lg:w-64 lg:shadow-none lg:translate-x-0',
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo & Close Button - TNC Brand */}
          <div className="flex h-14 sm:h-16 items-center justify-between border-b border-border/50 px-4 sm:px-6 bg-gradient-to-l from-transparent to-[#1E3A5F]/5 dark:to-[#1E3A5F]/20">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A5F] text-white relative overflow-hidden shadow-md">
                {/* Gold accent stripe */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#C4A052] to-[#B8860B]" />
                <Building2 className="h-5 w-5 relative z-10" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground leading-tight">تبراك نجد</span>
                <span className="text-[10px] text-[#C4A052] font-medium">نظام الصيانة</span>
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
          <nav className="flex-1 overflow-y-auto p-3 sm:p-4">
            <ul className="space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href ||
                  location.pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      onClick={handleLinkClick}
                      className={cn(
                        'sidebar-link',
                        isActive && 'active'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User info & Logout */}
          <div className="border-t border-border/50 p-3 sm:p-4">
            <div className="mb-3 rounded-lg bg-muted/50 dark:bg-muted/30 p-3">
              <p className="font-medium text-sm sm:text-base text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <Button
              variant="outline"
              className="w-full text-sm"
              onClick={() => {
                logout();
                onClose();
              }}
            >
              <LogOut className="ml-2 h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
