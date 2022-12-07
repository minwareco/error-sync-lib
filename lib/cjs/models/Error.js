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
    ErrorCountType["USERS"] = "users";
    ErrorCountType["TRX"] = "transactions";
})(ErrorCountType = exports.ErrorCountType || (exports.ErrorCountType = {}));
var ErrorType;
(function (ErrorType) {
    ErrorType["BROWSER"] = "browser";
    ErrorType["CLIENT"] = "client";
    ErrorType["SERVER"] = "server";
})(ErrorType = exports.ErrorType || (exports.ErrorType = {}));
//# sourceMappingURL=Error.js.map