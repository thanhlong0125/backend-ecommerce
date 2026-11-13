import { All, Controller, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { GatewayService } from './gateway.service';

@Controller()
export class AppController {
  constructor(private readonly gatewayService: GatewayService) {}

  @All(':service')
  async proxyServiceRoot(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.forward(service, req, res);
  }

  @All(':service/{*path}')
  async proxyServicePath(
    @Param('service') service: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.forward(service, req, res);
  }

  private async forward(
    service: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const upstream = await this.gatewayService.forwardToService(req, service);
    res.status(upstream.status);
    upstream.headers.forEach((value, name) => {
      if (
        !['connection', 'content-length', 'transfer-encoding'].includes(name)
      ) {
        res.setHeader(name, value);
      }
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length === 0) {
      res.end();
      return;
    }
    res.send(body);
  }
}
