"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewRelicBrowserErrorProvider = void 0;
const NewRelicErrorProvider_1 = require("./NewRelicErrorProvider");
class NewRelicBrowserErrorProvider extends NewRelicErrorProvider_1.NewRelicErrorProvider {
    constructor(config) {
        super({
            ...config,
            type: NewRelicErrorProvider_1.NewRelicErrorProviderType.BROWSER,
            excludeHosts: config.excludedeHosts,
        });
    }
}
exports.NewRelicBrowserErrorProvider = NewRelicBrowserErrorProvider;
//# sourceMappingURL=NewRelicBrowserErrorProvider.js.map