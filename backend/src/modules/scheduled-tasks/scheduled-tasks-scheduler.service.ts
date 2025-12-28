import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ScheduledTasksService } from "./scheduled-tasks.service";

@Injectable()
export class ScheduledTasksSchedulerService {
  constructor(private readonly scheduledTasksService: ScheduledTasksService) {}

  // Run daily at 2 AM to generate recurring tasks
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleRecurringTasksGeneration() {
    try {
      await this.scheduledTasksService.generateRecurringTasks();
    } catch (error) {
      console.error("Error generating recurring tasks:", error);
    }
  }

  // Also run every hour to catch tasks that need immediate generation
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyRecurringTasksCheck() {
    try {
      await this.scheduledTasksService.generateRecurringTasks();
    } catch (error) {
      console.error("Error checking recurring tasks:", error);
    }
  }
}

