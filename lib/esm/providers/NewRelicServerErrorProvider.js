import { NewRelicErrorProvider, NewRelicErrorProviderType } from './NewRelicErrorProvider';
export class NewRelicServerErrorProvider extends NewRelicErrorProvider {
    constructor(config) {
        super(Object.assign(Object.assign({}, config), { type: NewRelicErrorProviderType.SERVER, excludeHosts: config.excludedeHosts }));
    }
}
//# sourceMappingURL=NewRelicServerErrorProvider.js.map