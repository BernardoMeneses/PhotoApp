"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = __importStar(require("express"));
const payments_service_1 = require("./payments.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
exports.paymentsRouter = router;
const paymentsService = new payments_service_1.PaymentsService();
router.post("/create-checkout-session", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        console.log(`💳 Creating checkout session for user: ${req.user.uid}`);
        const { successUrl, cancelUrl } = req.body;
        if (!successUrl || !cancelUrl) {
            return res.status(400).json({
                error: "Success URL and Cancel URL are required"
            });
        }
        const session = await paymentsService.createCheckoutSession(req.user.uid, successUrl, cancelUrl);
        res.json({
            sessionId: session.id,
            url: session.url
        });
    }
    catch (error) {
        console.error("❌ Error creating checkout session:", error);
        res.status(500).json({
            error: "Failed to create checkout session",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
router.post("/webhook", express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return res.status(400).json({ error: "Missing stripe signature" });
        }
        console.log("🎣 Received Stripe webhook");
        const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body, 'utf8');
        const event = await paymentsService.handleWebhook(payload, sig);
        console.log(`✅ Processed webhook event: ${event.type}`);
        res.json({ received: true });
    }
    catch (error) {
        console.error("❌ Error processing webhook:", error);
        res.status(400).json({
            error: "Webhook processing failed",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
router.get("/premium-status", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const isPremium = await paymentsService.checkPremiumStatus(req.user.uid);
        res.json({
            userId: req.user.uid,
            isPremium
        });
    }
    catch (error) {
        console.error("❌ Error checking premium status:", error);
        res.status(500).json({
            error: "Failed to check premium status",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
router.get("/history", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const payments = await paymentsService.getPaymentHistory(req.user.uid);
        res.json({ payments });
    }
    catch (error) {
        console.error("❌ Error fetching payment history:", error);
        res.status(500).json({
            error: "Failed to fetch payment history",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
//# sourceMappingURL=payments.controller.js.map