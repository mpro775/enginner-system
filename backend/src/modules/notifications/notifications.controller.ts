import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

class GetNotificationsDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Query() query: GetNotificationsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const notifications = await this.notificationsService.getNotifications(
      user.userId,
      user.role,
      query.limit,
    );

    return {
      data: notifications,
      message: 'Notifications retrieved successfully',
    };
  }
}

