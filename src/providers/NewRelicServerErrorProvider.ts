import { NewRelicErrorProvider, NewRelicErrorProviderType, NewRelicErrorProviderConfig } from './NewRelicErrorProvider';

export type NewRelicServerErrorProviderConfig = Omit<NewRelicErrorProviderConfig, 'type'> & {
  excludedeHosts?: [string]; // Keep the typo for backward compatibility
}


export class NewRelicServerErrorProvider extends NewRelicErrorProvider {
  public constructor(config: NewRelicServerErrorProviderConfig) {
    super({
      ...config,
      type: NewRelicErrorProviderType.SERVER,
      excludeHosts: config.excludedeHosts, // Map the typo to correct property
    });
  }
}
