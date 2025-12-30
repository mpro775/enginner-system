export enum Role {
  ADMIN = "admin",
  CONSULTANT = "consultant",
  MAINTENANCE_MANAGER = "maintenance_manager",
  ENGINEER = "engineer",
  MAINTENANCE_SAFETY_MONITOR = "maintenance_safety_monitor",
}

export enum MaintenanceType {
  EMERGENCY = "emergency",
  PREVENTIVE = "preventive",
}

export enum RequestStatus {
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  STOPPED = "stopped",
}

export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  STATUS_CHANGE = "status_change",
}

export enum TaskStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  OVERDUE = "overdue",
  CANCELLED = "cancelled",
}

export enum RepetitionInterval {
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  SEMI_ANNUALLY = "semi_annually",
}

export enum TaskAssignmentStatus {
  UNASSIGNED = "unassigned",
  ASSIGNED = "assigned",
}

export enum ComplaintStatus {
  NEW = "new",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  CLOSED = "closed",
}
