import { Router, type IRouter } from "express";
import { burnAcbu } from "../controllers/burnController";
import { validateApiKey } from "../middleware/auth";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";

const router: IRouter = Router();
router.use(validateApiKey);
router.use(apiKeyRateLimiter);
/**
 * @swagger
 * tags:
 *   - name: Burn
 *     description: Asset burning and redemptions
 */

/**
 * @swagger
 * /v1/burn/acbu:
 *   post:
 *     tags:
 *       - Burn
 *     summary: Burn ACBU for local currency
 *     description: Burn ACBU tokens to receive local currency (NGN, KES, etc.).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - acbu_amount
 *               - currency
 *               - recipient_account
 *             properties:
 *               acbu_amount:
 *                 type: string
 *               currency:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *               recipient_account:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [bank, mobile_money]
 *                   account_number:
 *                     type: string
 *                   bank_code:
 *                     type: string
 *                   account_name:
 *                     type: string
 *               blockchain_tx_hash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Burn request accepted
 */
router.post("/acbu", burnAcbu);
export default router;
