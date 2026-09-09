import { RequestNoteType, RequestStatus, Role } from "../../common/enums";

export interface ReportPerson {
  id: string | null;
  name: string | null;
  role: string | null;
}

export type ReportApprovalStatus = "approved" | "pending" | "not_requested";

export interface ReportApproval {
  status: ReportApprovalStatus;
  requestedAt: Date | null;
  requestedBy: ReportPerson | null;
  approvedAt: Date | null;
  approvedBy: ReportPerson | null;
}

export interface ReportNote {
  type: RequestNoteType;
  body: string;
  author: ReportPerson;
  createdAt: Date | null;
}

export interface RequestReportView {
  request: {
    id: string;
    requestCode: string;
    maintenanceType: string;
    status: string;
    locationName: string | null;
    floorName: string | null;
    detailedLocation: string | null;
    departmentName: string | null;
    systemName: string | null;
    machineName: string | null;
    machineNumber: string | null;
    reasonText: string;
    requestNeeds: string | null;
    implementedWork: string | null;
    stopReason: string | null;
    openedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date | null;
  };
  people: {
    engineer: ReportPerson | null;
    assignedConsultant: ReportPerson | null;
    healthSafetySupervisor: ReportPerson | null;
    projectManager: ReportPerson | null;
  };
  completion: ReportApproval;
  notes: ReportNote[];
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as UnknownRecord;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function idValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const record = asRecord(value);
  const candidate = record?._id ?? record?.id ?? value;
  if (candidate === null || candidate === undefined) return null;
  const result = String(candidate);
  return result === "[object Object]" ? null : result;
}

function dateValue(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function personFromReference(
  value: unknown,
  defaultRole: string | null = null,
  fallbackName: string | null = null,
): ReportPerson | null {
  const record = asRecord(value);
  const id = idValue(value);
  const name = stringValue(record?.name) ?? fallbackName;
  const role = stringValue(record?.role) ?? defaultRole;
  return id || name ? { id, name, role } : null;
}

function sameId(
  left: ReportPerson | null,
  right: ReportPerson | null,
): boolean {
  return Boolean(left?.id && right?.id && left.id === right.id);
}

function roleNoteType(role: string | null): RequestNoteType {
  if (role === Role.ENGINEER) return RequestNoteType.ENGINEER;
  if (role === Role.CONSULTANT) return RequestNoteType.CONSULTANT;
  if (role === Role.MAINTENANCE_SAFETY_MONITOR) {
    return RequestNoteType.HEALTH_SAFETY;
  }
  if (role === Role.PROJECT_MANAGER) return RequestNoteType.PROJECT_MANAGER;
  return RequestNoteType.GENERAL;
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, " ").trim().toLocaleLowerCase("ar");
}

function stripLegacyAuthorSuffix(
  body: string,
  authorName: string | null,
): string {
  if (!authorName) return body.trim();
  const escapedName = authorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body.replace(new RegExp(`\\s*\\(${escapedName}\\)\\s*$`), "").trim();
}

function normalizeNotes(
  request: UnknownRecord,
  people: RequestReportView["people"],
): ReportNote[] {
  const structured = Array.isArray(request.requestNotes)
    ? request.requestNotes
        .map((raw): ReportNote | null => {
          const note = asRecord(raw);
          const originalBody = stringValue(note?.body);
          if (!note || !originalBody) return null;

          const authorRole = stringValue(note.authorRole);
          const legacyRejection = originalBody.startsWith(
            "إعادة الإكمال للمهندس:",
          );
          const body = legacyRejection
            ? originalBody.replace(/^إعادة الإكمال للمهندس:\s*/, "").trim()
            : originalBody;
          const storedType = stringValue(note.type) as RequestNoteType | null;
          const type = legacyRejection
            ? RequestNoteType.COMPLETION_REJECTION
            : !storedType || storedType === RequestNoteType.GENERAL
              ? roleNoteType(authorRole)
              : storedType;

          return {
            type,
            body,
            author: {
              id: idValue(note.authorId),
              name: stringValue(note.authorName),
              role: authorRole,
            },
            createdAt: dateValue(note.createdAt),
          };
        })
        .filter((note): note is ReportNote => note !== null)
    : [];

  const legacyFields: Array<{
    field: string;
    type: RequestNoteType;
    person: ReportPerson | null;
    role: Role;
  }> = [
    {
      field: "engineerNotes",
      type: RequestNoteType.ENGINEER,
      person: people.engineer,
      role: Role.ENGINEER,
    },
    {
      field: "consultantNotes",
      type: RequestNoteType.CONSULTANT,
      person: people.assignedConsultant,
      role: Role.CONSULTANT,
    },
    {
      field: "healthSafetyNotes",
      type: RequestNoteType.HEALTH_SAFETY,
      person: people.healthSafetySupervisor,
      role: Role.MAINTENANCE_SAFETY_MONITOR,
    },
    {
      field: "projectManagerNotes",
      type: RequestNoteType.PROJECT_MANAGER,
      person: people.projectManager,
      role: Role.PROJECT_MANAGER,
    },
  ];

  const legacy: ReportNote[] = [];
  for (const item of legacyFields) {
    const rawBody = stringValue(request[item.field]);
    if (!rawBody) continue;
    const body = stripLegacyAuthorSuffix(rawBody, item.person?.name ?? null);
    const duplicate = structured.some(
      (note) =>
        note.type === item.type &&
        normalizeBody(note.body) === normalizeBody(body),
    );
    if (duplicate) continue;
    legacy.push({
      type: item.type,
      body,
      author: item.person ?? { id: null, name: null, role: item.role },
      createdAt: null,
    });
  }

  return [...structured, ...legacy]
    .map((note, index) => ({ note, index }))
    .sort((left, right) => {
      const leftTime = left.note.createdAt?.getTime();
      const rightTime = right.note.createdAt?.getTime();
      if (leftTime === undefined && rightTime === undefined) {
        return left.index - right.index;
      }
      if (leftTime === undefined) return 1;
      if (rightTime === undefined) return -1;
      return leftTime - rightTime || left.index - right.index;
    })
    .map(({ note }) => note);
}

export function buildRequestReportView(source: unknown): RequestReportView {
  const document = asRecord(source) ?? {};
  const request =
    typeof document.toObject === "function"
      ? (asRecord((document.toObject as () => unknown)()) ?? document)
      : document;

  const engineer = personFromReference(request.engineerId, Role.ENGINEER);
  const assignedConsultant = personFromReference(
    request.consultantId,
    Role.CONSULTANT,
  );
  const healthSafetySupervisor = personFromReference(
    request.healthSafetySupervisorId,
    Role.MAINTENANCE_SAFETY_MONITOR,
  );
  const projectManager = personFromReference(
    request.projectManagerId,
    Role.PROJECT_MANAGER,
  );
  const people = {
    engineer,
    assignedConsultant,
    healthSafetySupervisor,
    projectManager,
  };

  let requestedBy = personFromReference(request.completionRequestedBy);
  if (requestedBy && sameId(requestedBy, engineer)) requestedBy = engineer;
  const approvedBy = personFromReference(
    request.completionApprovedBy,
    null,
    stringValue(request.completionApprovedByName),
  );
  const status = String(request.status ?? "");

  return {
    request: {
      id: idValue(request._id ?? request.id) ?? "",
      requestCode: stringValue(request.requestCode) ?? "",
      maintenanceType: String(request.maintenanceType ?? ""),
      status,
      locationName: stringValue(asRecord(request.locationId)?.name),
      floorName: stringValue(asRecord(request.floorId)?.name),
      detailedLocation: stringValue(request.detailedLocation),
      departmentName: stringValue(asRecord(request.departmentId)?.name),
      systemName: stringValue(asRecord(request.systemId)?.name),
      machineName: stringValue(asRecord(request.machineId)?.name),
      machineNumber: stringValue(request.machineNumber),
      reasonText: stringValue(request.reasonText) ?? "",
      requestNeeds: stringValue(request.requestNeeds),
      implementedWork: stringValue(request.implementedWork),
      stopReason: stringValue(request.stopReason),
      openedAt: dateValue(request.openedAt),
      closedAt: dateValue(request.closedAt),
      createdAt: dateValue(request.createdAt),
    },
    people,
    completion: {
      status:
        status === RequestStatus.COMPLETED
          ? "approved"
          : status === RequestStatus.PENDING_CONSULTANT_APPROVAL
            ? "pending"
            : "not_requested",
      requestedAt: dateValue(request.completionRequestedAt),
      requestedBy,
      approvedAt: dateValue(request.completionApprovedAt),
      approvedBy,
    },
    notes: normalizeNotes(request, people),
  };
}
