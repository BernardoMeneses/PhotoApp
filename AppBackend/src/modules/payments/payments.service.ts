import Stripe from 'stripe';
import { Pool } from 'pg';
import { pool } from '../../config/database';

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

export class PaymentsService {
  private stripe: Stripe;
  private pool: Pool;
  private readonly MONTHLY_PRICE_CENTS = 999; // €9.99/mês
  private readonly YEARLY_PRICE_CENTS = 9999; // €99.99/ano (2 meses grátis)
  private readonly CURRENCY = 'eur';

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover'
    });
    this.pool = pool;
  }

  /**
   * Obter ou criar customer Stripe
   */
  private async getOrCreateStripeCustomer(userId: string): Promise<Stripe.Customer> {
    try {
      // Verificar se já existe customer para este usuário
      const query = 'SELECT stripe_customer_id FROM users WHERE id = $1';
      const result = await this.pool.query(query, [userId]);
      
      if (result.rows[0]?.stripe_customer_id) {
        // Buscar customer existente
        return await this.stripe.customers.retrieve(result.rows[0].stripe_customer_id) as Stripe.Customer;
      }
      
      // Criar novo customer
      const customer = await this.stripe.customers.create({
        metadata: {
          user_id: userId
        }
      });
      
      // Salvar customer_id no usuário
      const updateQuery = 'UPDATE users SET stripe_customer_id = $1 WHERE id = $2';
      await this.pool.query(updateQuery, [customer.id, userId]);
      
      return customer;
    } catch (error) {
      console.error('❌ Error getting/creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Criar sessão de checkout Stripe para upgrade premium
   */
  async createCheckoutSession(
    userId: string, 
    successUrl: string, 
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    try {
      console.log(`🛒 Creating checkout session for user: ${userId}`);

      // Verificar se usuário já é premium
      const isPremium = await this.checkPremiumStatus(userId);
      if (isPremium) {
        throw new Error('User is already premium');
      }

      // Criar ou obter customer Stripe
      const customer = await this.getOrCreateStripeCustomer(userId);

      // Criar sessão Stripe para subscrição
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: this.CURRENCY,
            product_data: {
              name: 'PhotoApp Premium',
              description: 'Unlimited photo storage and premium features - Monthly subscription'
            },
            unit_amount: this.MONTHLY_PRICE_CENTS,
            recurring: {
              interval: 'month'
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
          product_type: 'premium_subscription'
        },
        subscription_data: {
          metadata: {
            user_id: userId
          }
        }
      });

      // Registrar pagamento como pendente
      await this.createPaymentRecord({
        user_id: userId,
        payment_method: 'stripe',
        amount_cents: this.MONTHLY_PRICE_CENTS,
        currency: this.CURRENCY,
        status: 'pending',
        subscription_type: 'monthly',
        stripe_session_id: session.id,
        stripe_customer_id: customer.id
      });

      console.log(`✅ Checkout session created: ${session.id}`);
      return session;
    } catch (error) {
      console.error('❌ Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Processar webhook do Stripe
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      console.log(`🎣 Processing webhook event: ${event.type}`);

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
          
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
          
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
          
        default:
          console.log(`🤷 Unhandled event type: ${event.type}`);
      }

      return event;
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      throw error;
    }
  }

  /**
   * Processar checkout session completado
   */
  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    try {
      const userId = session.client_reference_id;
      if (!userId) {
        throw new Error('No user ID found in checkout session');
      }

      console.log(`💳 Checkout completed for user: ${userId}`);

      if (session.mode === 'subscription') {
        // Para subscrições, o webhook de subscription.created cuidará da ativação
        console.log(`🔄 Subscription checkout completed, waiting for subscription.created webhook`);
        
        // Atualizar status do pagamento inicial
        await this.updatePaymentStatus(session.id, 'completed', undefined, session.subscription as string);
      } else {
        // Para pagamentos únicos (se ainda houver)
        await this.updatePaymentStatus(session.id, 'completed', session.payment_intent as string);
        await this.activatePremium(userId);
      }
      
    } catch (error) {
      console.error('❌ Error handling checkout completion:', error);
      throw error;
    }
  }

  /**
   * Processar pagamento bem-sucedido
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    // Lógica adicional se necessário
  }

  /**
   * Processar pagamento falhado
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      console.log(`❌ Payment failed: ${paymentIntent.id}`);
      
      // Atualizar status do pagamento para falhado
      const query = `
        UPDATE payments 
        SET status = 'failed', updated_at = NOW()
        WHERE stripe_payment_intent_id = $1
      `;
      
      await this.pool.query(query, [paymentIntent.id]);
    } catch (error) {
      console.error('❌ Error handling payment failure:', error);
    }
  }

  /**
   * Verificar se usuário tem status premium
   */
  async checkPremiumStatus(userId: string): Promise<boolean> {
    try {
      const query = 'SELECT is_premium FROM users WHERE id = $1';
      const result = await this.pool.query(query, [userId]);
      
      return result.rows[0]?.is_premium || false;
    } catch (error) {
      console.error('❌ Error checking premium status:', error);
      return false;
    }
  }

  /**
   * Ativar premium para o usuário
   */
  private async activatePremium(userId: string): Promise<void> {
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
    } catch (error) {
      console.error('❌ Error activating premium:', error);
      throw error;
    }
  }

  /**
   * Criar registro de pagamento
   */
  private async createPaymentRecord(payment: Omit<PaymentRecord, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
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
    } catch (error) {
      console.error('❌ Error creating payment record:', error);
      throw error;
    }
  }

  /**
   * Atualizar status do pagamento
   */
  private async updatePaymentStatus(
    sessionId: string, 
    status: PaymentRecord['status'],
    paymentIntentId?: string,
    subscriptionId?: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE payments 
        SET status = $1, stripe_payment_intent_id = $2, stripe_subscription_id = $3, updated_at = NOW()
        WHERE stripe_session_id = $4
      `;
      
      await this.pool.query(query, [status, paymentIntentId || null, subscriptionId || null, sessionId]);
    } catch (error) {
      console.error('❌ Error updating payment status:', error);
      throw error;
    }
  }

  /**
   * Obter histórico de pagamentos do usuário
   */
  async getPaymentHistory(userId: string): Promise<PaymentRecord[]> {
    try {
      const query = `
        SELECT * FROM payments 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching payment history:', error);
      throw error;
    }
  }

  /**
   * Handler para subscrição criada
   */
  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.user_id;
      if (!userId) {
        console.error('❌ No user_id in subscription metadata');
        return;
      }

      console.log(`🔄 Subscription created for user: ${userId}`);

      // Criar registro de subscrição
      await this.createSubscriptionRecord(subscription, userId);
      
      // Ativar premium se subscrição estiver ativa
      if (subscription.status === 'active') {
        await this.activatePremium(userId);
      }
    } catch (error) {
      console.error('❌ Error handling subscription created:', error);
    }
  }

  /**
   * Handler para subscrição atualizada
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.user_id;
      if (!userId) {
        console.error('❌ No user_id in subscription metadata');
        return;
      }

      console.log(`🔄 Subscription updated for user: ${userId}, status: ${subscription.status}`);

      // Atualizar registro de subscrição
      await this.updateSubscriptionRecord(subscription);
      
      // Ativar ou desativar premium baseado no status
      if (subscription.status === 'active') {
        await this.activatePremium(userId);
      } else if (['canceled', 'past_due', 'incomplete'].includes(subscription.status)) {
        await this.deactivatePremium(userId);
      }
    } catch (error) {
      console.error('❌ Error handling subscription updated:', error);
    }
  }

  /**
   * Handler para subscrição cancelada
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      const userId = subscription.metadata.user_id;
      if (!userId) {
        console.error('❌ No user_id in subscription metadata');
        return;
      }

      console.log(`❌ Subscription deleted for user: ${userId}`);

      // Atualizar status da subscrição
      await this.updateSubscriptionStatus(subscription.id, 'canceled');
      
      // Desativar premium
      await this.deactivatePremium(userId);
    } catch (error) {
      console.error('❌ Error handling subscription deleted:', error);
    }
  }

  /**
   * Handler para pagamento de fatura bem-sucedido
   */
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      console.log(`✅ Invoice payment succeeded: ${invoice.id}`);
      
      // Para invoices de subscrição, buscar pela subscription na metadata ou customer
      const invoiceAny = invoice as any;
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
    } catch (error) {
      console.error('❌ Error handling invoice payment succeeded:', error);
    }
  }

  /**
   * Handler para pagamento de fatura falhado
   */
  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      console.log(`❌ Invoice payment failed: ${invoice.id}`);
      
      const invoiceAny = invoice as any;
      if (invoiceAny.subscription) {
        const subscription = await this.stripe.subscriptions.retrieve(invoiceAny.subscription);
        const userId = subscription.metadata?.user_id;
        
        if (userId) {
          // Registrar falha de pagamento
          await this.createPaymentRecord({
            user_id: userId,
            payment_method: 'stripe',
            amount_cents: invoice.amount_due || 0,
            currency: invoice.currency || 'eur',
            status: 'failed',
            subscription_type: 'monthly',
            stripe_subscription_id: subscription.id
          });
          
          // Considerar desativar premium após alguns falhas
          // Implementar lógica de retry/grace period se necessário
        }
      }
    } catch (error) {
      console.error('❌ Error handling invoice payment failed:', error);
    }
  }

  /**
   * Criar registro de subscrição
   */
  private async createSubscriptionRecord(subscription: Stripe.Subscription, userId: string): Promise<void> {
    try {
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
        new Date(((subscription as any).current_period_start || 0) * 1000),
        new Date(((subscription as any).current_period_end || 0) * 1000),
        (subscription as any).cancel_at_period_end || false
      ]);
    } catch (error) {
      console.error('❌ Error creating subscription record:', error);
      throw error;
    }
  }

  /**
   * Atualizar registro de subscrição
   */
  private async updateSubscriptionRecord(subscription: Stripe.Subscription): Promise<void> {
    try {
      const query = `
        UPDATE subscriptions 
        SET status = $1, current_period_start = $2, current_period_end = $3, 
            cancel_at_period_end = $4, updated_at = NOW()
        WHERE stripe_subscription_id = $5
      `;
      
      await this.pool.query(query, [
        subscription.status,
        new Date(((subscription as any).current_period_start || 0) * 1000),
        new Date(((subscription as any).current_period_end || 0) * 1000),
        (subscription as any).cancel_at_period_end || false,
        subscription.id
      ]);
    } catch (error) {
      console.error('❌ Error updating subscription record:', error);
      throw error;
    }
  }

  /**
   * Atualizar status da subscrição
   */
  private async updateSubscriptionStatus(subscriptionId: string, status: string): Promise<void> {
    try {
      const query = 'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2';
      await this.pool.query(query, [status, subscriptionId]);
    } catch (error) {
      console.error('❌ Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Desativar premium do usuário
   */
  private async deactivatePremium(userId: string): Promise<void> {
    try {
      const query = 'UPDATE users SET is_premium = false, updated_at = NOW() WHERE id = $1';
      const result = await this.pool.query(query, [userId]);
      
      if (result.rowCount === 0) {
        throw new Error(`User ${userId} not found`);
      }
      
      console.log(`🚫 Premium deactivated for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error deactivating premium:', error);
      throw error;
    }
  }

  /**
   * Cancelar subscrição do usuário
   */
  async cancelSubscription(userId: string): Promise<void> {
    try {
      const query = 'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1 AND status = $2';
      const result = await this.pool.query(query, [userId, 'active']);
      
      if (result.rows.length === 0) {
        throw new Error('No active subscription found');
      }
      
      const subscriptionId = result.rows[0].stripe_subscription_id;
      
      // Cancelar no Stripe (no final do período)
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
      
      console.log(`📋 Subscription marked for cancellation: ${subscriptionId}`);
    } catch (error) {
      console.error('❌ Error canceling subscription:', error);
      throw error;
    }
  }
}