import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Role } from "../../common/enums";
import { ComplaintDocument } from "../complaints/schemas/complaint.schema";
import { MaintenanceRequestDocument } from "../maintenance-requests/schemas/maintenance-request.schema";
import { ScheduledTaskDocument } from "../scheduled-tasks/schemas/scheduled-task.schema";
import {
  CreateNotificationsInput,
  NotificationsService,
} from "./notifications.service";

interface BulkExportProgressPayload {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  mode: "selected" | "filtered";
  totalRequests: number;
  processedRequests: number;
  totalParts: number;
  processedParts: number;
  chunkSize: number;
  progressPercent: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
  downloadReady: boolean;
}

interface AuthenticatedSocket extends Socket {
  user?: { userId: string; role: string; name: string };
}

@WebSocketGateway({
  cors: { origin: "*", credentials: true },
  namespace: "/notifications",
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(" ")[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });
      client.user = {
        userId: payload.sub,
        role: payload.role,
        name: payload.name,
      };
      await client.join(`user:${payload.sub}`);
      this.logger.log(
        `Client ${client.id} connected - User: ${payload.name} (${payload.role})`,
      );
    } catch (error) {
      this.logger.error(`Connection error: ${(error as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("ping")
  handlePing(): string {
    return "pong";
  }

  async resolveRecipientUserIds(
    departmentId: string,
    roles: Role[],
  ): Promise<string[]> {
    try {
      return await this.notificationsService.resolveRecipientUserIds(
        departmentId,
        roles,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resolve notification recipients for department ${departmentId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return [];
    }
  }

  async notifyUsers(input: CreateNotificationsInput): Promise<void> {
    try {
      const created =
        await this.notificationsService.createForRecipients(input);
      for (const item of created) {
        this.server
          .to(`user:${item.recipientUserId}`)
          .emit("notification", item.notification);
      }
    } catch (error) {
      this.logger.error(
        `Failed to persist or deliver notification ${input.eventKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  async notifyRequestCreated(
    request: MaintenanceRequestDocument,
    userIds: string[] = [],
  ) {
    const id = request._id.toString();
    const createdAt = (request as any).createdAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:created",
      entityType: "request",
      entityId: id,
      eventKey: `request:created:${id}`,
      createdAt,
      data: {
        id,
        requestCode: request.requestCode,
        maintenanceType: request.maintenanceType,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
        locationName: (request.locationId as any)?.name,
        createdAt,
      },
      message: `New maintenance request ${request.requestCode} created`,
    });
  }

  async notifyRequestStopped(
    request: MaintenanceRequestDocument,
    userIds: string[] = [],
  ) {
    const id = request._id.toString();
    const occurredAt = request.stoppedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:stopped",
      entityType: "request",
      entityId: id,
      eventKey: `request:stopped:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        requestCode: request.requestCode,
        status: request.status,
        stopReason: request.stopReason,
        engineerName: (request.engineerId as any)?.name,
        stoppedAt: request.stoppedAt,
      },
      message: `Request ${request.requestCode} has been stopped`,
    });
  }

  async notifyRequestCompleted(
    request: MaintenanceRequestDocument,
    userIds: string[] = [],
  ) {
    const id = request._id.toString();
    const occurredAt = request.closedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:completed",
      entityType: "request",
      entityId: id,
      eventKey: `request:completed:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        requestCode: request.requestCode,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
        closedAt: request.closedAt,
      },
      message: `Request ${request.requestCode} has been completed`,
    });
  }

  async notifyRequestUpdated(
    request: MaintenanceRequestDocument,
    userIds: string[] = [],
  ) {
    const id = request._id.toString();
    const occurredAt = (request as any).updatedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:updated",
      entityType: "request",
      entityId: id,
      eventKey: `request:updated:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        requestCode: request.requestCode,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
      },
      message: `Request ${request.requestCode} has been updated`,
    });
  }

  async notifyPendingTasks(
    engineerId: string,
    counts: { overdue: number; pending: number; total: number },
  ) {
    const day = new Date().toISOString().slice(0, 10);
    const type = counts.overdue > 0 ? "task:overdue" : "task:pending";
    await this.notifyUsers({
      recipientUserIds: [engineerId],
      type,
      entityType: "task",
      eventKey: `${type}:${engineerId}:${day}:${counts.overdue}:${counts.pending}`,
      data: {
        engineerId,
        overdueCount: counts.overdue,
        pendingCount: counts.pending,
        totalCount: counts.total,
      },
      message:
        counts.overdue > 0
          ? `لديك ${counts.overdue} صيانة وقائية متأخرة و ${counts.pending} صيانة معلقة`
          : `لديك ${counts.pending} صيانة وقائية معلقة`,
    });
  }

  async notifyScheduledTaskCreated(
    task: ScheduledTaskDocument,
    isAvailableToAll = false,
    targetUserIds: string[] = [],
  ) {
    const id = task._id.toString();
    const createdAt = (task as any).createdAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: targetUserIds,
      type: "task:created",
      entityType: "task",
      entityId: id,
      eventKey: `task:created:${id}`,
      createdAt,
      data: {
        id,
        taskCode: task.taskCode,
        title: task.title,
        locationName: (task.locationId as any)?.name,
        departmentName: (task.departmentId as any)?.name,
        machineName: (task.machineId as any)?.name,
        scheduledDate: `${task.scheduledYear}-${String(task.scheduledMonth).padStart(2, "0")}-${String(task.scheduledDay || 1).padStart(2, "0")}`,
        isAvailableToAll,
        createdAt,
      },
      message: isAvailableToAll
        ? `تم إضافة صيانة وقائية جديدة متاحة لمهندسي القسم: ${task.taskCode}`
        : `تم إضافة صيانة وقائية جديدة: ${task.taskCode}`,
    });
  }

  async notifyComplaintCreated(
    complaint: ComplaintDocument,
    userIds: string[] = [],
  ) {
    const id = complaint._id.toString();
    const createdAt = (complaint as any).createdAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "complaint:created",
      entityType: "complaint",
      entityId: id,
      eventKey: `complaint:created:${id}`,
      createdAt,
      data: this.complaintData(complaint, createdAt),
      message: `تم تقديم بلاغ جديد: ${complaint.complaintCode}`,
    });
  }

  async notifyComplaintTransferred(
    complaint: ComplaintDocument,
    userIds: string[],
  ) {
    const id = complaint._id.toString();
    const occurredAt = (complaint as any).updatedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "complaint:transferred",
      entityType: "complaint",
      entityId: id,
      eventKey: `complaint:transferred:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        complaintCode: complaint.complaintCode,
        departmentId: complaint.departmentId?.toString(),
        status: complaint.status,
      },
      message: `تم تحويل البلاغ ${complaint.complaintCode} إلى قسم جديد`,
    });
  }

  async notifyComplaintAssigned(
    complaint: ComplaintDocument,
    engineerId: string,
  ) {
    const id = complaint._id.toString();
    const occurredAt = (complaint as any).updatedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: [engineerId],
      type: "complaint:assigned",
      entityType: "complaint",
      entityId: id,
      eventKey: `complaint:assigned:${id}:${engineerId}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        complaintCode: complaint.complaintCode,
        status: complaint.status,
      },
      message: `تم إسناد البلاغ ${complaint.complaintCode} إليك`,
    });
  }

  async notifyCompletionPending(
    request: MaintenanceRequestDocument,
    userIds: string[],
  ) {
    const id = request._id.toString();
    const occurredAt = request.completionRequestedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:completion-pending",
      entityType: "request",
      entityId: id,
      eventKey: `request:completion-pending:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        requestCode: request.requestCode,
        status: request.status,
        completionRequestedAt: request.completionRequestedAt,
      },
      message: `طلب ${request.requestCode} بانتظار اعتماد الإكمال`,
    });
  }

  async notifyCompletionApproved(
    request: MaintenanceRequestDocument,
    userIds: string[],
  ) {
    const id = request._id.toString();
    const occurredAt = request.completionApprovedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:completion-approved",
      entityType: "request",
      entityId: id,
      eventKey: `request:completion-approved:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        requestCode: request.requestCode,
        status: request.status,
        completionApprovedAt: request.completionApprovedAt,
        completionApprovedByName: request.completionApprovedByName,
      },
      message: `تم اعتماد إكمال الطلب ${request.requestCode}`,
    });
  }

  async notifyCompletionRejected(
    request: MaintenanceRequestDocument,
    userIds: string[],
    reason: string,
  ) {
    const id = request._id.toString();
    const occurredAt = (request as any).updatedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "request:completion-rejected",
      entityType: "request",
      entityId: id,
      eventKey: `request:completion-rejected:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        id,
        requestCode: request.requestCode,
        status: request.status,
        reason,
      },
      message: `أُعيد الطلب ${request.requestCode} للمهندس: ${reason}`,
    });
  }

  async notifyComplaintResolved(
    complaint: ComplaintDocument,
    userIds: string[],
  ) {
    const id = complaint._id.toString();
    const occurredAt = complaint.resolvedAt ?? new Date();
    await this.notifyUsers({
      recipientUserIds: userIds,
      type: "complaint:resolved",
      entityType: "complaint",
      entityId: id,
      eventKey: `complaint:resolved:${id}:${occurredAt.toISOString()}`,
      createdAt: occurredAt,
      data: {
        ...this.complaintData(complaint, occurredAt),
        engineerName: (complaint.assignedEngineerId as any)?.name,
        resolvedAt: complaint.resolvedAt,
      },
      message: `تم حل البلاغ ${complaint.complaintCode}`,
    });
  }

  notifyBulkExportProgress(userId: string, payload: BulkExportProgressPayload) {
    this.server.to(`user:${userId}`).emit("bulk-export:progress", payload);
  }

  private complaintData(complaint: ComplaintDocument, createdAt: Date) {
    return {
      id: complaint._id.toString(),
      complaintCode: complaint.complaintCode,
      reporterName: complaint.reporterNameAr || complaint.reporterNameEn || "",
      location:
        (complaint.locationId as any)?.name ||
        complaint.locationAr ||
        complaint.locationEn ||
        "",
      submissionLanguage: complaint.submissionLanguage,
      reporterNameAr: complaint.reporterNameAr,
      reporterNameEn: complaint.reporterNameEn,
      locationAr: complaint.locationAr,
      locationEn: complaint.locationEn,
      status: complaint.status,
      createdAt,
    };
  }
}
