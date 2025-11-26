import Stripe from 'stripe';
export interface PaymentRecord {
    id: string;
    user_id: string;
    payment_method: 'stripe';
    amount_cents: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    stripe_session_id?: string;
    stripe_payment_intent_id?: string;
    created_at: Date;
    updated_at: Date;
}
export declare class PaymentsService {
    private stripe;
    private pool;
    private readonly PREMIUM_PRICE_CENTS;
    private readonly CURRENCY;
    constructor();
    createCheckoutSession(userId: string, successUrl: string, cancelUrl: string): Promise<Stripe.Checkout.Session>;
    handleWebhook(payload: Buffer, signature: string): Promise<Stripe.Event>;
    private handleCheckoutSessionCompleted;
    private handlePaymentIntentSucceeded;
    private handlePaymentIntentFailed;
    checkPremiumStatus(userId: string): Promise<boolean>;
    private activatePremium;
    private createPaymentRecord;
    private updatePaymentStatus;
    getPaymentHistory(userId: string): Promise<PaymentRecord[]>;
}
//# sourceMappingURL=payments.service.d.ts.map