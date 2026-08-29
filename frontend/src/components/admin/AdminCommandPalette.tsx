import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, Loader2, Search, Siren, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminSearchItem, adminSearchService } from "@/services/admin-search";

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin-global-search", debouncedQuery],
    queryFn: () => adminSearchService.search(debouncedQuery),
    enabled: open && debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const close = () => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
  };
  const groups = [
    {
      key: "requests",
      title: "طلبات الصيانة",
      icon: FileText,
      href: (id: string) => `/app/requests/${id}`,
    },
    {
      key: "machines",
      title: "الآلات",
      icon: Wrench,
      href: (id: string) => `/app/admin/machines/${id}`,
    },
    {
      key: "complaints",
      title: "البلاغات",
      icon: Siren,
      href: (id: string) => `/app/complaints/${id}`,
    },
    {
      key: "users",
      title: "المستخدمون",
      icon: User,
      href: () => "/app/admin/users",
    },
  ] as const;
  const total = data
    ? Object.values(data.groups).reduce((sum, items) => sum + items.length, 0)
    : 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="فتح البحث الإداري"
        className="h-9 gap-2 px-2 sm:px-3"
      >
        <Search className="h-4 w-4" />
        <span className="hidden xl:inline">بحث</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground xl:inline">
          Ctrl K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10%] max-h-[80vh] translate-y-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-4 pb-3 text-right">
            <DialogTitle>البحث الإداري الشامل</DialogTitle>
            <DialogDescription>
              ابحث في الطلبات والآلات والبلاغات والمستخدمين.
            </DialogDescription>
          </DialogHeader>
          <div className="relative px-4 pt-4">
            <Search className="absolute right-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="اكتب حرفين على الأقل…"
              className="pr-10"
              aria-label="عبارة البحث"
            />
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-4 pt-3">
            {query.trim().length < 2 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                ابدأ بكتابة حرفين لعرض النتائج.
              </p>
            ) : isFetching ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري البحث…
              </div>
            ) : isError ? (
              <p className="py-10 text-center text-sm text-destructive">
                تعذر تنفيذ البحث. حاول مرة أخرى.
              </p>
            ) : total === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                لا توجد نتائج مطابقة.
              </p>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => {
                  const items = data?.groups[group.key] || [];
                  if (!items.length) return null;
                  const Icon = group.icon;
                  return (
                    <section key={group.key}>
                      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        {group.title}
                      </h3>
                      <div className="space-y-1">
                        {items.map((item: AdminSearchItem) => (
                          <Link
                            key={item.id}
                            to={group.href(item.id)}
                            onClick={close}
                            className="block rounded-lg border p-3 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <p className="font-medium">{item.title}</p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {item.subtitle || "لا توجد تفاصيل إضافية"}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
