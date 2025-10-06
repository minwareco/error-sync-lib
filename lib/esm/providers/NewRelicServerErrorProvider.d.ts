import { NewRelicErrorProvider, NewRelicErrorProviderConfig } from './NewRelicErrorProvider';
export type NewRelicServerErrorProviderConfig = Omit<NewRelicErrorProviderConfig, 'type'> & {
    excludedeHosts?: [string];
};
export declare class NewRelicServerErrorProvider extends NewRelicErrorProvider {
    constructor(config: NewRelicServerErrorProviderConfig);
}
