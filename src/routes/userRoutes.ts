import { Router } from "express";
import {
  getMe,
  patchMe,
  deleteMe,
  getReceive,
  getReceiveQrcode,
  getMeBalance,
  postWalletConfirm,
  postWalletActivate,
  putWalletAddress,
  deleteWallet,
  postContacts,
  getContacts,
  deleteContact,
  postGuardians,
  getGuardians,
  deleteGuardian,
} from "../controllers/userController";
import { validateApiKey } from "../middleware/auth";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";

const router: ReturnType<typeof Router> = Router();

router.use(validateApiKey);
router.use(apiKeyRateLimiter);

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User profile, wallet, and contact management
 */

/**
 * @swagger
 * /v1/users/me:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user profile
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *   patch:
 *     tags:
 *       - Users
 *     summary: Update user profile
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 example: alice@placeholder.test
 *               phone_e164:
 *                 type: string
 *                 example: "+0000000000"
 *               privacy_hide_from_search:
 *                 type: boolean
 *               passcode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete user account
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       204:
 *         description: Account deleted successfully
 */
router.get("/me", getMe);
router.patch("/me", patchMe);
router.delete("/me", deleteMe);
router.get("/me/receive", getReceive);
router.get("/me/receive/qrcode", getReceiveQrcode);
router.get("/me/balance", getMeBalance);
router.post("/me/wallet/confirm", postWalletConfirm);
router.post("/me/wallet/activate", postWalletActivate);
router.put("/me/wallet", putWalletAddress);
router.delete("/me/wallet", deleteWallet);
router.post("/me/contacts", postContacts);
router.get("/me/contacts", getContacts);
router.delete("/me/contacts/:id", deleteContact);

/**
 * @swagger
 * /v1/users/me/guardians:
 *   get:
 *     tags:
 *       - Users
 *     summary: List guardians
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Guardians retrieved successfully
 *   post:
 *     tags:
 *       - Users
 *     summary: Add guardian
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guardian_user_id:
 *                 type: string
 *                 format: uuid
 *               guardian_email:
 *                 type: string
 *                 format: email
 *                 example: guardian@placeholder.test
 *               guardian_phone:
 *                 type: string
 *                 example: "+0000000000"
 *     responses:
 *       201:
 *         description: Guardian added successfully
 */
router.post("/me/guardians", postGuardians);
router.get("/me/guardians", getGuardians);
router.delete("/me/guardians/:id", deleteGuardian);

export default router;
