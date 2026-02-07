import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  total?: number;
  limit?: number;
  itemLabel?: string;
}

function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const delta = 2;

  const left = Math.max(2, currentPage - delta);
  const right = Math.min(totalPages - 1, currentPage + delta);

  pages.push(1);

  if (left > 2) {
    pages.push("ellipsis");
  }

  for (let i = left; i <= right; i++) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (right < totalPages - 1) {
    pages.push("ellipsis");
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showInfo = false,
  total = 0,
  limit = 10,
  itemLabel = "عنصر",
}: PaginationProps) {
  const hasPrevPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const from = total > 0 ? (currentPage - 1) * limit + 1 : 0;
  const to = Math.min(currentPage * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
      {showInfo && total > 0 && (
        <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right order-2 sm:order-1">
          عرض {from} إلى {to} من{" "}
          <span className="font-semibold text-foreground">{total}</span>{" "}
          {itemLabel}
        </p>
      )}
      <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrevPage}
          onClick={() => onPageChange(currentPage - 1)}
          className="flex items-center gap-1"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="hidden sm:inline">السابق</span>
        </Button>
        <div className="flex items-center gap-1">
          {pageNumbers.map((page, idx) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1.5 text-muted-foreground text-sm"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className="min-w-[2rem] h-8 px-2"
                onClick={() => onPageChange(page)}
              >
                {page}
              </Button>
            )
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => onPageChange(currentPage + 1)}
          className="flex items-center gap-1"
        >
          <span className="hidden sm:inline">التالي</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
