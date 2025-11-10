/**
 * FX Rate Service
 * 
 * Fetches real-time exchange rates for stablecoin pairs using Circle API
 * Circle API provides official exchange rates for USDC ↔ EURC conversions
 * 
 * Circle API Documentation:
 * - Exchange Rate: https://developers.circle.com/api-reference/circle-mint/cross-currency/exchange-rate
 * - Create FX Trade: https://developers.circle.com/api-reference/circle-mint/cross-currency/create-fx-trade
 */

export interface FXRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
  source: string;
}

export interface FXRateResponse {
  success: boolean;
  rate?: FXRate;
  error?: string;
}

// Cache for FX rates (5 minute TTL)
const rateCache = new Map<string, { rate: FXRate; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get FX rate between two currencies
 * 
 * @param from - Source currency (e.g., "USDC")
 * @param to - Target currency (e.g., "EURC")
 * @param forceRefresh - Force refresh from API
 */
export async function getFXRate(
  from: string,
  to: string,
  forceRefresh: boolean = false
): Promise<FXRateResponse> {
  try {
    const cacheKey = `${from}-${to}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = rateCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return {
          success: true,
          rate: cached.rate,
        };
      }
    }
    
    // Try Circle API first (official rates for USDC ↔ EURC)
    try {
      const rate = await fetchFromCircleAPI(from, to);
      if (rate) {
        // Cache the rate
        rateCache.set(cacheKey, {
          rate,
          expires: Date.now() + CACHE_TTL,
        });
        return {
          success: true,
          rate,
        };
      }
    } catch (error) {
      console.warn("Circle API FX rate fetch failed:", error);
    }
    
    // Fallback: Use CoinGecko for rates if Circle API is unavailable
    try {
      const rate = await fetchFromCoinGecko(from, to);
      if (rate) {
        // Cache the rate
        rateCache.set(cacheKey, {
          rate,
          expires: Date.now() + CACHE_TTL,
        });
        return {
          success: true,
          rate,
        };
      }
    } catch (error) {
      console.warn("CoinGecko FX rate fetch failed:", error);
    }
    
    // Final fallback: Use approximate rate based on USD/EUR
    // For stablecoins, rates are typically very close to 1:1 with small variations
    const approximateRate = await getApproximateRate(from, to);
    
    if (approximateRate) {
      const rate: FXRate = {
        from,
        to,
        rate: approximateRate,
        timestamp: Date.now(),
        source: "approximate",
      };
      
      // Cache the approximate rate
      rateCache.set(cacheKey, {
        rate,
        expires: Date.now() + CACHE_TTL,
      });
      
      return {
        success: true,
        rate,
      };
    }
    
    return {
      success: false,
      error: "Could not fetch FX rate",
    };
  } catch (error) {
    console.error("Error fetching FX rate:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Fetch rate from Circle API
 * Uses Circle's Cross-Currency Exchange Rate endpoint
 */
async function fetchFromCircleAPI(from: string, to: string): Promise<FXRate | null> {
  try {
    // Circle API supports USDC ↔ EURC conversions
    // Note: Circle Mint API endpoint for exchange rates
    // For Developer Controlled Wallets, we may need to use a different approach
    
    // Check if this is a supported Circle currency pair
    const supportedPairs = [
      { from: "USDC", to: "EURC" },
      { from: "EURC", to: "USDC" },
    ];
    
    const isSupported = supportedPairs.some(
      pair => pair.from === from.toUpperCase() && pair.to === to.toUpperCase()
    );
    
    if (!isSupported) {
      return null; // Circle API only supports USDC ↔ EURC
    }
    
    // Import Circle API helper
    const { circleApiRequest } = await import("@/lib/circle");
    
    // Circle Mint API endpoint for exchange rates
    // Format: GET /v1/mint/exchange-rates?baseCurrency=USDC&quoteCurrency=EURC
    // Note: This might be Circle Mint API, not Wallets API
    // For Wallets API, we might need to use a different endpoint
    
    try {
      const response = await circleApiRequest<any>(
        `/v1/mint/exchange-rates?baseCurrency=${from.toUpperCase()}&quoteCurrency=${to.toUpperCase()}`
      );
      
      if (response && response.data && response.data.rate) {
        return {
          from: from.toUpperCase(),
          to: to.toUpperCase(),
          rate: parseFloat(response.data.rate),
          timestamp: Date.now(),
          source: "circle",
        };
      }
    } catch (mintError) {
      // Circle Mint API might not be available, try alternative approach
      console.warn("Circle Mint API not available, trying alternative:", mintError);
    }
    
    // Alternative: Use Circle's indicative rate from their documentation
    // For now, return null to fall back to CoinGecko
    // In production, you would use Circle's official FX rate endpoint
    return null;
  } catch (error) {
    console.warn("Circle API fetch error:", error);
    return null;
  }
}

/**
 * Fetch rate from CoinGecko (fallback)
 */
async function fetchFromCoinGecko(from: string, to: string): Promise<FXRate | null> {
  try {
    // Map currencies to CoinGecko IDs
    const coinGeckoMap: Record<string, string> = {
      USDC: "usd-coin",
      EURC: "euro-coin",
    };
    
    const fromId = coinGeckoMap[from.toUpperCase()];
    const toId = coinGeckoMap[to.toUpperCase()];
    
    if (!fromId || !toId) {
      return null;
    }
    
    // CoinGecko API: Get simple price
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${fromId},${toId}&vs_currencies=usd`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    const fromPrice = data[fromId]?.usd;
    const toPrice = data[toId]?.usd;
    
    if (!fromPrice || !toPrice) {
      return null;
    }
    
    // Calculate rate: 1 from = ? to
    const rate = fromPrice / toPrice;
    
    return {
      from,
      to,
      rate,
      timestamp: Date.now(),
      source: "coingecko",
    };
  } catch (error) {
    console.warn("CoinGecko fetch error:", error);
    return null;
  }
}

/**
 * Get approximate rate based on USD/EUR conversion
 * For stablecoins, this is usually very close to actual rate
 */
async function getApproximateRate(from: string, to: string): Promise<number | null> {
  // For stablecoins, rates are typically very close to 1:1
  // USDC is pegged to USD, EURC is pegged to EUR
  // So USDC/EURC ≈ USD/EUR
  
  if (from === to) {
    return 1.0;
  }
  
  // USDC to EURC: Use USD/EUR rate (approximately 0.92-0.93)
  if (from === "USDC" && to === "EURC") {
    // Try to get real USD/EUR rate, fallback to approximate
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD",
        { signal: AbortSignal.timeout(5000) }
      );
      if (response.ok) {
        const data = await response.json();
        return data.rates?.EUR || 0.92; // Fallback to approximate
      }
    } catch (error) {
      console.warn("Exchange rate API failed, using approximate:", error);
    }
    return 0.92; // Approximate USD/EUR rate
  }
  
  // EURC to USDC: Inverse
  if (from === "EURC" && to === "USDC") {
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/EUR",
        { signal: AbortSignal.timeout(5000) }
      );
      if (response.ok) {
        const data = await response.json();
        return data.rates?.USD || 1.09; // Fallback to approximate
      }
    } catch (error) {
      console.warn("Exchange rate API failed, using approximate:", error);
    }
    return 1.09; // Approximate EUR/USD rate
  }
  
  return null;
}

/**
 * Get multiple FX rates at once
 */
export async function getMultipleFXRates(
  pairs: Array<{ from: string; to: string }>
): Promise<Map<string, FXRate>> {
  const rates = new Map<string, FXRate>();
  
  await Promise.all(
    pairs.map(async (pair) => {
      const result = await getFXRate(pair.from, pair.to);
      if (result.success && result.rate) {
        rates.set(`${pair.from}-${pair.to}`, result.rate);
      }
    })
  );
  
  return rates;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: string,
  from: string,
  to: string
): Promise<{ success: boolean; convertedAmount?: string; rate?: number; error?: string }> {
  try {
    const rateResult = await getFXRate(from, to);
    
    if (!rateResult.success || !rateResult.rate) {
      return {
        success: false,
        error: rateResult.error || "Could not fetch exchange rate",
      };
    }
    
    const amountNum = parseFloat(amount);
    const convertedAmount = (amountNum * rateResult.rate.rate).toFixed(6);
    
    return {
      success: true,
      convertedAmount,
      rate: rateResult.rate.rate,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Conversion failed",
    };
  }
}

