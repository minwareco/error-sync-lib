import { NewRelicErrorProvider, NewRelicErrorProviderType } from './NewRelicErrorProvider';
export class NewRelicBrowserErrorProvider extends NewRelicErrorProvider {
    constructor(config) {
        super({
            ...config,
            type: NewRelicErrorProviderType.BROWSER,
            excludeHosts: config.excludedeHosts,
        });
    }
}
//# sourceMappingURL=NewRelicBrowserErrorProvider.js.map