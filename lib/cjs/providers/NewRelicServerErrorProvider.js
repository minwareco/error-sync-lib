"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewRelicServerErrorProvider = void 0;
const NewRelicErrorProvider_1 = require("./NewRelicErrorProvider");
class NewRelicServerErrorProvider extends NewRelicErrorProvider_1.NewRelicErrorProvider {
    constructor(config) {
        super(Object.assign(Object.assign({}, config), { type: NewRelicErrorProvider_1.NewRelicErrorProviderType.SERVER, excludeHosts: config.excludedeHosts }));
    }
}
exports.NewRelicServerErrorProvider = NewRelicServerErrorProvider;
//# sourceMappingURL=NewRelicServerErrorProvider.js.map