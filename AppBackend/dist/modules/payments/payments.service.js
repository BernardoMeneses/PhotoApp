"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const database_1 = require("../../config/database");
class PaymentsService {
    constructor() {
        this.PREMIUM_PRICE_CENTS = 999;
        this.CURRENCY = 'eur';
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            throw new Error('STRIPE_SECRET_KEY environment variable is required');
        }
        this.stripe = new stripe_1.default(stripeSecretKey, {
            apiVersion: '2025-10-29.clover'
        });
        this.pool = database_1.pool;
    }
    async createCheckoutSession(userId, successUrl, cancelUrl) {
        try {
            console.log(`🛒 Creating checkout session for user: ${userId}`);
            const isPremium = await this.checkPremiumStatus(userId);
            if (isPremium) {
                throw new Error('User is already premium');
            }
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                        price_data: {
                            currency: this.CURRENCY,
                            product_data: {
                                name: 'PhotoApp Premium',
                                description: 'Unlock unlimited photo storage and premium features',
                                images: ['https://via.placeholder.com/300x200?text=PhotoApp+Premium']
                            },
                            unit_amount: this.PREMIUM_PRICE_CENTS,
                        },
                        quantity: 1,
                    }],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: userId,
                metadata: {
                    user_id: userId,
                    product_type: 'premium_upgrade'
                }
            });
            await this.createPaymentRecord({
                user_id: userId,
                payment_method: 'stripe',
                amount_cents: this.PREMIUM_PRICE_CENTS,
                currency: this.CURRENCY,
                status: 'pending',
                stripe_session_id: session.id
            });
            console.log(`✅ Checkout session created: ${session.id}`);
            return session;
        }
        catch (error) {
            console.error('❌ Error creating checkout session:', error);
            throw error;
        }
    }
    async handleWebhook(payload, signature) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
        }
        try {
            const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
            console.log(`🎣 Processing webhook event: ${event.type}`);
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object);
                    break;
                case 'payment_intent.succeeded':
                    await this.handlePaymentIntentSucceeded(event.data.object);
                    break;
                case 'payment_intent.payment_failed':
                    await this.handlePaymentIntentFailed(event.data.object);
                    break;
                default:
                    console.log(`🤷 Unhandled event type: ${event.type}`);
            }
            return event;
        }
        catch (error) {
            console.error('❌ Webhook processing error:', error);
            throw error;
        }
    }
    async handleCheckoutSessionCompleted(session) {
        try {
            const userId = session.client_reference_id;
            if (!userId) {
                throw new Error('No user ID found in checkout session');
            }
            console.log(`💳 Checkout completed for user: ${userId}`);
            await this.updatePaymentStatus(session.id, 'completed', session.payment_intent);
            await this.activatePremium(userId);
            console.log(`🌟 Premium activated for user: ${userId}`);
        }
        catch (error) {
            console.error('❌ Error handling checkout completion:', error);
            throw error;
        }
    }
    async handlePaymentIntentSucceeded(paymentIntent) {
        console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    }
    async handlePaymentIntentFailed(paymentIntent) {
        try {
            console.log(`❌ Payment failed: ${paymentIntent.id}`);
            const query = `
        UPDATE payments 
        SET status = 'failed', updated_at = NOW()
        WHERE stripe_payment_intent_id = $1
      `;
            await this.pool.query(query, [paymentIntent.id]);
        }
        catch (error) {
            console.error('❌ Error handling payment failure:', error);
        }
    }
    async checkPremiumStatus(userId) {
        try {
            const query = 'SELECT is_premium FROM users WHERE id = $1';
            const result = await this.pool.query(query, [userId]);
            return result.rows[0]?.is_premium || false;
        }
        catch (error) {
            console.error('❌ Error checking premium status:', error);
            return false;
        }
    }
    async activatePremium(userId) {
        try {
            const query = `
        UPDATE users 
        SET is_premium = true, updated_at = NOW()
        WHERE id = $1
      `;
            const result = await this.pool.query(query, [userId]);
            if (result.rowCount === 0) {
                throw new Error(`User ${userId} not found`);
            }
            console.log(`🌟 Premium activated for user: ${userId}`);
        }
        catch (error) {
            console.error('❌ Error activating premium:', error);
            throw error;
        }
    }
    async createPaymentRecord(payment) {
        try {
            const query = `
        INSERT INTO payments (
          user_id, payment_method, amount_cents, currency, 
          status, stripe_session_id, stripe_payment_intent_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
            const values = [
                payment.user_id,
                payment.payment_method,
                payment.amount_cents,
                payment.currency,
                payment.status,
                payment.stripe_session_id || null,
                payment.stripe_payment_intent_id || null
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0].id;
        }
        catch (error) {
            console.error('❌ Error creating payment record:', error);
            throw error;
        }
    }
    async updatePaymentStatus(sessionId, status, paymentIntentId) {
        try {
            const query = `
        UPDATE payments 
        SET status = $1, stripe_payment_intent_id = $2, updated_at = NOW()
        WHERE stripe_session_id = $3
      `;
            await this.pool.query(query, [status, paymentIntentId || null, sessionId]);
        }
        catch (error) {
            console.error('❌ Error updating payment status:', error);
            throw error;
        }
    }
    async getPaymentHistory(userId) {
        try {
            const query = `
        SELECT * FROM payments 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
            const result = await this.pool.query(query, [userId]);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error fetching payment history:', error);
            throw error;
        }
    }
}
exports.PaymentsService = PaymentsService;
//# sourceMappingURL=payments.service.js.map