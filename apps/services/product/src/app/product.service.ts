import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductService {
  getStatus() {
    return { service: 'product', status: 'ok' };
  }
}