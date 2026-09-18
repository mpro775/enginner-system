import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ComplaintAttachment } from "@/types";

interface Props {
  attachments?: ComplaintAttachment[];
  onRefreshUrls: () => Promise<unknown>;
}

export function ComplaintImageGallery({ attachments = [], onRefreshUrls }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const refreshAttempted = useRef(false);
  const selected = selectedIndex === null ? undefined : attachments[selectedIndex];

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setFailed(false);
  }, [selected]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && attachments.length > 1) {
        setSelectedIndex((current) =>
          current === null ? null : (current + 1) % attachments.length,
        );
      }
      if (event.key === "ArrowRight" && attachments.length > 1) {
        setSelectedIndex((current) =>
          current === null
            ? null
            : (current - 1 + attachments.length) % attachments.length,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [attachments.length, selectedIndex]);

  if (!attachments.length) return null;

  const openImage = (index: number) => {
    refreshAttempted.current = false;
    setSelectedIndex(index);
  };

  const handleFullImageError = async () => {
    setLoading(false);
    if (!refreshAttempted.current) {
      refreshAttempted.current = true;
      try {
        await onRefreshUrls();
        return;
      } catch {
        // The explicit error state below is clearer than the browser's broken image.
      }
    }
    setFailed(true);
  };

  const move = (offset: number) => {
    if (selectedIndex === null) return;
    refreshAttempted.current = false;
    setSelectedIndex(
      (selectedIndex + offset + attachments.length) % attachments.length,
    );
  };

  return (
    <>
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">صور المشكلة</h2>
          <span className="text-sm text-muted-foreground">{attachments.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((attachment, index) => (
            <button
              type="button"
              key={attachment.id}
              className="aspect-square overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              onClick={() => openImage(index)}
              aria-label={`فتح صورة المشكلة ${index + 1}`}
            >
              <img
                src={attachment.thumbnailUrl}
                alt={`صورة المشكلة ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
        </div>
      </section>

      <Dialog
        open={selectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
      >
        <DialogContent className="max-h-[95vh] max-w-5xl border-0 bg-black/95 p-3 text-white sm:rounded-xl">
          <DialogHeader className="pe-10 text-start">
            <DialogTitle className="text-sm font-normal text-white/80">
              صورة {selectedIndex === null ? 0 : selectedIndex + 1} من {attachments.length}
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden rounded-lg">
            {loading && !failed && (
              <Loader2 className="absolute h-8 w-8 animate-spin text-white/80" />
            )}
            {failed ? (
              <div className="flex flex-col items-center gap-3 text-white/80">
                <ImageOff className="h-10 w-10" />
                <p>تعذر تحميل الصورة. أغلق النافذة وحاول مرة أخرى.</p>
              </div>
            ) : selected ? (
              <img
                key={selected.url}
                src={selected.url}
                alt={`صورة المشكلة ${selectedIndex! + 1}`}
                className={`max-h-[78vh] max-w-full object-contain ${loading ? "opacity-0" : "opacity-100"}`}
                onLoad={() => setLoading(false)}
                onError={handleFullImageError}
              />
            ) : null}

            {attachments.length > 1 && (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => move(-1)}
                  aria-label="الصورة السابقة"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full"
                  onClick={() => move(1)}
                  aria-label="الصورة التالية"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
