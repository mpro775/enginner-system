// Enums
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

export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  STATUS_CHANGE = "status_change",
}

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: Department;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Reference data types
export interface Location {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

export interface System {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Machine {
  id: string;
  name: string;
  systemId: System | string;
  description?: string;
  components?: string[];
  isActive: boolean;
}

// Maintenance request types
export interface MaintenanceRequest {
  id: string;
  requestCode: string;
  engineerId: User;
  consultantId?: User;
  healthSafetySupervisorId?: User;
  maintenanceType: MaintenanceType;
  locationId: Location;
  departmentId: Department;
  systemId: System;
  machineId: Machine;
  reasonText: string;
  machineNumber?: string;
  maintainAllComponents: boolean;
  selectedComponents?: string[];
  status: RequestStatus;
  engineerNotes?: string;
  consultantNotes?: string;
  healthSafetyNotes?: string;
  stopReason?: string;
  openedAt: string;
  closedAt?: string;
  stoppedAt?: string;
  complaintId?: Complaint | string;
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

// Statistics types
export interface DashboardStatistics {
  totalRequests: number;
  inProgress: number;
  completed: number;
  stopped: number;
  emergencyRequests: number;
  preventiveRequests: number;
  todayRequests: number;
  thisWeekRequests: number;
  thisMonthRequests: number;
  avgCompletionTimeHours: number;
}

export interface EngineerStatistics {
  engineerId: string;
  engineerName: string;
  totalRequests: number;
  byStatus: {
    inProgress: number;
    completed: number;
    stopped: number;
  };
  byType: {
    emergency: number;
    preventive: number;
  };
  avgCompletionTimeHours: number;
}

// Scheduled Task types
export interface ScheduledTask {
  id: string;
  taskCode: string;
  title: string;
  engineerId?: User;
  locationId: Location;
  departmentId: Department;
  systemId: System;
  machineId: Machine;
  maintainAllComponents: boolean;
  selectedComponents?: string[];
  scheduledMonth: number;
  scheduledYear: number;
  scheduledDay?: number;
  description?: string;
  status: TaskStatus;
  completedRequestId?: MaintenanceRequest;
  completedAt?: string;
  createdBy: User;
  daysRemaining?: number;
  repetitionInterval?: RepetitionInterval;
  lastGeneratedAt?: string;
  parentTaskId?: ScheduledTask | string;
  createdAt: string;
  updatedAt: string;
}

// Form types
export interface CreateRequestForm {
  maintenanceType: MaintenanceType;
  locationId: string;
  departmentId: string;
  systemId: string;
  machineId: string;
  reasonText: string;
  machineNumber?: string;
  engineerNotes?: string;
  maintainAllComponents?: boolean;
  selectedComponents?: string[];
  scheduledTaskId?: string;
}

export interface StopRequestForm {
  stopReason: string;
}

export interface AddNoteForm {
  consultantNotes: string;
}

export interface AddHealthSafetyNoteForm {
  healthSafetyNotes: string;
}

export interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string;
}

// Notification types
export interface Notification {
  type: string;
  data: Record<string, unknown>;
  message: string;
  timestamp: string;
}

// Audit Log types
export interface AuditLog {
  id: string;
  userId: string | User;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  changes?: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

// Complaint types
export interface Complaint {
  id: string;
  complaintCode: string;
  reporterName: string;
  department: string;
  machine: string;
  machineNumber?: string;
  location: string;
  description: string;
  notes?: string;
  status: ComplaintStatus;
  assignedEngineerId?: User;
  maintenanceRequestId?: MaintenanceRequest | string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplaintForm {
  reporterName: string;
  department: string;
  machine: string;
  machineNumber?: string;
  location: string;
  description: string;
  notes?: string;
}
