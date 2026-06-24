/**
 * Paystack API client (Nigeria/NGN). Implements FintechProvider for balance and disbursement.
 * FX (convertCurrency) delegates to Flutterwave; use getProviderById('flutterwave') for rate fallback.
 */
import axios, { AxiosInstance } from "axios";
import { config } from "../../config/env";
import { logger } from "../../config/logger";
import { CircuitBreaker } from "../../utils/circuitBreaker"; // Import the class
import type {
  FintechProvider,
  DisburseRecipient,
  ConvertCurrencyResult,
  DisburseResult,
} from "../fintech/types";

export interface PaystackConfig {
  secretKey: string;
  baseUrl: string;
}

export class PaystackClient implements FintechProvider {
  private client: AxiosInstance;
  private fxFallback: FintechProvider | null;
  private breaker: CircuitBreaker;

  constructor(options?: {
    secretKey?: string;
    baseUrl?: string;
    fxFallback?: FintechProvider;
  }) {
    const paystackConfig = (config as { paystack?: PaystackConfig }).paystack;
    const secretKey = options?.secretKey ?? paystackConfig?.secretKey ?? "";
    const baseUrl =
      options?.baseUrl ?? paystackConfig?.baseUrl ?? "https://api.paystack.co";
    this.fxFallback = options?.fxFallback ?? null;
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      // REQUIREMENT 1: Lower the hard timeout from 30s to 5s so it fails fast
      timeout: 5000,
    });

    // REQUIREMENT 2: Create an isolated circuit breaker for Paystack
    this.breaker = new CircuitBreaker({
      failureThreshold: 5,
      cooldownMs: 30000,
      successThreshold: 2,
    });
  }

  /**
   * Helper method to execute requests safely through the circuit breaker with a simple retry strategy
   */
  private async requestWrapper<T>(requestFn: () => Promise<T>, retries = 2): Promise<T> {
    if (!this.breaker.canExecute()) {
      throw new Error("Paystack service is temporarily unavailable (Circuit Open)");
    }

    try {
      let attempt = 0;
      while (attempt <= retries) {
        try {
          const result = await requestFn();
          this.breaker.recordSuccess();
          return result;
        } catch (error: any) {
          attempt++;
          const isNetworkError = !error.response;
          const isServerError = error.response?.status >= 500;
          
          if (attempt > retries || (!isNetworkError && !isServerError)) {
            throw error;
          }
          
          // Exponential backoff delay
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
      throw new Error("Request failed after maximum retries");
    } catch (finalError) {
      this.breaker.recordFailure();
      throw finalError;
    }
  }

  async getBalance(currency: string): Promise<number> {
    try {
      // Execute through the circuit breaker wrapper
      const response = await this.requestWrapper(() => 
        this.client.get("/balance")
      );
      
      const data = response.data?.data;
      if (!data) throw new Error("Invalid balance response");
      // Paystack returns balance in subunits (kobo); ledger_balance or balance
      const balanceKobo = Number(data.balance ?? data.ledger_balance ?? 0);
      const balance = balanceKobo / 100;
      return balance;
    } catch (error) {
      logger.error("Failed to get balance from Paystack", { currency, error });
      throw error;
    }
  }

  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ConvertCurrencyResult> {
    if (this.fxFallback) {
      return this.fxFallback.convertCurrency(amount, fromCurrency, toCurrency);
    }
    throw new Error(
      "Paystack does not provide FX; use Flutterwave for convertCurrency or inject fxFallback",
    );
  }

  async disburseFunds(
    amount: number,
    currency: string,
    recipient: DisburseRecipient,
  ): Promise<DisburseResult> {
    try {
      // Execute through the circuit breaker wrapper
      const response = await this.requestWrapper(() =>
        this.client.post("/transfer", {
          source: "balance",
          amount: Math.round(amount * 100),
          recipient: recipient.bankCode,
          reason: "ACBU withdrawal",
          reference: `acbu-${Date.now()}`,
        })
      );
      
      const data = response.data?.data;
      return {
        transactionId:
          data?.transfer_code ?? data?.id ?? String(response.data?.data?.id),
        status: data?.status ?? "pending",
      };
    } catch (error) {
      logger.error("Failed to disburse funds via Paystack", {
        amount,
        currency,
        recipient,
        error,
      });
      throw error;
    }
  }
}

export const paystackClient = new PaystackClient();