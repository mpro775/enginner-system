import { RequestNoteType, RequestStatus, Role } from "../../common/enums";
import { buildRequestReportView } from "./request-report.contract";

describe("request report contract", () => {
  const engineer = {
    _id: "64b000000000000000000001",
    name: "Engineer",
    role: Role.ENGINEER,
  };
  const consultant = {
    _id: "64b000000000000000000002",
    name: "Consultant",
    role: Role.CONSULTANT,
  };

  it("normalizes structured notes into an oldest-first timeline", () => {
    const view = buildRequestReportView({
      _id: "64b000000000000000000003",
      requestCode: "EM-202609-0001",
      status: RequestStatus.IN_PROGRESS,
      maintenanceType: "emergency",
      engineerId: engineer,
      consultantId: consultant,
      requestNotes: [
        {
          body: "Consultant note",
          authorId: consultant._id,
          authorName: consultant.name,
          authorRole: consultant.role,
          type: RequestNoteType.CONSULTANT,
          createdAt: new Date("2026-09-09T08:00:00Z"),
        },
        {
          body: "Engineer note",
          authorId: engineer._id,
          authorName: engineer.name,
          authorRole: engineer.role,
          type: RequestNoteType.ENGINEER,
          createdAt: new Date("2026-09-09T07:00:00Z"),
        },
      ],
    });

    expect(view.notes.map((note) => note.body)).toEqual([
      "Engineer note",
      "Consultant note",
    ]);
    expect(view.notes[0]).toMatchObject({
      type: RequestNoteType.ENGINEER,
      author: { name: "Engineer", role: Role.ENGINEER },
    });
  });

  it("uses the real completion approver even when no consultant is assigned", () => {
    const view = buildRequestReportView({
      requestCode: "EM-202609-0002",
      status: RequestStatus.COMPLETED,
      maintenanceType: "emergency",
      engineerId: engineer,
      completionRequestedBy: engineer,
      completionRequestedAt: "2026-09-09T07:00:00Z",
      completionApprovedBy: consultant,
      completionApprovedByName: "Stale snapshot",
      completionApprovedAt: "2026-09-09T08:00:00Z",
    });

    expect(view.people.assignedConsultant).toBeNull();
    expect(view.completion).toMatchObject({
      status: "approved",
      requestedBy: { name: "Engineer", role: Role.ENGINEER },
      approvedBy: { name: "Consultant", role: Role.CONSULTANT },
    });
  });

  it("includes legacy notes without invented timestamps and deduplicates mirrored notes", () => {
    const view = buildRequestReportView({
      requestCode: "PM-202609-0001",
      status: RequestStatus.IN_PROGRESS,
      maintenanceType: "preventive",
      engineerId: engineer,
      healthSafetySupervisorId: {
        _id: "64b000000000000000000004",
        name: "Safety",
        role: Role.MAINTENANCE_SAFETY_MONITOR,
      },
      engineerNotes: "Legacy engineer note",
      healthSafetyNotes: "Mirrored safety note (Safety)",
      requestNotes: [
        {
          body: "Mirrored safety note",
          authorId: "64b000000000000000000004",
          authorName: "Safety",
          authorRole: Role.MAINTENANCE_SAFETY_MONITOR,
          type: RequestNoteType.HEALTH_SAFETY,
          createdAt: "2026-09-09T09:00:00Z",
        },
      ],
    });

    expect(view.notes).toHaveLength(2);
    expect(view.notes[0].body).toBe("Mirrored safety note");
    expect(view.notes[1]).toMatchObject({
      body: "Legacy engineer note",
      type: RequestNoteType.ENGINEER,
      createdAt: null,
    });
  });

  it("recognizes legacy prefixed rejection notes as typed rejection events", () => {
    const view = buildRequestReportView({
      requestCode: "EM-202609-0003",
      status: RequestStatus.IN_PROGRESS,
      maintenanceType: "emergency",
      engineerId: engineer,
      requestNotes: [
        {
          body: "إعادة الإكمال للمهندس: يلزم إعادة الفحص",
          authorId: consultant._id,
          authorName: consultant.name,
          authorRole: consultant.role,
          createdAt: "2026-09-09T09:00:00Z",
        },
      ],
    });

    expect(view.notes[0]).toMatchObject({
      body: "يلزم إعادة الفحص",
      type: RequestNoteType.COMPLETION_REJECTION,
    });
  });
});
