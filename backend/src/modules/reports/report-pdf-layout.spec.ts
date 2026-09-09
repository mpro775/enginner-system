import { RequestNoteType, RequestStatus, Role } from "../../common/enums";
import { buildRequestReportView } from "./request-report.contract";
import { generateSingleRequestReportContent } from "./reports.service";

describe("single request PDF timeline", () => {
  it("renders every entry in a large notes timeline with page-safe blocks", () => {
    const requestNotes = Array.from({ length: 45 }, (_, index) => ({
      body: `ملاحظة رقم ${index + 1}\n${"تفاصيل أعمال الصيانة والفحص. ".repeat(12)}`,
      authorId: "64b000000000000000000002",
      authorName: "Engineer",
      authorRole: Role.ENGINEER,
      type: RequestNoteType.ENGINEER,
      createdAt: new Date(Date.UTC(2026, 8, 9, 6, index)),
    }));
    const view = buildRequestReportView({
      _id: "64b000000000000000000001",
      requestCode: "EM-202609-0001",
      status: RequestStatus.PENDING_CONSULTANT_APPROVAL,
      maintenanceType: "emergency",
      engineerId: {
        _id: "64b000000000000000000002",
        name: "Engineer",
        role: Role.ENGINEER,
      },
      locationId: { name: "Location" },
      departmentId: { name: "Department" },
      systemId: { name: "System" },
      machineId: { name: "Machine" },
      reasonText: "Reason",
      openedAt: "2026-09-09T06:00:00Z",
      requestNotes,
    });
    const html = generateSingleRequestReportContent(view);
    const timelineEntries = html.match(/class="timeline-entry"/g) ?? [];

    expect(timelineEntries).toHaveLength(45);
    expect(html).toContain("ملاحظة رقم 1");
    expect(html).toContain("ملاحظة رقم 45");
    expect(html).toContain('class="timeline-body"');
  });
});
