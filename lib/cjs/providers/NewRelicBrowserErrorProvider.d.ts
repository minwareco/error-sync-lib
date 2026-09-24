import { NewRelicErrorProvider, type NewRelicErrorProviderConfig } from './NewRelicErrorProvider';
export type NewRelicBrowserErrorProviderConfig = Omit<NewRelicErrorProviderConfig, 'type'> & {
    excludedeHosts?: [string];
};
export declare class NewRelicBrowserErrorProvider extends NewRelicErrorProvider {
    constructor(config: NewRelicBrowserErrorProviderConfig);
}
