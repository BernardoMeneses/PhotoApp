"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = exports.stripeWebhookHandler = void 0;
const express_1 = require("express");
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
        const { successUrl, cancelUrl, subscriptionType } = req.body;
        if (!successUrl || !cancelUrl) {
            return res.status(400).json({
                error: "Success URL and Cancel URL are required"
            });
        }
        if (!subscriptionType || !["monthly", "yearly"].includes(subscriptionType)) {
            return res.status(400).json({
                error: "subscriptionType must be 'monthly' ou 'yearly'"
            });
        }
        const session = await paymentsService.createCheckoutSession(req.user.uid, successUrl, cancelUrl, subscriptionType);
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
const stripeWebhookHandler = async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return res.status(400).json({ error: "Missing stripe signature" });
        }
        console.log("🎣 Received Stripe webhook");
        const event = await paymentsService.handleWebhook(req.body, sig);
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
};
exports.stripeWebhookHandler = stripeWebhookHandler;
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
router.post("/cancel-subscription", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        console.log(`🚫 Canceling subscription for user: ${req.user.uid}`);
        await paymentsService.cancelSubscription(req.user.uid);
        res.json({
            message: "Subscription will be canceled at the end of current period",
            success: true
        });
    }
    catch (error) {
        console.error("❌ Error canceling subscription:", error);
        res.status(500).json({
            error: "Failed to cancel subscription",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
});
//# sourceMappingURL=payments.controller.js.map