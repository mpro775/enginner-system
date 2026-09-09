import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Role } from "../../common/enums";
import { EntityNotFoundException } from "../../common/exceptions";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  Notification,
  NotificationDocument,
} from "./schemas/notification.schema";

export type NotificationStatus = "unread" | "read" | "all";

export interface NotificationResponse {
  id: string;
  type: string;
  entityType?: string;
  entityId?: string;
  message: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface CreateNotificationsInput {
  recipientUserIds: string[];
  type: string;
  entityType?: string;
  entityId?: string;
  message: string;
  data?: Record<string, unknown>;
  eventKey: string;
  createdAt?: Date;
}

export interface CreatedNotification {
  recipientUserId: string;
  notification: NotificationResponse;
}

type NotificationLean = {
  _id: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  type: string;
  entityType?: string;
  entityId?: string;
  message: string;
  data?: Record<string, unknown>;
  readAt?: Date | null;
  createdAt: Date;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async getNotifications(
    userId: string,
    status: NotificationStatus = "unread",
    limit = 20,
  ): Promise<NotificationResponse[]> {
    const filter: Record<string, unknown> = {
      recipientUserId: this.toObjectId(userId),
    };
    if (status === "unread") filter.readAt = null;
    if (status === "read") filter.readAt = { $ne: null };

    const notifications = await this.notificationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<NotificationLean[]>()
      .exec();
    return notifications.map((item) => this.toResponse(item));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientUserId: this.toObjectId(userId),
      readAt: null,
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationResponse> {
    const ownershipFilter = {
      _id: this.toObjectId(id, "Notification"),
      recipientUserId: this.toObjectId(userId),
    };
    let notification = await this.notificationModel
      .findOneAndUpdate(
        { ...ownershipFilter, readAt: null },
        { $set: { readAt: new Date() } },
        { new: true },
      )
      .lean<NotificationLean>()
      .exec();
    if (!notification) {
      notification = await this.notificationModel
        .findOne(ownershipFilter)
        .lean<NotificationLean>()
        .exec();
    }
    if (!notification) throw new EntityNotFoundException("Notification", id);
    return this.toResponse(notification);
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationModel.updateMany(
      { recipientUserId: this.toObjectId(userId), readAt: null },
      { $set: { readAt: new Date() } },
    );
    return result.modifiedCount;
  }

  async resolveRecipientUserIds(
    departmentId: string,
    roles: Role[],
  ): Promise<string[]> {
    const departmentValue = Types.ObjectId.isValid(departmentId)
      ? new Types.ObjectId(departmentId)
      : departmentId;
    const users = await this.userModel
      .find({
        role: { $in: roles },
        isActive: true,
        deletedAt: null,
        $or: [
          { role: { $in: [Role.ADMIN, Role.MAINTENANCE_MANAGER] } },
          { departmentIds: departmentValue },
        ],
      })
      .select("_id")
      .lean()
      .exec();
    return users.map((user) => user._id.toString());
  }

  async createForRecipients(
    input: CreateNotificationsInput,
  ): Promise<CreatedNotification[]> {
    const recipientIds = Array.from(
      new Set(
        input.recipientUserIds.filter((id) => Types.ObjectId.isValid(id)),
      ),
    );
    if (!recipientIds.length) return [];
    const activeUsers = await this.userModel
      .find({
        _id: { $in: recipientIds.map((id) => new Types.ObjectId(id)) },
        isActive: true,
        deletedAt: null,
      })
      .select("_id")
      .lean()
      .exec();
    const createdAt = input.createdAt ?? new Date();
    const operations = activeUsers.map((user) => ({
      updateOne: {
        filter: { recipientUserId: user._id, eventKey: input.eventKey },
        update: {
          $setOnInsert: {
            _id: new Types.ObjectId(),
            recipientUserId: user._id,
            type: input.type,
            entityType: input.entityType,
            entityId: input.entityId,
            message: input.message,
            data: input.data ?? {},
            readAt: null,
            eventKey: input.eventKey,
            createdAt,
            updatedAt: createdAt,
          },
        },
        upsert: true,
      },
    }));
    if (!operations.length) return [];
    const result = await this.notificationModel.bulkWrite(operations, {
      ordered: false,
    });
    const insertedIds = Object.values(result.upsertedIds);
    if (!insertedIds.length) return [];
    const inserted = await this.notificationModel
      .find({ _id: { $in: insertedIds } })
      .lean<NotificationLean[]>()
      .exec();
    return inserted.map((item) => ({
      recipientUserId: item.recipientUserId.toString(),
      notification: this.toResponse(item),
    }));
  }

  private toResponse(item: NotificationLean): NotificationResponse {
    return {
      id: item._id.toString(),
      type: item.type,
      entityType: item.entityType,
      entityId: item.entityId,
      message: item.message,
      data: item.data ?? {},
      readAt: item.readAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private toObjectId(value: string, entity = "User"): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new EntityNotFoundException(entity, value);
    }
    return new Types.ObjectId(value);
  }
}
