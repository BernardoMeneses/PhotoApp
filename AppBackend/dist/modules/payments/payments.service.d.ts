import Stripe from 'stripe';
export interface PaymentRecord {
    id: string;
    user_id: string;
    payment_method: 'stripe';
    amount_cents: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    subscription_type: 'monthly' | 'yearly' | 'one-time';
    stripe_session_id?: string;
    stripe_payment_intent_id?: string;
    stripe_subscription_id?: string;
    stripe_customer_id?: string;
    created_at: Date;
    updated_at: Date;
}
export interface SubscriptionRecord {
    id: string;
    user_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
    current_period_start: Date;
    current_period_end: Date;
    cancel_at_period_end: boolean;
    created_at: Date;
    updated_at: Date;
}
export declare class PaymentsService {
    private stripe;
    private pool;
    private readonly MONTHLY_PRICE_CENTS;
    private readonly YEARLY_PRICE_CENTS;
    private readonly CURRENCY;
    constructor();
    private getOrCreateStripeCustomer;
    createCheckoutSession(userId: string, successUrl: string, cancelUrl: string, subscriptionType: 'monthly' | 'yearly'): Promise<Stripe.Checkout.Session>;
    handleWebhook(payload: Buffer, signature: string): Promise<Stripe.Event>;
    private handleCheckoutSessionCompleted;
    private handlePaymentIntentSucceeded;
    private handlePaymentIntentFailed;
    checkPremiumStatus(userId: string): Promise<boolean>;
    private activatePremium;
    private createPaymentRecord;
    private updatePaymentStatus;
    getPaymentHistory(userId: string): Promise<PaymentRecord[]>;
    private handleSubscriptionCreated;
    private handleSubscriptionUpdated;
    private handleSubscriptionDeleted;
    private handleInvoicePaymentSucceeded;
    private handleInvoicePaymentFailed;
    private createSubscriptionRecord;
    private updateSubscriptionRecord;
    private updateSubscriptionStatus;
    private deactivatePremium;
    cancelSubscription(userId: string): Promise<void>;
}
//# sourceMappingURL=payments.service.d.ts.map