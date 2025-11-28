import express, { Request, Response } from "express";
declare const router: import("express-serve-static-core").Router;
export declare const stripeWebhookHandler: (req: Request, res: Response) => Promise<express.Response<any, Record<string, any>> | undefined>;
export { router as paymentsRouter };
//# sourceMappingURL=payments.controller.d.ts.map