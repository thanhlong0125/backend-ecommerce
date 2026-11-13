import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_BOOTSTRAP, AppBootstrap } from '../../../shared/bootstrap';
import type { ServiceInstance } from '../../../shared/consul-client';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    @Inject(APP_BOOTSTRAP) private readonly config: AppBootstrap
  ) {}

  async forwardToService(
    request: Request,
    serviceSlug: string
  ): Promise<Response> {
    if (!/^[a-z][a-z0-9-]*$/.test(serviceSlug)) {
      throw new BadRequestException('Invalid service route');
    }

    const serviceName = `${this.config.app.name}-${serviceSlug}`;
    const instances = await this.getServiceInstances(serviceName);
    const instance = instances[Math.floor(Math.random() * instances.length)];
    const address = this.config.serviceHostOverride || instance.address;
    const target = new URL(
      request.originalUrl,
      `http://${address}:${instance.port}`
    );
    const headers = this.forwardHeaders(request.headers);
    try {
      return await fetch(target, {
        method: request.method,
        headers,
        ...(request.method === 'GET' || request.method === 'HEAD'
          ? {}
          : { body: JSON.stringify(request.body ?? {}) }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      this.logger.error(
        `${serviceSlug} request failed (${request.method} ${request.originalUrl}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException(
        `${serviceSlug} service is unavailable`
      );
    }
  }

  private async getServiceInstances(
    serviceName: string
  ): Promise<ServiceInstance[]> {
    const discoveryUrl = new URL(
      `/v1/health/service/${encodeURIComponent(serviceName)}`,
      this.config.consul.url
    );
    discoveryUrl.searchParams.set('passing', 'true');

    let response: Response;
    try {
      response = await fetch(discoveryUrl, {
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      this.logger.error(
        `Consul discovery failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException(
        'Service discovery is unavailable'
      );
    }

    if (!response.ok) {
      this.logger.error(`Consul discovery returned HTTP ${response.status}`);
      throw new ServiceUnavailableException(
        'Service discovery is unavailable'
      );
    }

    let results: unknown;
    try {
      results = await response.json();
    } catch (error) {
      this.logger.error(
        `Consul returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException(
        'Service discovery returned an invalid response'
      );
    }
    if (!Array.isArray(results)) {
      throw new ServiceUnavailableException(
        'Service discovery returned an invalid response'
      );
    }
    const instances = results
      .map((result) => {
        const service = (result as { Service?: Record<string, unknown> })
          ?.Service;
        if (
          typeof service?.Address !== 'string' ||
          typeof service.Port !== 'number'
        ) {
          return null;
        }
        return {
          address: service.Address,
          port: service.Port,
        };
      })
      .filter((instance): instance is ServiceInstance => instance !== null);

    if (instances.length === 0) {
      throw new ServiceUnavailableException(
        `No healthy instances found for ${serviceName}`
      );
    }
    return instances;
  }

  private forwardHeaders(source: Request['headers']): Headers {
    const headers = new Headers();
    for (const [name, value] of Object.entries(source)) {
      if (
        ['host', 'connection', 'content-length', 'transfer-encoding'].includes(
          name.toLowerCase()
        ) ||
        value === undefined
      ) {
        continue;
      }
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    return headers;
  }
}
