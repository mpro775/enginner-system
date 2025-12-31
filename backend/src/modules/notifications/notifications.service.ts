import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MaintenanceRequest,
  MaintenanceRequestDocument,
} from '../maintenance-requests/schemas/maintenance-request.schema';
import { ScheduledTask, ScheduledTaskDocument } from '../scheduled-tasks/schemas/scheduled-task.schema';
import { Complaint, ComplaintDocument } from '../complaints/schemas/complaint.schema';
import { Role, RequestStatus, ComplaintStatus } from '../../common/enums';

export interface NotificationResponse {
  type: string;
  data: Record<string, unknown>;
  message: string;
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(MaintenanceRequest.name)
    private requestModel: Model<MaintenanceRequestDocument>,
    @InjectModel(ScheduledTask.name)
    private taskModel: Model<ScheduledTaskDocument>,
    @InjectModel(Complaint.name)
    private complaintModel: Model<ComplaintDocument>,
  ) {}

  async getNotifications(
    userId: string,
    role: string,
    limit: number = 50,
  ): Promise<NotificationResponse[]> {
    const notifications: NotificationResponse[] = [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get recent maintenance requests based on role
    const requestFilter: any = {
      createdAt: { $gte: sevenDaysAgo },
    };

    // Engineers can only see their own requests
    if (role === Role.ENGINEER) {
      requestFilter.engineerId = Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : userId;
    } else if (role === Role.CONSULTANT) {
      // Consultants can see requests assigned to them or all requests
      // We'll show all recent requests for consultants
    } else if (role === Role.MAINTENANCE_SAFETY_MONITOR) {
      // Health safety monitors can see all requests
    }
    // For admin, maintenance_manager - get all requests

    const recentRequests = await this.requestModel
      .find(requestFilter)
      .populate('engineerId', 'name')
      .populate('locationId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    // Convert requests to notifications
    for (const request of recentRequests) {
      const requestData = request.toObject();
      const createdAt = (requestData as any).createdAt || requestData.openedAt;

      // Notification for created request (only for non-engineers)
      if (
        role !== Role.ENGINEER &&
        (role === Role.CONSULTANT ||
          role === Role.MAINTENANCE_MANAGER ||
          role === Role.ADMIN)
      ) {
        notifications.push({
          type: 'request:created',
          data: {
            id: request._id.toString(),
            requestCode: request.requestCode,
            maintenanceType: request.maintenanceType,
            status: request.status,
            engineerName: (request.engineerId as any)?.name,
            locationName: (request.locationId as any)?.name,
            createdAt: createdAt,
          },
          message: `New maintenance request ${request.requestCode} created`,
          timestamp: createdAt?.toISOString() || new Date().toISOString(),
        });
      }

      // Notification for completed request
      if (request.status === RequestStatus.COMPLETED && request.closedAt) {
        notifications.push({
          type: 'request:completed',
          data: {
            id: request._id.toString(),
            requestCode: request.requestCode,
            status: request.status,
            engineerName: (request.engineerId as any)?.name,
            closedAt: request.closedAt,
          },
          message: `Request ${request.requestCode} has been completed`,
          timestamp: request.closedAt.toISOString(),
        });
      }

      // Notification for stopped request
      if (request.status === RequestStatus.STOPPED && request.stoppedAt) {
        notifications.push({
          type: 'request:stopped',
          data: {
            id: request._id.toString(),
            requestCode: request.requestCode,
            status: request.status,
            stopReason: request.stopReason,
            engineerName: (request.engineerId as any)?.name,
            stoppedAt: request.stoppedAt,
          },
          message: `Request ${request.requestCode} has been stopped`,
          timestamp: request.stoppedAt.toISOString(),
        });
      }

      // Notification for updated request (if has notes)
      if (
        (request.consultantNotes || request.healthSafetyNotes) &&
        (request as any).updatedAt
      ) {
        notifications.push({
          type: 'request:updated',
          data: {
            id: request._id.toString(),
            requestCode: request.requestCode,
            status: request.status,
            engineerName: (request.engineerId as any)?.name,
          },
          message: `Request ${request.requestCode} has been updated`,
          timestamp: (request as any).updatedAt?.toISOString() || new Date().toISOString(),
        });
      }
    }

    // Get recent scheduled tasks for engineers
    if (role === Role.ENGINEER) {
      const taskFilter: any = {
        createdAt: { $gte: sevenDaysAgo },
        $or: [{ engineerId: userId }, { engineerId: null }],
      };

      const recentTasks = await this.taskModel
        .find(taskFilter)
        .populate('locationId', 'name')
        .populate('departmentId', 'name')
        .populate('machineId', 'name')
        .sort({ createdAt: -1 })
        .limit(20)
        .exec();

      for (const task of recentTasks) {
        const taskData = task.toObject();
        const createdAt = (taskData as any).createdAt;

        notifications.push({
          type: 'task:created',
          data: {
            id: task._id.toString(),
            taskCode: task.taskCode,
            title: task.title,
            locationName: (task.locationId as any)?.name,
            departmentName: (task.departmentId as any)?.name,
            machineName: (task.machineId as any)?.name,
            scheduledDate: `${task.scheduledYear}-${String(task.scheduledMonth).padStart(2, '0')}-${String(task.scheduledDay || 1).padStart(2, '0')}`,
            isAvailableToAll: !task.engineerId,
            createdAt: createdAt,
          },
          message: !task.engineerId
            ? `تم إضافة صيانة وقائية جديدة متاحة لجميع المهندسين: ${task.taskCode}`
            : `تم إضافة صيانة وقائية جديدة: ${task.taskCode}`,
          timestamp: createdAt?.toISOString() || new Date().toISOString(),
        });
      }
    }

    // Get recent complaints (for all users)
    const recentComplaints = await this.complaintModel
      .find({
        createdAt: { $gte: sevenDaysAgo },
      })
      .populate('assignedEngineerId', 'name')
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();

    for (const complaint of recentComplaints) {
      const complaintData = complaint.toObject();
      const createdAt = (complaintData as any).createdAt;

      notifications.push({
        type: 'complaint:created',
        data: {
          id: complaint._id.toString(),
          complaintCode: complaint.complaintCode,
          reporterName: complaint.reporterName,
          location: complaint.location,
          status: complaint.status,
          createdAt: createdAt,
        },
        message: `تم تقديم بلاغ جديد: ${complaint.complaintCode}`,
        timestamp: createdAt?.toISOString() || new Date().toISOString(),
      });

      if (
        complaint.status === ComplaintStatus.RESOLVED &&
        complaint.resolvedAt
      ) {
        notifications.push({
          type: 'complaint:resolved',
          data: {
            id: complaint._id.toString(),
            complaintCode: complaint.complaintCode,
            reporterName: complaint.reporterName,
            status: complaint.status,
            engineerName: (complaint.assignedEngineerId as any)?.name,
            resolvedAt: complaint.resolvedAt,
          },
          message: `تم حل البلاغ ${complaint.complaintCode}`,
          timestamp: complaint.resolvedAt.toISOString(),
        });
      }
    }

    // Sort by timestamp descending and limit
    return notifications
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

