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
        this.MONTHLY_PRICE_CENTS = 999;
        this.YEARLY_PRICE_CENTS = 9999;
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
    async getOrCreateStripeCustomer(userId) {
        try {
            const query = 'SELECT stripe_customer_id FROM users WHERE id = $1';
            const result = await this.pool.query(query, [userId]);
            if (result.rows[0]?.stripe_customer_id) {
                return await this.stripe.customers.retrieve(result.rows[0].stripe_customer_id);
            }
            const customer = await this.stripe.customers.create({
                metadata: {
                    user_id: userId
                }
            });
            const updateQuery = 'UPDATE users SET stripe_customer_id = $1 WHERE id = $2';
            await this.pool.query(updateQuery, [customer.id, userId]);
            return customer;
        }
        catch (error) {
            console.error('❌ Error getting/creating Stripe customer:', error);
            throw error;
        }
    }
    async createCheckoutSession(userId, successUrl, cancelUrl, subscriptionType) {
        try {
            console.log(`🛒 Creating checkout session for user: ${userId}`);
            const isPremium = await this.checkPremiumStatus(userId);
            if (isPremium) {
                throw new Error('User is already premium');
            }
            const customer = await this.getOrCreateStripeCustomer(userId);
            const priceCents = subscriptionType === 'yearly' ? this.YEARLY_PRICE_CENTS : this.MONTHLY_PRICE_CENTS;
            const interval = subscriptionType === 'yearly' ? 'year' : 'month';
            const description = subscriptionType === 'yearly'
                ? 'Unlimited photo storage and premium features - Yearly subscription'
                : 'Unlimited photo storage and premium features - Monthly subscription';
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                        price_data: {
                            currency: this.CURRENCY,
                            product_data: {
                                name: 'PhotoApp Premium',
                                description
                            },
                            unit_amount: priceCents,
                            recurring: {
                                interval
                            }
                        },
                        quantity: 1,
                    }],
                mode: 'subscription',
                customer: customer.id,
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: userId,
                metadata: {
                    user_id: userId,
                    product_type: 'premium_subscription',
                    subscription_type: subscriptionType
                },
                subscription_data: {
                    metadata: {
                        user_id: userId,
                        subscription_type: subscriptionType
                    }
                }
            });
            await this.createPaymentRecord({
                user_id: userId,
                payment_method: 'stripe',
                amount_cents: priceCents,
                currency: this.CURRENCY,
                status: 'pending',
                subscription_type: subscriptionType,
                stripe_session_id: session.id,
                stripe_customer_id: customer.id
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
                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                case 'invoice.payment_succeeded':
                    await this.handleInvoicePaymentSucceeded(event.data.object);
                    break;
                case 'invoice.payment_failed':
                    await this.handleInvoicePaymentFailed(event.data.object);
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
            if (session.mode === 'subscription') {
                console.log(`🔄 Subscription checkout completed, waiting for subscription.created webhook`);
                await this.updatePaymentStatus(session.id, 'completed', undefined, session.subscription);
                await this.activatePremium(userId);
            }
            else {
                await this.updatePaymentStatus(session.id, 'completed', session.payment_intent);
                await this.activatePremium(userId);
            }
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
          status, subscription_type, stripe_session_id, stripe_payment_intent_id,
          stripe_subscription_id, stripe_customer_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;
            const values = [
                payment.user_id,
                payment.payment_method,
                payment.amount_cents,
                payment.currency,
                payment.status,
                payment.subscription_type,
                payment.stripe_session_id || null,
                payment.stripe_payment_intent_id || null,
                payment.stripe_subscription_id || null,
                payment.stripe_customer_id || null
            ];
            const result = await this.pool.query(query, values);
            return result.rows[0].id;
        }
        catch (error) {
            console.error('❌ Error creating payment record:', error);
            throw error;
        }
    }
    async updatePaymentStatus(sessionId, status, paymentIntentId, subscriptionId) {
        try {
            const query = `
        UPDATE payments 
        SET status = $1, stripe_payment_intent_id = $2, stripe_subscription_id = $3, updated_at = NOW()
        WHERE stripe_session_id = $4
      `;
            await this.pool.query(query, [status, paymentIntentId || null, subscriptionId || null, sessionId]);
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
    async handleSubscriptionCreated(subscription) {
        try {
            const userId = subscription.metadata.user_id;
            if (!userId) {
                console.error('❌ No user_id in subscription metadata');
                return;
            }
            console.log(`🔄 Subscription created for user: ${userId}`);
            await this.createSubscriptionRecord(subscription, userId);
            if (subscription.status === 'active') {
                await this.activatePremium(userId);
            }
        }
        catch (error) {
            console.error('❌ Error handling subscription created:', error);
        }
    }
    async handleSubscriptionUpdated(subscription) {
        try {
            const userId = subscription.metadata.user_id;
            if (!userId) {
                console.error('❌ No user_id in subscription metadata');
                return;
            }
            console.log(`🔄 Subscription updated for user: ${userId}, status: ${subscription.status}`);
            await this.updateSubscriptionRecord(subscription);
            if (subscription.status === 'active') {
                await this.activatePremium(userId);
            }
            else if (['canceled', 'past_due', 'incomplete'].includes(subscription.status)) {
                await this.deactivatePremium(userId);
            }
        }
        catch (error) {
            console.error('❌ Error handling subscription updated:', error);
        }
    }
    async handleSubscriptionDeleted(subscription) {
        try {
            const userId = subscription.metadata.user_id;
            if (!userId) {
                console.error('❌ No user_id in subscription metadata');
                return;
            }
            console.log(`❌ Subscription deleted for user: ${userId}`);
            await this.updateSubscriptionStatus(subscription.id, 'canceled');
            await this.deactivatePremium(userId);
        }
        catch (error) {
            console.error('❌ Error handling subscription deleted:', error);
        }
    }
    async handleInvoicePaymentSucceeded(invoice) {
        try {
            console.log(`✅ Invoice payment succeeded: ${invoice.id}`);
            const invoiceAny = invoice;
            if (invoiceAny.subscription) {
                const subscription = await this.stripe.subscriptions.retrieve(invoiceAny.subscription);
                const userId = subscription.metadata?.user_id;
                if (userId) {
                    await this.createPaymentRecord({
                        user_id: userId,
                        payment_method: 'stripe',
                        amount_cents: invoice.amount_paid || 0,
                        currency: invoice.currency || 'eur',
                        status: 'completed',
                        subscription_type: 'monthly',
                        stripe_subscription_id: subscription.id,
                        stripe_payment_intent_id: invoiceAny.payment_intent || undefined
                    });
                }
            }
        }
        catch (error) {
            console.error('❌ Error handling invoice payment succeeded:', error);
        }
    }
    async handleInvoicePaymentFailed(invoice) {
        try {
            console.log(`❌ Invoice payment failed: ${invoice.id}`);
            const invoiceAny = invoice;
            if (invoiceAny.subscription) {
                const subscription = await this.stripe.subscriptions.retrieve(invoiceAny.subscription);
                const userId = subscription.metadata?.user_id;
                if (userId) {
                    await this.createPaymentRecord({
                        user_id: userId,
                        payment_method: 'stripe',
                        amount_cents: invoice.amount_due || 0,
                        currency: invoice.currency || 'eur',
                        status: 'failed',
                        subscription_type: 'monthly',
                        stripe_subscription_id: subscription.id
                    });
                }
            }
        }
        catch (error) {
            console.error('❌ Error handling invoice payment failed:', error);
        }
    }
    async createSubscriptionRecord(subscription, userId) {
        try {
            const subscriptionType = subscription.metadata?.subscription_type || 'monthly';
            const now = new Date();
            let periodEnd;
            if (subscriptionType === 'yearly') {
                periodEnd = new Date(now);
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            }
            else {
                periodEnd = new Date(now);
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }
            const query = `
        INSERT INTO subscriptions (
          user_id, stripe_customer_id, stripe_subscription_id, status,
          current_period_start, current_period_end, cancel_at_period_end
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (stripe_subscription_id) 
        DO UPDATE SET 
          status = $4,
          current_period_start = $5,
          current_period_end = $6,
          cancel_at_period_end = $7,
          updated_at = NOW()
      `;
            await this.pool.query(query, [
                userId,
                subscription.customer,
                subscription.id,
                subscription.status,
                now,
                periodEnd,
                subscription.cancel_at_period_end || false
            ]);
        }
        catch (error) {
            console.error('❌ Error creating subscription record:', error);
            throw error;
        }
    }
    async updateSubscriptionRecord(subscription) {
        try {
            const query = `
        UPDATE subscriptions 
        SET status = $1, current_period_start = $2, current_period_end = $3, 
            cancel_at_period_end = $4, updated_at = NOW()
        WHERE stripe_subscription_id = $5
      `;
            await this.pool.query(query, [
                subscription.status,
                new Date((subscription.current_period_start || 0) * 1000),
                new Date((subscription.current_period_end || 0) * 1000),
                subscription.cancel_at_period_end || false,
                subscription.id
            ]);
        }
        catch (error) {
            console.error('❌ Error updating subscription record:', error);
            throw error;
        }
    }
    async updateSubscriptionStatus(subscriptionId, status) {
        try {
            const query = 'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2';
            await this.pool.query(query, [status, subscriptionId]);
        }
        catch (error) {
            console.error('❌ Error updating subscription status:', error);
            throw error;
        }
    }
    async deactivatePremium(userId) {
        try {
            const query = 'UPDATE users SET is_premium = false, updated_at = NOW() WHERE id = $1';
            const result = await this.pool.query(query, [userId]);
            if (result.rowCount === 0) {
                throw new Error(`User ${userId} not found`);
            }
            console.log(`🚫 Premium deactivated for user: ${userId}`);
        }
        catch (error) {
            console.error('❌ Error deactivating premium:', error);
            throw error;
        }
    }
    async cancelSubscription(userId) {
        try {
            const query = 'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1 AND status = $2';
            const result = await this.pool.query(query, [userId, 'active']);
            if (result.rows.length === 0) {
                throw new Error('No active subscription found');
            }
            const subscriptionId = result.rows[0].stripe_subscription_id;
            await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: true
            });
            console.log(`📋 Subscription marked for cancellation: ${subscriptionId}`);
        }
        catch (error) {
            console.error('❌ Error canceling subscription:', error);
            throw error;
        }
    }
}
exports.PaymentsService = PaymentsService;
//# sourceMappingURL=payments.service.js.map