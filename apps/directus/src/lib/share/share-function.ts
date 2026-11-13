import { Inject, Injectable } from '@nestjs/common';
import { DirectusConfig } from '../../types/config';
import { DIRECTUS_CONFIG } from '../constants';

export interface TranslationModel {
  id: string;
  translations: Record<string, Record<string, unknown> | undefined>;
}

export interface IconModel {
  id: string;
  icon: string;
}

@Injectable()
export class SmcDirectusShareFunctionService {
  private readonly directusPublicUrl: string;

  constructor(@Inject(DIRECTUS_CONFIG) config: DirectusConfig) {
    this.directusPublicUrl = config.publicUrl ?? config.url;
  }

  mappingData<T extends { id: string; icon?: unknown }>(
    items: T[],
    icons: IconModel[],
    collection: string
  ): T[] {
    const iconMap = new Map(icons.map((item) => [item.id, item.icon]));

    return items.map((item) => {
      const icon = iconMap.get(`${collection}.${item.id}`);
      if (!icon) {
        return item;
      }

      const assetUrl = new URL(
        `assets/${encodeURIComponent(icon)}`,
        this.directusPublicUrl.endsWith('/')
          ? this.directusPublicUrl
          : `${this.directusPublicUrl}/`
      ).toString();
      return { ...item, icon: assetUrl };
    });
  }

  mapTextWithTranslations<T extends Record<string, unknown>>(
    items: T[],
    translations: TranslationModel[],
    collection: string,
    language: string,
    keyName: string
  ): T[] {
    const translationMap = new Map(
      translations.map((item) => [item.id, item.translations])
    );

    return items.map((item) => {
      const translation = translationMap.get(
        `${collection}.${String(item['id'] ?? '')}`
      )?.[language]?.[keyName];
      if (typeof translation !== 'string') {
        return item;
      }
      return { ...item, [keyName]: translation };
    });
  }
}
