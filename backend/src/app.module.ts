import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerModule } from "@nestjs/throttler";
import { CacheModule } from "@nestjs/cache-manager";
import { ScheduleModule } from "@nestjs/schedule";

// Modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { LocationsModule } from "./modules/locations/locations.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { SystemsModule } from "./modules/systems/systems.module";
import { MachinesModule } from "./modules/machines/machines.module";
import { MaintenanceRequestsModule } from "./modules/maintenance-requests/maintenance-requests.module";
import { ScheduledTasksModule } from "./modules/scheduled-tasks/scheduled-tasks.module";
import { StatisticsModule } from "./modules/statistics/statistics.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditLogsModule } from "./modules/audit-logs/audit-logs.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>("MONGODB_URI"),
      }),
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>("THROTTLE_TTL", 60) * 1000,
          limit: configService.get<number>("THROTTLE_LIMIT", 100),
        },
      ],
      inject: [ConfigService],
    }),

    // Cache
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const cacheTtl = parseInt(configService.get<string>("CACHE_TTL") || "300", 10);
        const cacheMax = parseInt(configService.get<string>("CACHE_MAX") || "100", 10);
        
        return {
          ttl: (cacheTtl > 0 ? cacheTtl : 300) * 1000,
          max: cacheMax > 0 ? cacheMax : 100,
        };
      },
      inject: [ConfigService],
    }),

    // Schedule Module for cron jobs
    ScheduleModule.forRoot(),

    // Feature Modules
    AuthModule,
    UsersModule,
    LocationsModule,
    DepartmentsModule,
    SystemsModule,
    MachinesModule,
    MaintenanceRequestsModule,
    ScheduledTasksModule,
    StatisticsModule,
    ReportsModule,
    NotificationsModule,
    AuditLogsModule,
    HealthModule,
  ],
})
export class AppModule {}
