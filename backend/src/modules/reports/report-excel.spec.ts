import { RequestNoteType, RequestStatus, Role } from "../../common/enums";
import { buildReportsWorkbook } from "./report-excel";
import { buildRequestReportView } from "./request-report.contract";

describe("reports Excel workbook", () => {
  it("creates Requests and Notes Timeline with one row per note", () => {
    const view = buildRequestReportView({
      _id: "64b000000000000000000001",
      requestCode: "EM-202609-0001",
      status: RequestStatus.COMPLETED,
      maintenanceType: "emergency",
      engineerId: {
        _id: "64b000000000000000000002",
        name: "Engineer",
        role: Role.ENGINEER,
      },
      completionApprovedBy: {
        _id: "64b000000000000000000003",
        name: "Consultant",
        role: Role.CONSULTANT,
      },
      completionApprovedAt: "2026-09-09T10:00:00Z",
      requestNotes: [
        {
          body: "First",
          authorId: "64b000000000000000000002",
          authorName: "Engineer",
          authorRole: Role.ENGINEER,
          type: RequestNoteType.ENGINEER,
          createdAt: "2026-09-09T08:00:00Z",
        },
        {
          body: "Second",
          authorId: "64b000000000000000000003",
          authorName: "Consultant",
          authorRole: Role.CONSULTANT,
          type: RequestNoteType.CONSULTANT,
          createdAt: "2026-09-09T09:00:00Z",
        },
      ],
    });

    const workbook = buildReportsWorkbook([view]);
    const requests = workbook.getWorksheet("Requests");
    const notes = workbook.getWorksheet("Notes Timeline");

    expect(requests?.rowCount).toBe(2);
    expect(requests?.getRow(2).getCell("A").value).toBe("EM-202609-0001");
    expect(requests?.getRow(2).getCell("E").value).toBe("Consultant");
    expect(notes?.rowCount).toBe(3);
    expect(notes?.getRow(2).getCell("E").value).toBe("First");
    expect(notes?.getRow(3).getCell("E").value).toBe("Second");
  });
});
