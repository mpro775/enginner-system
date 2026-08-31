import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { MaintenanceRequestDocument } from "../maintenance-requests/schemas/maintenance-request.schema";
import { ScheduledTaskDocument } from "../scheduled-tasks/schemas/scheduled-task.schema";
import { ComplaintDocument } from "../complaints/schemas/complaint.schema";

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
  user?: {
    userId: string;
    role: string;
    name: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true,
  },
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
    private configService: ConfigService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
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

      // Join role-based rooms
      await client.join(payload.role);
      await client.join(`user:${payload.sub}`);

      this.logger.log(
        `Client ${client.id} connected - User: ${payload.name} (${payload.role})`
      );
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  notifyUsers(
    userIds: string[],
    type: string,
    data: Record<string, unknown>,
    message: string,
    timestamp = new Date(),
  ): void {
    const notification = {
      type,
      data,
      message,
      timestamp: timestamp.toISOString(),
    };
    for (const userId of new Set(userIds.filter(Boolean))) {
      this.server.to(`user:${userId}`).emit("notification", notification);
    }
  }

  @SubscribeMessage("ping")
  handlePing(client: Socket): string {
    return "pong";
  }

  // Notify when a new request is created
  notifyRequestCreated(request: MaintenanceRequestDocument, userIds: string[] = []) {
    const notification = {
      type: "request:created",
      data: {
        id: request._id.toString(),
        requestCode: request.requestCode,
        maintenanceType: request.maintenanceType,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
        locationName: (request.locationId as any)?.name,
        createdAt: (request as any).createdAt,
      },
      message: `New maintenance request ${request.requestCode} created`,
      timestamp: new Date().toISOString(),
    };

    for (const userId of new Set(userIds)) {
      this.server.to(`user:${userId}`).emit("notification", notification);
    }

    this.logger.log(`Notified about new request: ${request.requestCode}`);
  }

  // Notify when a request is stopped
  notifyRequestStopped(request: MaintenanceRequestDocument, userIds: string[] = []) {
    const notification = {
      type: "request:stopped",
      data: {
        id: request._id.toString(),
        requestCode: request.requestCode,
        status: request.status,
        stopReason: request.stopReason,
        engineerName: (request.engineerId as any)?.name,
        stoppedAt: request.stoppedAt,
      },
      message: `Request ${request.requestCode} has been stopped`,
      timestamp: new Date().toISOString(),
    };

    for (const userId of new Set(userIds)) {
      this.server.to(`user:${userId}`).emit("notification", notification);
    }

    this.logger.log(`Notified about stopped request: ${request.requestCode}`);
  }

  // Notify when a request is completed
  notifyRequestCompleted(request: MaintenanceRequestDocument, userIds: string[] = []) {
    const notification = {
      type: "request:completed",
      data: {
        id: request._id.toString(),
        requestCode: request.requestCode,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
        closedAt: request.closedAt,
      },
      message: `Request ${request.requestCode} has been completed`,
      timestamp: new Date().toISOString(),
    };

    for (const userId of new Set(userIds)) {
      this.server.to(`user:${userId}`).emit("notification", notification);
    }

    this.logger.log(`Notified about completed request: ${request.requestCode}`);
  }

  // Notify when a request is updated
  notifyRequestUpdated(request: MaintenanceRequestDocument, userIds: string[] = []) {
    const notification = {
      type: "request:updated",
      data: {
        id: request._id.toString(),
        requestCode: request.requestCode,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
      },
      message: `Request ${request.requestCode} has been updated`,
      timestamp: new Date().toISOString(),
    };

    for (const userId of new Set(userIds)) {
      this.server.to(`user:${userId}`).emit("notification", notification);
    }

    this.logger.log(`Notified about updated request: ${request.requestCode}`);
  }

  // Notify about pending scheduled tasks
  notifyPendingTasks(
    engineerId: string,
    counts: { overdue: number; pending: number; total: number }
  ): void {
    const notification = {
      type: counts.overdue > 0 ? "task:overdue" : "task:pending",
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
      timestamp: new Date().toISOString(),
    };

    // Notify the specific engineer
    this.server.to(`user:${engineerId}`).emit("notification", notification);

    this.logger.log(
      `Notified engineer ${engineerId} about pending tasks: ${counts.total} total`
    );
  }

  // Notify when a new scheduled task is created
  notifyScheduledTaskCreated(
    task: ScheduledTaskDocument,
    isAvailableToAll: boolean = false
  ) {
    const notification = {
      type: "task:created",
      data: {
        id: task._id.toString(),
        taskCode: task.taskCode,
        title: task.title,
        locationName: (task.locationId as any)?.name,
        departmentName: (task.departmentId as any)?.name,
        machineName: (task.machineId as any)?.name,
        scheduledDate: `${task.scheduledYear}-${String(task.scheduledMonth).padStart(2, "0")}-${String(task.scheduledDay || 1).padStart(2, "0")}`,
        isAvailableToAll,
        createdAt: (task as any).createdAt,
      },
      message: isAvailableToAll
        ? `تم إضافة صيانة وقائية جديدة متاحة لجميع المهندسين: ${task.taskCode}`
        : `تم إضافة صيانة وقائية جديدة: ${task.taskCode}`,
      timestamp: new Date().toISOString(),
    };

    if (isAvailableToAll) {
      // Notify all engineers
      this.server.to("engineer").emit("notification", notification);
      this.logger.log(
        `Notified all engineers about new available task: ${task.taskCode}`
      );
    } else if (task.engineerId) {
      // Notify specific engineer
      const engineerId =
        (task.engineerId as any)?._id?.toString() ||
        (task.engineerId as any)?.id;
      if (engineerId) {
        this.server.to(`user:${engineerId}`).emit("notification", notification);
        this.logger.log(
          `Notified engineer ${engineerId} about new task: ${task.taskCode}`
        );
      }
    }
  }

  // Notify when a new complaint is created
  notifyComplaintCreated(complaint: ComplaintDocument, userIds: string[] = []) {
    const notification = {
      type: "complaint:created",
      data: {
        id: complaint._id.toString(),
        complaintCode: complaint.complaintCode,
        reporterName:
          complaint.reporterNameAr || complaint.reporterNameEn || "",
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
        createdAt: (complaint as any).createdAt,
      },
      message: `تم تقديم بلاغ جديد: ${complaint.complaintCode}`,
      timestamp: new Date().toISOString(),
    };

    for (const userId of new Set(userIds)) {
      this.server.to(`user:${userId}`).emit("notification", notification);
    }

    this.logger.log(`Notified about new complaint: ${complaint.complaintCode}`);
  }

  notifyComplaintTransferred(complaint: ComplaintDocument, userIds: string[]) {
    this.notifyUsers(
      userIds,
      "complaint:transferred",
      {
        id: complaint._id.toString(),
        complaintCode: complaint.complaintCode,
        departmentId: complaint.departmentId?.toString(),
        status: complaint.status,
      },
      `تم تحويل البلاغ ${complaint.complaintCode} إلى قسم جديد`,
    );
  }

  notifyCompletionPending(request: MaintenanceRequestDocument, userIds: string[]) {
    this.notifyUsers(
      userIds,
      "request:completion-pending",
      {
        id: request._id.toString(),
        requestCode: request.requestCode,
        status: request.status,
        completionRequestedAt: request.completionRequestedAt,
      },
      `طلب ${request.requestCode} بانتظار اعتماد الإكمال`,
      request.completionRequestedAt || new Date(),
    );
  }

  notifyCompletionApproved(request: MaintenanceRequestDocument, userIds: string[]) {
    this.notifyUsers(
      userIds,
      "request:completion-approved",
      {
        id: request._id.toString(),
        requestCode: request.requestCode,
        status: request.status,
        completionApprovedAt: request.completionApprovedAt,
        completionApprovedByName: request.completionApprovedByName,
      },
      `تم اعتماد إكمال الطلب ${request.requestCode}`,
      request.completionApprovedAt || new Date(),
    );
  }

  notifyCompletionRejected(request: MaintenanceRequestDocument, userIds: string[], reason: string) {
    this.notifyUsers(
      userIds,
      "request:completion-rejected",
      {
        id: request._id.toString(),
        requestCode: request.requestCode,
        status: request.status,
        reason,
      },
      `أُعيد الطلب ${request.requestCode} للمهندس: ${reason}`,
    );
  }

  // Notify when a complaint is resolved
  notifyComplaintResolved(complaint: ComplaintDocument, userIds: string[]) {
    this.notifyUsers(
      userIds,
      "complaint:resolved",
      {
        id: complaint._id.toString(),
        complaintCode: complaint.complaintCode,
        reporterName:
          complaint.reporterNameAr || complaint.reporterNameEn || "",
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
        engineerName: (complaint.assignedEngineerId as any)?.name,
        resolvedAt: complaint.resolvedAt,
      },
      `تم حل البلاغ ${complaint.complaintCode}`,
      complaint.resolvedAt || new Date(),
    );

    this.logger.log(`Notified about resolved complaint: ${complaint.complaintCode}`);
  }

  notifyBulkExportProgress(userId: string, payload: BulkExportProgressPayload) {
    this.server.to(`user:${userId}`).emit("bulk-export:progress", payload);
  }
}
