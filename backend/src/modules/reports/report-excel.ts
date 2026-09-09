import * as ExcelJS from "exceljs";
import { RequestReportView } from "./request-report.contract";

function styleSheet(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  header.alignment = { horizontal: "center", vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (sheet.rowCount > 1 && sheet.columnCount > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: sheet.columnCount },
    };
  }
}

export function buildReportsWorkbook(
  data: RequestReportView[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Maintenance System";
  workbook.created = new Date();

  const requestsSheet = workbook.addWorksheet("Requests");
  requestsSheet.columns = [
    { header: "Request Code", key: "requestCode", width: 18 },
    { header: "Engineer", key: "engineer", width: 22 },
    { header: "Assigned Consultant", key: "consultant", width: 22 },
    { header: "Approval Status", key: "approvalStatus", width: 18 },
    { header: "Approved By", key: "approvedBy", width: 22 },
    { header: "Approved At", key: "approvedAt", width: 22 },
    { header: "Maintenance Type", key: "maintenanceType", width: 18 },
    { header: "Status", key: "status", width: 20 },
    { header: "Location", key: "location", width: 22 },
    { header: "Department", key: "department", width: 22 },
    { header: "System", key: "system", width: 20 },
    { header: "Machine", key: "machine", width: 20 },
    { header: "Machine No.", key: "machineNumber", width: 16 },
    { header: "Reason", key: "reason", width: 35 },
    { header: "Request Needs", key: "requestNeeds", width: 30 },
    { header: "Implemented Work", key: "implementedWork", width: 30 },
    { header: "Completion Requested At", key: "requestedAt", width: 24 },
    { header: "Completion Requested By", key: "requestedBy", width: 24 },
    { header: "Notes Count", key: "notesCount", width: 14 },
    { header: "Opened At", key: "openedAt", width: 22 },
    { header: "Closed At", key: "closedAt", width: 22 },
  ];

  data.forEach((view) => {
    requestsSheet.addRow({
      requestCode: view.request.requestCode,
      engineer: view.people.engineer?.name ?? "-",
      consultant: view.people.assignedConsultant?.name ?? "-",
      approvalStatus: view.completion.status,
      approvedBy: view.completion.approvedBy?.name ?? "-",
      approvedAt: view.completion.approvedAt,
      maintenanceType: view.request.maintenanceType,
      status: view.request.status,
      location: view.request.locationName ?? "-",
      department: view.request.departmentName ?? "-",
      system: view.request.systemName ?? "-",
      machine: view.request.machineName ?? "-",
      machineNumber: view.request.machineNumber ?? "-",
      reason: view.request.reasonText,
      requestNeeds: view.request.requestNeeds ?? "-",
      implementedWork: view.request.implementedWork ?? "-",
      requestedAt: view.completion.requestedAt,
      requestedBy: view.completion.requestedBy?.name ?? "-",
      notesCount: view.notes.length,
      openedAt: view.request.openedAt,
      closedAt: view.request.closedAt,
    });
  });
  ["F", "Q", "T", "U"].forEach((column) => {
    requestsSheet.getColumn(column).numFmt = "yyyy-mm-dd hh:mm";
  });
  styleSheet(requestsSheet);

  const notesSheet = workbook.addWorksheet("Notes Timeline");
  notesSheet.columns = [
    { header: "Request Code", key: "requestCode", width: 18 },
    { header: "Note Type", key: "type", width: 22 },
    { header: "Author", key: "author", width: 24 },
    { header: "Role", key: "role", width: 24 },
    { header: "Note", key: "note", width: 60 },
    { header: "Created At", key: "createdAt", width: 24 },
  ];
  data.forEach((view) => {
    view.notes.forEach((note) => {
      notesSheet.addRow({
        requestCode: view.request.requestCode,
        type: note.type,
        author: note.author.name ?? "غير متوفر",
        role: note.author.role ?? "غير متوفر",
        note: note.body,
        createdAt: note.createdAt,
      });
    });
  });
  notesSheet.getColumn("F").numFmt = "yyyy-mm-dd hh:mm";
  notesSheet.getColumn("E").alignment = {
    wrapText: true,
    vertical: "top",
  };
  styleSheet(notesSheet);

  return workbook;
}
