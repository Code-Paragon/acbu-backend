import { Router, type IRouter } from "express";
import { registerOnRampSwap } from "../controllers/onrampController";
import { validateApiKey } from "../middleware/auth";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";

const router: IRouter = Router();
router.use(validateApiKey);
router.use(apiKeyRateLimiter);
/**
 * @swagger
 * tags:
 *   - name: On-Ramp
 *     description: Stellar USDC/XLM on-ramp registration
 */

/**
 * @swagger
 * /v1/onramp/register:
 *   post:
 *     tags:
 *       - On-Ramp
 *     summary: Register USDC to XLM swap
 *     description: Register a swap that occurred on Stellar to trigger ACBU minting.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stellar_address
 *               - xlm_amount
 *             properties:
 *               stellar_address:
 *                 type: string
 *               xlm_amount:
 *                 type: string
 *               usdc_amount:
 *                 type: string
 *     responses:
 *       202:
 *         description: On-ramp swap registered
 */
router.post("/register", registerOnRampSwap);
export default router;
