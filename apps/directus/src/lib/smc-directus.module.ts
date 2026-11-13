import { DynamicModule, Global, Module } from '@nestjs/common';
import { DirectusConfig } from '../types/config';
import { DIRECTUS_CONFIG } from './constants';
import { SmcDirectusShareFunctionService } from './share/share-function';
import { SmcDirectusService } from './smc-directus.service';

@Global()
@Module({})
export class SmcDirectusModule {
  static register(config: DirectusConfig): DynamicModule {
    return {
      module: SmcDirectusModule,
      providers: [
        { provide: DIRECTUS_CONFIG, useValue: config },
        {
          provide: SmcDirectusService,
          useFactory: (directusConfig: DirectusConfig) =>
            new SmcDirectusService(directusConfig),
          inject: [DIRECTUS_CONFIG],
        },
        SmcDirectusShareFunctionService,
      ],
      exports: [SmcDirectusService, SmcDirectusShareFunctionService],
    };
  }
}
