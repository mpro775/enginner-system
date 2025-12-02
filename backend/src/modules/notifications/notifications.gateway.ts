import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MaintenanceRequestDocument } from '../maintenance-requests/schemas/maintenance-request.schema';

interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    role: string;
    name: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
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
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || 
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
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
        `Client ${client.id} connected - User: ${payload.name} (${payload.role})`,
      );
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    return 'pong';
  }

  // Notify when a new request is created
  notifyRequestCreated(request: MaintenanceRequestDocument) {
    const notification = {
      type: 'request:created',
      data: {
        id: request._id,
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

    // Notify consultants and admins
    this.server.to('consultant').emit('notification', notification);
    this.server.to('admin').emit('notification', notification);

    this.logger.log(`Notified about new request: ${request.requestCode}`);
  }

  // Notify when a request is stopped
  notifyRequestStopped(request: MaintenanceRequestDocument) {
    const notification = {
      type: 'request:stopped',
      data: {
        id: request._id,
        requestCode: request.requestCode,
        status: request.status,
        stopReason: request.stopReason,
        engineerName: (request.engineerId as any)?.name,
        stoppedAt: request.stoppedAt,
      },
      message: `Request ${request.requestCode} has been stopped`,
      timestamp: new Date().toISOString(),
    };

    // Notify consultants and admins
    this.server.to('consultant').emit('notification', notification);
    this.server.to('admin').emit('notification', notification);

    this.logger.log(`Notified about stopped request: ${request.requestCode}`);
  }

  // Notify when a request is completed
  notifyRequestCompleted(request: MaintenanceRequestDocument) {
    const notification = {
      type: 'request:completed',
      data: {
        id: request._id,
        requestCode: request.requestCode,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
        closedAt: request.closedAt,
      },
      message: `Request ${request.requestCode} has been completed`,
      timestamp: new Date().toISOString(),
    };

    // Notify consultants and admins
    this.server.to('consultant').emit('notification', notification);
    this.server.to('admin').emit('notification', notification);

    this.logger.log(`Notified about completed request: ${request.requestCode}`);
  }

  // Notify when a request is updated
  notifyRequestUpdated(request: MaintenanceRequestDocument) {
    const notification = {
      type: 'request:updated',
      data: {
        id: request._id,
        requestCode: request.requestCode,
        status: request.status,
        engineerName: (request.engineerId as any)?.name,
      },
      message: `Request ${request.requestCode} has been updated`,
      timestamp: new Date().toISOString(),
    };

    // Notify consultants and admins
    this.server.to('consultant').emit('notification', notification);
    this.server.to('admin').emit('notification', notification);

    this.logger.log(`Notified about updated request: ${request.requestCode}`);
  }
}



