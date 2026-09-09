import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserData,
} from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  NotificationStatus,
  NotificationsService,
} from "./notifications.service";

class GetNotificationsDto {
  @IsOptional()
  @IsIn(["unread", "read", "all"])
  status?: NotificationStatus = "unread";

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query() query: GetNotificationsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.notificationsService.getNotifications(
        user.userId,
        query.status,
        query.limit,
      ),
      message: "Notifications retrieved successfully",
    };
  }

  @Get("unread-count")
  async getUnreadCount(@CurrentUser() user: CurrentUserData) {
    return {
      data: {
        count: await this.notificationsService.getUnreadCount(user.userId),
      },
      message: "Unread notification count retrieved successfully",
    };
  }

  @Patch("read-all")
  async markAllAsRead(@CurrentUser() user: CurrentUserData) {
    return {
      data: {
        updated: await this.notificationsService.markAllAsRead(user.userId),
      },
      message: "All notifications marked as read",
    };
  }

  @Patch(":id/read")
  async markAsRead(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return {
      data: await this.notificationsService.markAsRead(id, user.userId),
      message: "Notification marked as read",
    };
  }
}
