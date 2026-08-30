import type { Complaint, ComplaintSubmissionLanguage } from "@/types";

export function getComplaintLanguagePresence(complaint: Complaint) {
  return {
    hasArabic: Boolean(
      complaint.reporterNameAr ||
        complaint.locationAr ||
        complaint.descriptionAr ||
        complaint.notesAr
    ),
    hasEnglish: Boolean(
      complaint.reporterNameEn ||
        complaint.locationEn ||
        complaint.descriptionEn ||
        complaint.notesEn
    ),
  };
}

export function getComplaintLanguage(
  complaint: Complaint
): ComplaintSubmissionLanguage {
  if (complaint.submissionLanguage) {
    return complaint.submissionLanguage;
  }

  const { hasArabic, hasEnglish } = getComplaintLanguagePresence(complaint);

  if (hasArabic && hasEnglish) return "both";
  if (hasEnglish) return "en";
  return "ar";
}

export function getComplaintDisplayValues(complaint: Complaint) {
  return {
    reporterName:
      complaint.reporterNameAr || complaint.reporterNameEn || "—",
    location: complaint.locationAr || complaint.locationEn || "—",
    description:
      complaint.descriptionAr || complaint.descriptionEn || "—",
  };
}
