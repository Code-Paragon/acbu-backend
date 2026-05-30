import { Router, type IRouter } from "express";
import {
  handleFlutterwaveWebhook,
  verifyFlutterwaveSignature,
  handlePaystackWebhook,
  verifyPaystackSignature,
  handleBillsWebhook,
} from "../controllers/webhookController";

const router: IRouter = Router();
// Content-Type validation is handled in index.ts before raw body parsing
router.post(
  "/flutterwave",
  verifyFlutterwaveSignature,
  handleFlutterwaveWebhook,
);
router.post("/paystack", verifyPaystackSignature, handlePaystackWebhook);
router.post("/bills/:provider", handleBillsWebhook);

export default router;
