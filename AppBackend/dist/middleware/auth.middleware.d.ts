import { Request, Response, NextFunction } from "express";
export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string;
        email_verified: boolean;
    };
    body: any;
}
export declare const authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=auth.middleware.d.ts.map