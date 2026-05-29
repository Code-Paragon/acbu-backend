import axios, { AxiosInstance } from "axios";
import { config } from "../../config/env";
import { logger } from "../../config/logger";
import { CircuitBreaker } from "../../utils/circuitBreaker"; // Import the class, not the instance
import type {
  FintechProvider,
  DisburseRecipient,
  ConvertCurrencyResult,
  DisburseResult,
} from "../fintech/types";

export class FlutterwaveClient implements FintechProvider {
  private client: AxiosInstance;
  private breaker: CircuitBreaker;

  constructor() {
    this.client = axios.create({
      baseURL: config.flutterwave.baseUrl,
      headers: {
        Authorization: `Bearer ${config.flutterwave.secretKey}`,
        "Content-Type": "application/json",
      },
      // REQUIREMENT 1: Lower the hard timeout from 30s to 5s so it fails fast
      timeout: 5000, 
    });

    // REQUIREMENT 2: Create a dedicated circuit breaker for Flutterwave
    this.breaker = new CircuitBreaker({
      failureThreshold: 5,
      cooldownMs: 30000, // 30 seconds cooldown
      successThreshold: 2,
    });

    // Request interceptor (kept exactly as you have it)
    this.client.interceptors.request.use(
      (requestConfig) => {
        logger.debug("Flutterwave API Request", {
          method: requestConfig.method,
          url: requestConfig.url,
        });
        return requestConfig;
      },
      (error) => {
        logger.error("Flutterwave API Request Error", error);
        return Promise.reject(error);
      },
    );

    // Response interceptor (kept exactly as you have it)
    this.client.interceptors.response.use(
      (response) => {
        logger.debug("Flutterwave API Response", {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error("Flutterwave API Response Error", {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url,
        });
        return Promise.reject(error);
      },
    );
  }

  /**
   * Helper method to execute requests safely through the circuit breaker with a simple retry strategy
   */
  private async requestWrapper<T>(requestFn: () => Promise<T>, retries = 2): Promise<T> {
    // 1. Check if the circuit allows execution
    if (!this.breaker.canExecute()) {
      throw new Error("Flutterwave service is temporarily unavailable (Circuit Open)");
    }

    try {
      let attempt = 0;
      while (attempt <= retries) {
        try {
          const result = await requestFn();
          // 2. Record success if the call completes successfully
          this.breaker.recordSuccess();
          return result;
        } catch (error: any) {
          attempt++;
          // Only retry on temporary network errors or 5xx server issues; fail immediately on bad data/4xx
          const isNetworkError = !error.response;
          const isServerError = error.response?.status >= 500;
          
          if (attempt > retries || (!isNetworkError && !isServerError)) {
            throw error; // Let the outer block catch and record the final failure
          }
          
          // Exponential backoff delay before retrying
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
      throw new Error("Request failed after maximum retries");
    } catch (finalError) {
      // 3. Record failure to trip the circuit breaker if thresholds are crossed
      this.breaker.recordFailure();
      throw finalError;
    }
  }

  /**
   * Get account balance for a specific currency
   */
  async getBalance(currency: string): Promise<number> {
    try {
      const response = await this.requestWrapper(() => 
        this.client.get(`/balances/${currency}`)
      );
      return parseFloat(response.data.data.balance);
    } catch (error) {
      logger.error("Failed to get balance from Flutterwave", {
        currency,
        error,
      });
      throw error;
    }
  }

  /**
   * Convert currency using Flutterwave FX API
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ConvertCurrencyResult> {
    try {
      const response = await this.requestWrapper(() => 
        this.client.post("/currency/conversions", {
          amount,
          from: fromCurrency,
          to: toCurrency,
        })
      );
      return {
        amount: parseFloat(response.data.data.amount),
        rate: parseFloat(response.data.data.rate),
      };
    } catch (error) {
      logger.error("Failed to convert currency via Flutterwave", {
        amount,
        fromCurrency,
        toCurrency,
        error,
      });
      throw error;
    }
  }

  /**
   * Disburse funds to a recipient
   */
  async disburseFunds(
    amount: number,
    currency: string,
    recipient: DisburseRecipient,
  ): Promise<DisburseResult> {
    try {
      const response = await this.requestWrapper(() => 
        this.client.post("/transfers", {
          account_bank: recipient.bankCode,
          account_number: recipient.accountNumber,
          amount,
          currency,
          narration: "ACBU withdrawal",
          beneficiary_name: recipient.accountName,
        })
      );

      return {
        transactionId: response.data.data.id,
        status: response.data.data.status,
      };
    } catch (error) {
      logger.error("Failed to disburse funds via Flutterwave", {
        amount,
        currency,
        recipient,
        error,
      });
      throw error;
    }
  }
}

const client = new FlutterwaveClient();
export const flutterwaveClient = client;
export const flutterwaveProvider: FintechProvider = client;