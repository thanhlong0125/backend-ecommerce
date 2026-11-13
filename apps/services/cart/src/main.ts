import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';
import { loadBootstrap } from '../../../shared/bootstrap';
import { ServiceRegistry } from '../../../shared/service-registry';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const config = loadBootstrap('cart', join(__dirname, 'bootstraps'));
  const app = await NestFactory.create(AppModule.register(config));
  app.setGlobalPrefix(config.app.prefix);
  app.enableShutdownHooks();

  await app.listen(config.app.port, '0.0.0.0');
  Logger.log(
    `Cart is listening at http://localhost:${config.app.port}/${config.app.prefix}; health: http://localhost:${config.app.port}/${config.app.prefix}/health`,
    'Bootstrap'
  );

  try {
    await app.get(ServiceRegistry).register();
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  console.error('Cart startup failed', error);
  process.exitCode = 1;
});
