/**
 * Multi-Currency Balance Service
 * 
 * Fetches balances for multiple currencies (USDC, EURC, etc.)
 * from Circle API
 */

import { circleApiRequest } from "@/lib/circle";
import { getCurrencyAddress, formatCurrency, type CurrencyBalance, type MultiCurrencyBalance, type SupportedCurrency } from "./currency-service";
import { getFXRate } from "./fx-rates";

interface CircleTokenBalance {
  tokenId?: string;
  token?: {
    id: string;
    symbol: string;
    name: string;
    blockchain: string;
  };
  amount: string;
  updateDate?: string;
}

interface CircleBalanceResponse {
  data: CircleTokenBalance[] | {
    tokenBalances?: CircleTokenBalance[];
  };
}

/**
 * Get all currency balances for a wallet
 */
export async function getMultiCurrencyBalance(
  walletId: string,
  blockchain: string = "ARC-TESTNET"
): Promise<MultiCurrencyBalance> {
  try {
    const balances = await circleApiRequest<CircleBalanceResponse>(
      `/v1/w3s/wallets/${walletId}/balances`,
      { method: "GET" }
    );
    
    // Handle different response formats
    const tokenBalances: CircleTokenBalance[] = 
      Array.isArray(balances.data)
        ? balances.data
        : balances.data?.tokenBalances || [];
    
    const currencyBalances: CurrencyBalance[] = [];
    const supportedCurrencies: SupportedCurrency[] = ["USDC", "EURC"];
    
    // Process each token balance
    for (const tokenBalance of tokenBalances) {
      const token = tokenBalance.token;
      const tokenId = tokenBalance.tokenId || token?.id;
      const symbol = token?.symbol?.toUpperCase();
      const amount = BigInt(tokenBalance.amount || "0");
      
      // Check if it's a supported currency
      if (symbol && supportedCurrencies.includes(symbol as SupportedCurrency)) {
        const currency = symbol as SupportedCurrency;
        const address = getCurrencyAddress(currency, blockchain);
        
        currencyBalances.push({
          currency,
          amount: formatCurrency(amount, currency),
          amountRaw: amount.toString(),
          tokenId,
          blockchain: token?.blockchain || blockchain,
          lastUpdated: tokenBalance.updateDate,
        });
      }
    }
    
    // Calculate total value in USD
    let totalValueUSD = 0;
    for (const balance of currencyBalances) {
      if (balance.currency === "USDC") {
        totalValueUSD += parseFloat(balance.amount);
      } else if (balance.currency === "EURC") {
        // Convert EURC to USD
        const rateResult = await getFXRate("EURC", "USDC");
        if (rateResult.success && rateResult.rate) {
          totalValueUSD += parseFloat(balance.amount) * rateResult.rate.rate;
        } else {
          // Fallback: approximate EURC as 1.09 USD
          totalValueUSD += parseFloat(balance.amount) * 1.09;
        }
      }
    }
    
    return {
      walletId,
      balances: currencyBalances,
      totalValueUSD: totalValueUSD.toFixed(2),
    };
  } catch (error) {
    console.error("Error fetching multi-currency balance:", error);
    throw error;
  }
}

/**
 * Get balance for a specific currency
 */
export async function getCurrencyBalance(
  walletId: string,
  currency: SupportedCurrency,
  blockchain: string = "ARC-TESTNET"
): Promise<CurrencyBalance | null> {
  const multiBalance = await getMultiCurrencyBalance(walletId, blockchain);
  return multiBalance.balances.find(b => b.currency === currency) || null;
}

