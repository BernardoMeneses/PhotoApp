import { Request, Response, NextFunction } from 'express';
import express from 'express';

/**
 * Middleware para capturar raw body necessário para webhooks do Stripe
 * Aplica raw parsing apenas para o endpoint de webhook
 */
export const rawBodyMiddleware = express.raw({ type: 'application/json' });

/**
 * Middleware para verificar se usuário tem acesso premium
 */
export const premiumMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Este middleware pode ser usado em endpoints que requerem premium
    // Por enquanto apenas passa adiante, mas pode ser expandido
    next();
  } catch (error) {
    res.status(403).json({ 
      error: 'Premium access required',
      message: 'This feature requires a premium subscription'
    });
  }
};