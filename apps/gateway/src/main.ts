import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';
import { loadBootstrap } from '../../shared/bootstrap';
import { ServiceRegistry } from '../../shared/service-registry';
import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const config = loadBootstrap('gateway', join(__dirname, 'bootstraps'));
  const app = await NestFactory.create(AppModule.register(config));
  app.setGlobalPrefix(config.app.prefix);
  app.enableShutdownHooks();

  await app.listen(config.app.port, '0.0.0.0');
  try {
    await app.get(ServiceRegistry).register();
  } catch (error) {
    await app.close();
    throw error;
  }

  Logger.log(
    `Gateway is listening at http://localhost:${config.app.port}/${config.app.prefix}; health: http://localhost:${config.app.port}/${config.app.prefix}/health`,
    'Bootstrap'
  );
}

void bootstrap().catch((error: unknown) => {
  console.error('Gateway startup failed', error);
  process.exitCode = 1;
});
