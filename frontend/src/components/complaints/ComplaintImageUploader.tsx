import { ChangeEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPLAINT_IMAGE_TYPES,
  compressComplaintImage,
} from "@/lib/compress-complaint-image";

export interface ComplaintImageSelection {
  id: string;
  fingerprint: string;
  file: File;
  previewUrl: string;
}

interface Props {
  value: ComplaintImageSelection[];
  onChange: (images: ComplaintImageSelection[]) => void;
  onProcessingChange?: (processing: boolean) => void;
  isArabic: boolean;
  disabled?: boolean;
}

const MAX_IMAGES = 3;

export function ComplaintImageUploader({
  value,
  onChange,
  onProcessingChange,
  isArabic,
  disabled,
}: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const currentValueRef = useRef(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    currentValueRef.current = value;
    const currentUrls = new Set(value.map((image) => image.previewUrl));
    previousValueRef.current.forEach((image) => {
      if (!currentUrls.has(image.previewUrl)) URL.revokeObjectURL(image.previewUrl);
    });
    previousValueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      currentValueRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  const setProcessing = (processing: boolean) => {
    setIsProcessing(processing);
    onProcessingChange?.(processing);
  };

  const selectImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;
    if (value.length + selected.length > MAX_IMAGES) {
      setError(
        isArabic
          ? "يمكن إرفاق 3 صور كحد أقصى."
          : "You can attach at most 3 images.",
      );
      return;
    }

    const known = new Set(value.map((image) => image.fingerprint));
    const additions: ComplaintImageSelection[] = [];
    setError("");
    setProcessing(true);
    try {
      for (const original of selected) {
        const fingerprint = `${original.name}:${original.size}:${original.lastModified}`;
        if (known.has(fingerprint)) continue;
        const compressed = await compressComplaintImage(original);
        additions.push({
          id: crypto.randomUUID(),
          fingerprint,
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        });
        known.add(fingerprint);
      }
      if (additions.length) onChange([...value, ...additions]);
      if (!additions.length) {
        setError(isArabic ? "تم تجاهل الصور المكررة." : "Duplicate images were ignored.");
      }
    } catch (selectionError) {
      additions.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      const reason = selectionError instanceof Error ? selectionError.message : "";
      if (reason === "file-too-large") {
        setError(
          isArabic
            ? "يجب ألا يتجاوز حجم الصورة الأصلية 8 ميجابايت."
            : "The original image must be 8 MB or smaller.",
        );
      } else if (reason === "unsupported-type" || reason === "empty-file") {
        setError(
          isArabic
            ? "اختر صورة JPEG أو PNG أو WebP صالحة."
            : "Choose a valid JPEG, PNG, or WebP image.",
        );
      } else {
        setError(
          isArabic
            ? "تعذر تجهيز إحدى الصور. احذفها واختر صورة أخرى."
            : "An image could not be prepared. Remove it and choose another image.",
        );
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-primary">
            {isArabic ? "صور المشكلة (اختياري)" : "Issue photos (optional)"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {isArabic
              ? "يمكنك إرفاق حتى 3 صور تساعد فريق الصيانة في تشخيص المشكلة."
              : "You can attach up to 3 photos to help the maintenance team diagnose the issue."}
          </p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">{value.length} / 3</span>
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((image, index) => (
            <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-background">
              <img
                src={image.previewUrl}
                alt={isArabic ? `معاينة الصورة ${index + 1}` : `Image ${index + 1} preview`}
                className="h-full w-full object-cover"
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute end-2 top-2 h-8 w-8 shadow"
                aria-label={isArabic ? "حذف الصورة" : "Remove image"}
                disabled={disabled || isProcessing}
                onClick={() => onChange(value.filter((item) => item.id !== image.id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={COMPLAINT_IMAGE_TYPES.join(",")}
        multiple
        className="sr-only"
        onChange={selectImages}
        disabled={disabled || isProcessing || value.length >= MAX_IMAGES}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled || isProcessing || value.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
      >
        {isProcessing ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="me-2 h-4 w-4" />
        )}
        {isProcessing
          ? isArabic
            ? "جارٍ تجهيز الصور..."
            : "Preparing images..."
          : isArabic
            ? "اختيار صور"
            : "Choose images"}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
