import "reflect-metadata";
import { validate } from "class-validator";
import { ComplaintSubmissionLanguage } from "../../common/enums";
import { normalizeComplaintPayload } from "./complaints.service";
import { CreateComplaintDto } from "./dto";
import { normalizeSaudiMobile } from "./dto/create-complaint.dto";

const validatePayload = (payload: Partial<CreateComplaintDto>) => {
  const dto = Object.assign(new CreateComplaintDto(), payload);
  return validate(dto);
};

const structuredLocation = {
  locationId: "64b000000000000000000001",
  floorId: "64b000000000000000000002",
  detailedLocation: "مكتب 205",
  departmentId: "64b000000000000000000003",
};

describe("complaint submission language contract", () => {
  it("accepts an Arabic-only complaint", async () => {
    const errors = await validatePayload({
      ...structuredLocation,
      submissionLanguage: ComplaintSubmissionLanguage.AR,
      reporterNameAr: "محمد أحمد",
      locationAr: "كلية الهندسة - مكتب 205",
      descriptionAr: "يوجد تسرب مياه واضح داخل المكتب",
    });

    expect(errors).toHaveLength(0);
  });

  it("accepts an English-only complaint", async () => {
    const errors = await validatePayload({
      ...structuredLocation,
      submissionLanguage: ComplaintSubmissionLanguage.EN,
      reporterNameEn: "Mohammed Ahmed",
      locationEn: "Engineering College - Office 205",
      descriptionEn: "There is a visible water leak inside the office",
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    {
      submissionLanguage: ComplaintSubmissionLanguage.AR,
      reporterNameAr: "محمد أحمد",
      descriptionAr: "يوجد تسرب مياه واضح داخل المكتب",
    },
    {
      submissionLanguage: ComplaintSubmissionLanguage.EN,
      reporterNameEn: "Mohammed Ahmed",
      descriptionEn: "There is a visible water leak inside the office",
    },
  ])("rejects a selected language with a missing location", async (payload) => {
    const errors = await validatePayload(payload);

    expect(errors.some((error) => error.property.startsWith("location"))).toBe(
      true
    );
  });

  it("accepts the legacy bilingual payload", async () => {
    const errors = await validatePayload({
      ...structuredLocation,
      reporterNameAr: "محمد أحمد",
      reporterNameEn: "Mohammed Ahmed",
      locationAr: "كلية الهندسة",
      locationEn: "Engineering College",
      descriptionAr: "يوجد تسرب مياه واضح داخل المكتب",
      descriptionEn: "There is a visible water leak inside the office",
    });

    expect(errors).toHaveLength(0);
  });

  it("rejects a legacy payload containing only one language", async () => {
    const errors = await validatePayload({
      ...structuredLocation,
      reporterNameAr: "محمد أحمد",
      locationAr: "كلية الهندسة",
      descriptionAr: "يوجد تسرب مياه واضح داخل المكتب",
    });

    expect(errors.some((error) => error.property === "reporterNameEn")).toBe(
      true
    );
  });

  it("drops inactive-language fields and trims the selected language", () => {
    const normalized = normalizeComplaintPayload({
      submissionLanguage: ComplaintSubmissionLanguage.AR,
      reporterNameAr: "  محمد  ",
      locationAr: "  المبنى أ  ",
      descriptionAr: "  يوجد عطل في نظام التكييف  ",
      notesAr: "  تفاصيل إضافية  ",
      reporterNameEn: "Fake English",
    });

    expect(normalized).toEqual({
      submissionLanguage: ComplaintSubmissionLanguage.AR,
      reporterNameAr: "محمد",
      locationAr: "المبنى أ",
      descriptionAr: "يوجد عطل في نظام التكييف",
      notesAr: "تفاصيل إضافية",
    });
  });

  it("marks new legacy submissions as bilingual", () => {
    const normalized = normalizeComplaintPayload({
      reporterNameAr: "محمد",
      reporterNameEn: "Mohammed",
      locationAr: "المبنى أ",
      locationEn: "Building A",
      descriptionAr: "وصف عربي واضح للبلاغ",
      descriptionEn: "A clear English complaint description",
    });

    expect(normalized.submissionLanguage).toBe(
      ComplaintSubmissionLanguage.BOTH
    );
  });

  it.each([
    ["0551234567", "+966551234567"],
    ["551234567", "+966551234567"],
    ["966551234567", "+966551234567"],
    ["+966 55-123-4567", "+966551234567"],
  ])("normalizes supported Saudi mobile format %s", (input, expected) => {
    expect(normalizeSaudiMobile(input)).toBe(expected);
  });
});
