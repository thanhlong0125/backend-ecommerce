import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DirectusConfig } from '../types/config';
import {
  BodyDeleteMany,
  BodyUpdateMany,
  RestQuery,
} from '../types/rest.query';

@Injectable()
export class SmcDirectusService {
  private readonly logger = new Logger(SmcDirectusService.name);
  private readonly baseUrl: URL;
  private readonly API_PREFIX_ITEMS = 'items';
  private showLog = true;

  constructor(private readonly config: DirectusConfig) {
    this.baseUrl = new URL(
      config.url.endsWith('/') ? config.url : `${config.url}/`
    );
  }

  get token(): string | undefined {
    return this.config.token;
  }

  get baseUrlString(): string {
    return this.baseUrl.toString().replace(/\/$/, '');
  }

  get apiPrefixItems(): string {
    return this.API_PREFIX_ITEMS;
  }

  set isShowLog(value: boolean) {
    this.showLog = value;
  }

  login(email: string, password: string): Promise<unknown> {
    return this.request('auth/login', {
      method: 'POST',
      body: { email, password, mode: 'json' },
    });
  }

  refresh(refreshToken: string): Promise<unknown> {
    return this.request('auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
    });
  }

  me(
    token: string,
    fields = 'id,email,first_name,last_name'
  ): Promise<unknown> {
    return this.request('users/me', {
      token,
      query: { fields },
    });
  }

  getUser(query: RestQuery): Promise<unknown> {
    return this.request('users', { query });
  }

  getMany<T = unknown>(
    collection: string,
    query: RestQuery,
    token?: string
  ): Promise<T> {
    const path = this.itemPath(collection);
    this.logRequest('Get_Many', path, query);
    return this.request(path, { query, token }) as Promise<T>;
  }

  getOne<T = unknown>(
    collection: string,
    id: string,
    token?: string
  ): Promise<T> {
    const path = this.itemPath(collection, id);
    this.logRequest('Get_One', path);
    return this.request(path, { token }) as Promise<T>;
  }

  createOne<T = unknown>(
    collection: string,
    data: Record<string, unknown>,
    token?: string
  ): Promise<T> {
    return this.request(this.itemPath(collection), {
      method: 'POST',
      body: data,
      token,
    }) as Promise<T>;
  }

  createMany<T = unknown>(
    collection: string,
    data: Record<string, unknown>[],
    token?: string
  ): Promise<T> {
    return this.request(this.itemPath(collection), {
      method: 'POST',
      body: data,
      token,
    }) as Promise<T>;
  }

  updateOne<T = unknown>(
    collection: string,
    id: string,
    data: Record<string, unknown>,
    token?: string
  ): Promise<T> {
    return this.request(this.itemPath(collection, id), {
      method: 'PATCH',
      body: data,
      token,
    }) as Promise<T>;
  }

  updateMany<T = unknown>(
    collection: string,
    data: BodyUpdateMany,
    token?: string
  ): Promise<T> {
    return this.request(this.itemPath(collection), {
      method: 'PATCH',
      body: data,
      token,
    }) as Promise<T>;
  }

  deleteOne<T = unknown>(
    collection: string,
    id: string,
    token?: string
  ): Promise<T> {
    return this.request(this.itemPath(collection, id), {
      method: 'DELETE',
      token,
    }) as Promise<T>;
  }

  deleteMany<T = unknown>(
    collection: string,
    data: BodyDeleteMany,
    token?: string
  ): Promise<T> {
    return this.request(this.itemPath(collection), {
      method: 'DELETE',
      body: data,
      token,
    }) as Promise<T>;
  }

  private itemPath(collection: string, id?: string): string {
    return [this.API_PREFIX_ITEMS, collection, id]
      .filter((part): part is string => part !== undefined)
      .map((part) => encodeURIComponent(part))
      .join('/');
  }

  private logRequest(operation: string, path: string, query?: RestQuery): void {
    if (this.showLog) {
      this.logger.debug(JSON.stringify({ path, query }), operation);
    }
  }

  private async request(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: RestQuery;
      token?: string;
    } = {}
  ): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    this.appendQuery(url.searchParams, options.query);

    const headers = new Headers({ accept: 'application/json' });
    const token = options.token ?? this.config.token;
    if (token) {
      headers.set('authorization', 'Bearer '.concat(token));
    }
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        ...(options.body === undefined
          ? {}
          : { body: JSON.stringify(options.body) }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      this.logger.error(
        `Directus request failed (${options.method ?? 'GET'} ${path}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException(
        'Directus service is unavailable'
      );
    }

    if (response.status === 204) {
      return undefined;
    }

    const responseText = await response.text();
    let payload: unknown = responseText;
    if (responseText) {
      try {
        payload = JSON.parse(responseText) as unknown;
      } catch {
        payload = responseText;
      }
    }

    if (!response.ok) {
      const errorPayload =
        typeof payload === 'object' &&
        payload !== null &&
        'errors' in payload
          ? payload
          : { message: `Directus returned HTTP ${response.status}` };
      throw new HttpException(errorPayload, response.status);
    }

    return payload;
  }

  private appendQuery(
    searchParams: URLSearchParams,
    query?: RestQuery
  ): void {
    if (!query) {
      return;
    }

    const append = (key: string, value: unknown): void => {
      if (value === undefined) {
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          append(`${key}[]`, item);
        }
        return;
      }
      if (typeof value === 'object' && value !== null) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          append(`${key}[${nestedKey}]`, nestedValue);
        }
        return;
      }
      searchParams.append(key, value === null ? '' : String(value));
    };

    for (const [key, value] of Object.entries(query)) {
      append(key, value);
    }
  }
}
