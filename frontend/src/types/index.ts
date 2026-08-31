// Enums
export enum Role {
  ADMIN = "admin",
  CONSULTANT = "consultant",
  MAINTENANCE_MANAGER = "maintenance_manager",
  ENGINEER = "engineer",
  MAINTENANCE_SAFETY_MONITOR = "maintenance_safety_monitor",
  PROJECT_MANAGER = "project_manager",
}

export enum MaintenanceType {
  EMERGENCY = "emergency",
  PREVENTIVE = "preventive",
}

export enum RequestStatus {
  IN_PROGRESS = "in_progress",
  PENDING_CONSULTANT_APPROVAL = "pending_consultant_approval",
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

export type ComplaintSubmissionLanguage = "ar" | "en" | "both";

export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  STATUS_CHANGE = "status_change",
  SOFT_DELETE = "soft_delete",
  HARD_DELETE = "hard_delete",
  RESTORE = "restore",
}

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentIds?: Department[];
  isActive: boolean;
  lastLoginAt?: string;
  deletedAt?: string;
  deletedBy?: User;
  createdAt: string;
  updatedAt: string;
}

// Reference data types
export interface Location {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  deletedAt?: string;
  deletedBy?: User;
}

export interface Department {
  id: string;
  name: string;
  isActive: boolean;
  deletedAt?: string;
  deletedBy?: User;
}

export interface Floor {
  id: string;
  name: string;
  locationId: Location | string;
  isActive: boolean;
  deletedAt?: string;
  deletedBy?: User;
}

export interface System {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  deletedAt?: string;
  deletedBy?: User;
  departmentIds?: Department[];
}

export interface Machine {
  id: string;
  name: string;
  systemId: System | string;
  description?: string;
  components?: string[];
  isActive: boolean;
  deletedAt?: string;
  deletedBy?: User;
}

// Maintenance request types
export interface MaintenanceRequest {
  id: string;
  requestCode: string;
  engineerId: User;
  consultantId?: User;
  healthSafetySupervisorId?: User;
  projectManagerId?: User;
  maintenanceType: MaintenanceType;
  locationId: Location;
  floorId?: Floor;
  detailedLocation?: string;
  departmentId: Department;
  systemId: System;
  machineId: Machine;
  reasonText: string;
  machineNumber?: string;
  requestNeeds?: string;
  maintainAllComponents: boolean;
  selectedComponents?: string[];
  status: RequestStatus;
  engineerNotes?: string;
  consultantNotes?: string;
  requestNotes?: RequestNote[];
  healthSafetyNotes?: string;
  projectManagerNotes?: string;
  stopReason?: string;
  implementedWork?: string;
  openedAt: string;
  closedAt?: string;
  stoppedAt?: string;
  completionRequestedAt?: string;
  completionRequestedBy?: User | string;
  completionApprovedAt?: string;
  completionApprovedBy?: User | string;
  completionApprovedByName?: string;
  complaintId?: Complaint | string;
  deletedAt?: string;
  deletedBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface RequestNote {
  id?: string;
  body: string;
  authorId: User | string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
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
    departmentIds?: { id: string; name?: string }[];
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
  deletedAt?: string;
  deletedBy?: User;
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
  requestNeeds?: string;
  maintainAllComponents?: boolean;
  selectedComponents?: string[];
  scheduledTaskId?: string;
}

export interface UpdateRequestForm {
  maintenanceType?: MaintenanceType;
  locationId?: string;
  departmentId?: string;
  systemId?: string;
  machineId?: string;
  reasonText?: string;
  machineNumber?: string;
  engineerNotes?: string;
  requestNeeds?: string;
  implementedWork?: string;
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

export interface AddProjectManagerNoteForm {
  projectManagerNotes: string;
}

export interface CreateUserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentIds?: string[];
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
  submissionLanguage?: ComplaintSubmissionLanguage;
  reporterNameAr?: string;
  reporterNameEn?: string;
  locationAr?: string;
  locationEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  notesAr?: string;
  notesEn?: string;
  locationId?: Location;
  floorId?: Floor;
  detailedLocation?: string;
  departmentId?: Department;
  contactPhone?: string;
  reviewNotes?: ComplaintReviewNote[];
  departmentTransferHistory?: DepartmentTransfer[];
  status: ComplaintStatus;
  assignedEngineerId?: User;
  maintenanceRequestId?: MaintenanceRequest | string;
  resolvedAt?: string;
  closedAt?: string;
  deletedAt?: string;
  deletedBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface CreateComplaintForm {
  submissionLanguage: "ar" | "en";
  locationId: string;
  floorId: string;
  detailedLocation: string;
  departmentId: string;
  contactPhone?: string;
  reporterNameAr?: string;
  reporterNameEn?: string;
  locationAr?: string;
  locationEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  notesAr?: string;
  notesEn?: string;
}

export interface ComplaintReviewNote {
  id?: string;
  body: string;
  authorId: User | string;
  authorName: string;
  authorRole: Role;
  createdAt: string;
}

export interface DepartmentTransfer {
  id?: string;
  fromDepartmentId: Department | string;
  fromDepartmentName: string;
  toDepartmentId: Department | string;
  toDepartmentName: string;
  transferredBy: User | string;
  transferredByName: string;
  transferredByRole: Role;
  transferredAt: string;
  reason?: string;
}

export interface ComplaintReferenceData {
  locations: Array<Pick<Location, "id" | "name">>;
  departments: Array<Pick<Department, "id" | "name">>;
}

export interface CreateComplaintRequestForm {
  maintenanceType: MaintenanceType;
  engineerId?: string;
  systemId: string;
  machineId: string;
  maintainAllComponents?: boolean;
  selectedComponents?: string[];
  requestNeeds?: string;
}
