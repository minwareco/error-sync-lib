"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorType = exports.ErrorCountType = exports.ErrorPriority = void 0;
var ErrorPriority;
(function (ErrorPriority) {
    ErrorPriority["P1"] = "P1";
    ErrorPriority["P2"] = "P2";
    ErrorPriority["P3"] = "P3";
    ErrorPriority["P4"] = "P4";
    ErrorPriority["P5"] = "P5";
})(ErrorPriority = exports.ErrorPriority || (exports.ErrorPriority = {}));
var ErrorCountType;
(function (ErrorCountType) {
    ErrorCountType["USERS"] = "Users";
    ErrorCountType["TRX"] = "Transactions";
})(ErrorCountType = exports.ErrorCountType || (exports.ErrorCountType = {}));
var ErrorType;
(function (ErrorType) {
    ErrorType["CLIENT"] = "Client";
    ErrorType["SERVER"] = "Server";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
//# sourceMappingURL=Error.js.map