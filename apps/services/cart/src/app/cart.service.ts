import { Injectable } from '@nestjs/common';

@Injectable()
export class CartService {
  getStatus() {
    return { service: 'cart', status: 'ok' };
  }
}
