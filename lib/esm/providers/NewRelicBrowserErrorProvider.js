import { NewRelicErrorProvider, NewRelicErrorProviderType } from './NewRelicErrorProvider';
export class NewRelicBrowserErrorProvider extends NewRelicErrorProvider {
    constructor(config) {
        super(Object.assign(Object.assign({}, config), { type: NewRelicErrorProviderType.BROWSER, excludeHosts: config.excludedeHosts }));
    }
}
//# sourceMappingURL=NewRelicBrowserErrorProvider.js.map