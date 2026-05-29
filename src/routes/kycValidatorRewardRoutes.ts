import { Router } from "express";
import {
  createReward,
  listRewards,
} from "../controllers/kycValidatorRewardController";
import { validateApiKey } from "../middleware/auth";
import { apiKeyRateLimiter } from "../middleware/rateLimiter";

const router: ReturnType<typeof Router> = Router();

router.use(validateApiKey);
router.use(apiKeyRateLimiter);

router.post("/rewards", createReward);
router.get("/validators/:validatorId/rewards", listRewards);

export default router;
