"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.premiumMiddleware = exports.rawBodyMiddleware = void 0;
const express_1 = __importDefault(require("express"));
exports.rawBodyMiddleware = express_1.default.raw({ type: 'application/json' });
const premiumMiddleware = async (req, res, next) => {
    try {
        next();
    }
    catch (error) {
        res.status(403).json({
            error: 'Premium access required',
            message: 'This feature requires a premium subscription'
        });
    }
};
exports.premiumMiddleware = premiumMiddleware;
//# sourceMappingURL=payments.middleware.js.map