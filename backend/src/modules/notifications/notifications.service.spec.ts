import { Types } from "mongoose";
import { NotificationsService } from "./notifications.service";

const ids = {
  user: "64b000000000000000000001",
  otherUser: "64b000000000000000000002",
  notification: "64b000000000000000000003",
};

const query = <T>(value: T) => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe("NotificationsService", () => {
  it("loads unread notifications only for the authenticated user", async () => {
    const createdAt = new Date("2026-09-09T10:00:00.000Z");
    const findQuery = query([
      {
        _id: new Types.ObjectId(ids.notification),
        recipientUserId: new Types.ObjectId(ids.user),
        type: "request:created",
        message: "New request",
        data: { id: "request-id" },
        readAt: null,
        createdAt,
      },
    ]);
    const notificationModel = { find: jest.fn().mockReturnValue(findQuery) };
    const service = new NotificationsService(
      notificationModel as never,
      {} as never,
    );

    const result = await service.getNotifications(ids.user, "unread", 20);

    expect(notificationModel.find).toHaveBeenCalledWith({
      recipientUserId: new Types.ObjectId(ids.user),
      readAt: null,
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(findQuery.limit).toHaveBeenCalledWith(20);
    expect(result[0]).toMatchObject({
      id: ids.notification,
      readAt: null,
      createdAt: createdAt.toISOString(),
    });
  });

  it("marks only an owned unread notification and preserves idempotency", async () => {
    const readAt = new Date("2026-09-09T11:00:00.000Z");
    const stored = {
      _id: new Types.ObjectId(ids.notification),
      recipientUserId: new Types.ObjectId(ids.user),
      type: "request:created",
      message: "New request",
      data: {},
      readAt,
      createdAt: new Date("2026-09-09T10:00:00.000Z"),
    };
    const notificationModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(query(null)),
      findOne: jest.fn().mockReturnValue(query(stored)),
    };
    const service = new NotificationsService(
      notificationModel as never,
      {} as never,
    );

    const result = await service.markAsRead(ids.notification, ids.user);

    expect(notificationModel.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: new Types.ObjectId(ids.notification),
      recipientUserId: new Types.ObjectId(ids.user),
      readAt: null,
    });
    expect(notificationModel.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(ids.notification),
      recipientUserId: new Types.ObjectId(ids.user),
    });
    expect(result.readAt).toBe(readAt.toISOString());
  });

  it("marks all unread notifications for one user only", async () => {
    const notificationModel = {
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
    };
    const service = new NotificationsService(
      notificationModel as never,
      {} as never,
    );

    await expect(service.markAllAsRead(ids.user)).resolves.toBe(3);
    expect(notificationModel.updateMany.mock.calls[0][0]).toEqual({
      recipientUserId: new Types.ObjectId(ids.user),
      readAt: null,
    });
  });

  it("creates one deduplicated record per active recipient", async () => {
    const activeUsers = [ids.user, ids.otherUser].map((id) => ({
      _id: new Types.ObjectId(id),
    }));
    const userModel = { find: jest.fn().mockReturnValue(query(activeUsers)) };
    const notificationModel = {
      bulkWrite: jest.fn().mockResolvedValue({
        upsertedIds: {
          0: new Types.ObjectId(ids.notification),
          1: new Types.ObjectId("64b000000000000000000004"),
        },
      }),
      find: jest.fn().mockReturnValue(query([])),
    };
    const service = new NotificationsService(
      notificationModel as never,
      userModel as never,
    );

    await service.createForRecipients({
      recipientUserIds: [ids.user, ids.otherUser, ids.user],
      type: "request:created",
      entityType: "request",
      entityId: "request-id",
      message: "New request",
      eventKey: "request:created:request-id",
    });

    const operations = notificationModel.bulkWrite.mock.calls[0][0];
    expect(operations).toHaveLength(2);
    expect(operations[0].updateOne.filter).toEqual({
      recipientUserId: new Types.ObjectId(ids.user),
      eventKey: "request:created:request-id",
    });
    expect(operations[0].updateOne.upsert).toBe(true);
  });
});
