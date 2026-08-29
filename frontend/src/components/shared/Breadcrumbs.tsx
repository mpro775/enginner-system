import { ChevronLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="مسار التنقل" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-xs text-muted-foreground sm:text-sm">
        <li>
          <Link
            to="/app/dashboard"
            className="inline-flex items-center gap-1 rounded px-1 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Home className="h-3.5 w-3.5" />
            لوحة التحكم
          </Link>
        </li>
        {items.map((item, index) => (
          <li
            key={`${item.label}-${index}`}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {item.href ? (
              <Link
                to={item.href}
                className="rounded px-1 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="px-1 py-1 text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
