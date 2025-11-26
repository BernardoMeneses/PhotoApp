# 💳 PhotoApp Payments Module

Sistema de **subscrições mensais premium** com integração Stripe para o PhotoApp.

## 🚀 Funcionalidades

- ✅ **Subscrições Mensais**: €9.99/mês recorrente
- ✅ **Checkout Premium**: Criação de sessões Stripe para subscrição
- ✅ **Webhooks**: Processamento automático de eventos Stripe
- ✅ **Status Premium**: Verificação do status de assinatura
- ✅ **Cancelamento**: Cancelar subscrição (mantém até fim do período)
- ✅ **Histórico**: Consulta de pagamentos realizados
- ✅ **Customer Management**: Gestão de customers Stripe
- ✅ **Database Integration**: Persistência completa de dados
- ✅ **Segurança**: Autenticação Firebase + validação Stripe

## 📁 Estrutura

```
src/modules/payments/
├── payments.controller.ts    # Endpoints REST
├── payments.service.ts       # Lógica de negócio
├── index.ts                 # Exports do módulo
└── README.md               # Esta documentação

src/middleware/
└── payments.middleware.ts   # Middleware para raw body (webhooks)

database_setup.sql          # Setup das tabelas
test-payments.html         # Interface de teste
.env.stripe.example        # Exemplo de variáveis de ambiente
```

## 🗄️ Database Schema

### Tabela `users`
```sql
ALTER TABLE users ADD COLUMN is_premium BOOLEAN DEFAULT FALSE;
```

### Tabela `payments`
```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('stripe')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'eur',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_session_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Setup

### 1. Instalar Dependências
```bash
npm install stripe @types/stripe
```

### 2. Configurar Variáveis de Ambiente
Copie `.env.stripe.example` para `.env` e configure:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Setup Database
```bash
psql -d photoapp_db -f database_setup.sql
```

### 4. Configurar Webhook Stripe
No [Dashboard Stripe](https://dashboard.stripe.com/webhooks):
- URL: `https://your-domain.com/payments/webhook`
- Eventos: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

## 🛠️ Endpoints

### POST `/payments/create-checkout-session`
Cria sessão de checkout para upgrade premium.

**Headers:**
```
Authorization: Bearer <firebase_token>
Content-Type: application/json
```

**Body:**
```json
{
  "successUrl": "http://localhost:3001/payment/success",
  "cancelUrl": "http://localhost:3001/payment/cancel"
}
```

**Response:**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/pay/cs_..."
}
```

### POST `/payments/webhook`
Webhook para processar eventos Stripe.

**Headers:**
```
stripe-signature: <webhook_signature>
```

### GET `/payments/premium-status`
Verifica status premium do usuário.

**Headers:**
```
Authorization: Bearer <firebase_token>
```

**Response:**
```json
{
  "userId": "user_123",
  "isPremium": true
}
```

### GET `/payments/history`
Obtém histórico de pagamentos do usuário.

**Headers:**
```
Authorization: Bearer <firebase_token>
```

**Response:**
```json
{
  "payments": [
    {
      "id": "1",
      "user_id": "user_123",
      "payment_method": "stripe",
      "amount_cents": 999,
      "currency": "eur",
      "status": "completed",
      "stripe_session_id": "cs_...",
      "stripe_payment_intent_id": "pi_...",
      "created_at": "2025-11-18T10:00:00Z",
      "updated_at": "2025-11-18T10:05:00Z"
    }
  ]
}
```

## 🧪 Teste

### Interface de Teste
Acesse `http://localhost:3000/test-payments.html` para interface interativa de testes.

### Cartões de Teste Stripe
- **Sucesso**: `4242424242424242`
- **Falha**: `4000000000000002`
- **3D Secure**: `4000002760003184`

### Teste de Webhooks
```bash
# Instalar Stripe CLI
npm install -g stripe-cli

# Login
stripe login

# Escutar webhooks
stripe listen --forward-to localhost:3000/payments/webhook

# Simular eventos
stripe trigger checkout.session.completed
```

## 🔒 Segurança

- ✅ **Autenticação**: Firebase Auth obrigatória
- ✅ **Validação Webhook**: Verificação de assinatura Stripe
- ✅ **Raw Body**: Middleware especial para webhooks
- ✅ **Sanitização**: Validação de inputs
- ✅ **Rate Limiting**: Implementar se necessário

## 📊 Monitoramento

### Logs
```bash
# Verificar logs de pagamentos
grep "💳\|🎯\|❌" server.log

# Dashboard Stripe
https://dashboard.stripe.com/payments
```

### Métricas Importantes
- Taxa de conversão de checkout
- Pagamentos falhados
- Tempo médio de processamento
- Webhooks com falha

## 🚀 Deploy

### Variáveis de Produção
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Verificações
- [ ] Webhooks configurados para produção
- [ ] Chaves live do Stripe configuradas
- [ ] SSL/HTTPS ativo
- [ ] Database backup configurado
- [ ] Logs de auditoria ativos

## 🔄 Fluxo de Pagamento

1. **Frontend** → POST `/payments/create-checkout-session`
2. **Backend** → Cria sessão Stripe + registro pendente
3. **Frontend** → Redireciona para Stripe Checkout
4. **Usuário** → Completa pagamento
5. **Stripe** → Envia webhook `checkout.session.completed`
6. **Backend** → Ativa premium + atualiza status
7. **Frontend** → Verifica status com `/payments/premium-status`

## 🆘 Troubleshooting

### Webhook não funciona
- Verificar `STRIPE_WEBHOOK_SECRET`
- Conferir URL do webhook no dashboard
- Testar com Stripe CLI

### Pagamento não ativa premium
- Verificar logs do webhook
- Confirmar `client_reference_id` na sessão
- Verificar status na tabela `payments`

### Erro de autenticação
- Verificar token Firebase válido
- Confirmar usuário existe na tabela `users`

## 📚 Recursos

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [API Documentation](http://localhost:3000/docs)