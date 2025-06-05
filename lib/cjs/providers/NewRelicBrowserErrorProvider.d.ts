import { NewRelicErrorProvider, NewRelicErrorProviderConfig } from './NewRelicErrorProvider';
export declare type NewRelicBrowserErrorProviderConfig = Omit<NewRelicErrorProviderConfig, 'type'> & {
    excludedeHosts?: [string];
};
export declare class NewRelicBrowserErrorProvider extends NewRelicErrorProvider {
    constructor(config: NewRelicBrowserErrorProviderConfig);
}
