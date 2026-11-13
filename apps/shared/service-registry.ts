import { Inject } from '@nestjs/common';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { APP_BOOTSTRAP, AppBootstrap } from './bootstrap';

@Injectable()
export class ServiceRegistry implements OnModuleDestroy {
  private readonly logger = new Logger(ServiceRegistry.name);
  private readonly serviceId: string;
  private registered = false;

  constructor(
    @Inject(APP_BOOTSTRAP) private readonly config: AppBootstrap
  ) {
    this.serviceId = `${config.service.name}-${process.pid}`;
  }

  async register(): Promise<void> {
    const healthUrl = new URL(
      `${this.config.app.prefix ? `${this.config.app.prefix}/` : ''}health`,
      `http://${this.config.service.advertiseHost}:${this.config.app.port}`
    );
    const response = await fetch(
      new URL('/v1/agent/service/register', this.config.consul.url),
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Name: this.config.service.name,
          ID: this.serviceId,
          Address: this.config.service.advertiseHost,
          Port: this.config.app.port,
          Check: {
            HTTP: healthUrl.toString(),
            Interval: '10s',
            Timeout: '2s',
            DeregisterCriticalServiceAfter: '1m',
          },
        }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Consul registration failed (${response.status}): ${await response.text()}`
      );
    }

    this.registered = true;
    this.logger.log(`Registered ${this.serviceId} with Consul`);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.registered) {
      return;
    }

    const response = await fetch(
      new URL(
        `/v1/agent/service/deregister/${encodeURIComponent(this.serviceId)}`,
        this.config.consul.url
      ),
      { method: 'PUT', signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) {
      throw new Error(
        `Consul deregistration failed (${response.status}): ${await response.text()}`
      );
    }
    this.logger.log(`Deregistered ${this.serviceId} from Consul`);
  }
}
