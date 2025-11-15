/**
 * Multi-Token Balance Management
 * 
 * Handles fetching and formatting token balances for wallets
 */

export interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  decimals: number;
  usdValue?: string;
}

export interface TokenBalanceResponse {
  tokens: TokenBalance[];
  totalValueUSD: string;
  walletId: string;
  blockchain: string;
}

/**
 * Fetch all token balances for a wallet
 */
export async function getTokenBalances(
  walletId: string,
  blockchain: string = "ARC-TESTNET"
): Promise<TokenBalanceResponse | null> {
  try {
    const response = await fetch(
      `/api/circle/tokens?walletId=${walletId}&blockchain=${blockchain}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch token balances: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch token balances");
    }

    return data.data;
  } catch (error: any) {
    console.error("[Token Balance] Error:", error);
    return null;
  }
}

/**
 * Format token balance for display
 */
export function formatTokenBalance(token: TokenBalance): string {
  const amount = parseFloat(token.amount).toFixed(2);
  
  if (token.usdValue) {
    return `${amount} ${token.symbol} ($${token.usdValue})`;
  }
  
  return `${amount} ${token.symbol}`;
}

/**
 * Format all tokens for AI response
 */
export function formatTokensForAI(tokens: TokenBalance[], totalValueUSD: string): string {
  if (tokens.length === 0) {
    return "You don't have any tokens yet. Want to get some testnet tokens?";
  }

  const tokenLines = tokens.map(token => {
    const amount = parseFloat(token.amount).toFixed(2);
    if (token.usdValue) {
      return `  • ${amount} ${token.symbol} ($${token.usdValue})`;
    }
    return `  • ${amount} ${token.symbol}`;
  });

  let message = "Here's what you have:\n\n" + tokenLines.join("\n");

  if (parseFloat(totalValueUSD) > 0) {
    message += `\n\nTotal value: $${totalValueUSD}`;
  }

  return message;
}



