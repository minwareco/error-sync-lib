import { Error, ErrorCountType, ErrorType } from '../models';
import { ErrorProviderInterface } from '../interfaces';
import newrelicApi from 'newrelic-api-client';
import { NewRelicErrorProvider, NewRelicErrorProviderType, NewRelicErrorProviderConfig } from './NewRelicErrorProvider';

export type NewRelicBrowserErrorProviderConfig = Omit<NewRelicErrorProviderConfig, 'type'> & {
  excludedeHosts?: [string]; // Keep the typo for backward compatibility
}

export class NewRelicBrowserErrorProvider extends NewRelicErrorProvider {
  public constructor(config: NewRelicBrowserErrorProviderConfig) {
    super({
      ...config,
      type: NewRelicErrorProviderType.BROWSER,
      excludeHosts: config.excludedeHosts, // Map the typo to correct property
    });
  }
}
