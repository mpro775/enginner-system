export enum Role {
  ADMIN = "admin",
  CONSULTANT = "consultant",
  MAINTENANCE_MANAGER = "maintenance_manager",
  ENGINEER = "engineer",
  HEALTH_SAFETY_SUPERVISOR = "health_safety_supervisor",
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
