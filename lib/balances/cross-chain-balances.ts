/**
 * Cross-Chain Balance Aggregation
 * 
 * Fetches USDC balances across multiple chains and provides consolidation
 */

import { getArcClient } from "@/lib/arc";
import { createPublicClient, http, type PublicClient } from "viem";
import { base, arbitrum, sepolia } from "viem/chains";

export interface ChainBalance {
  chain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  balance: string; // USDC amount
  address: string;
  usdcAddress: string;
}

export interface AggregatedBalances {
  total: string; // Total USDC across all chains
  chains: ChainBalance[];
}

// USDC addresses on different chains (testnet)
const USDC_ADDRESSES = {
  ARC: process.env.NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS || "0x...", // Arc testnet USDC
  BASE: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
  ARBITRUM: "0x75faf114eafb1BDbe2F0316DF893fd58cE45D4f7", // Arbitrum Sepolia USDC
  ETH: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Ethereum Sepolia USDC
} as const;

// RPC URLs
const RPC_URLS = {
  ARC: process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network",
  BASE: "https://sepolia.base.org",
  ARBITRUM: "https://sepolia-rollup.arbitrum.io/rpc",
  ETH: "https://rpc.sepolia.org",
} as const;

/**
 * Get USDC balance for a specific chain
 */
export async function getChainBalance(
  chain: "ARC" | "BASE" | "ARBITRUM" | "ETH",
  address: string
): Promise<ChainBalance> {
  try {
    let balance = "0";

    if (chain === "ARC") {
      // Use Arc client to query real USDC balance
      const client = getArcClient();
      const { getUSDCAddress, arcUtils } = await import("../arc");
      const { erc20Abi } = await import("viem");
      
      try {
        const usdcAddress = getUSDCAddress();
        const result = await client.readContract({
          address: usdcAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        balance = arcUtils.formatUSDC(result);
      } catch (error) {
        console.error("Error fetching ARC balance:", error);
        balance = "0";
      }
    } else {
      // Use Viem for other chains
      const publicClient = createPublicClient({
        chain: chain === "BASE" ? base : chain === "ARBITRUM" ? arbitrum : sepolia,
        transport: http(RPC_URLS[chain]),
      });

      // Get ERC20 balance
      const usdcAddress = USDC_ADDRESSES[chain] as `0x${string}`;
      const result = await publicClient.readContract({
        address: usdcAddress,
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "balance", type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      // Convert from 6 decimals (USDC) to readable format
      balance = (Number(result) / 1e6).toFixed(2);
    }

    return {
      chain,
      balance,
      address,
      usdcAddress: USDC_ADDRESSES[chain],
    };
  } catch (error) {
    console.error(`Error fetching ${chain} balance:`, error);
    return {
      chain,
      balance: "0",
      address,
      usdcAddress: USDC_ADDRESSES[chain],
    };
  }
}

/**
 * Aggregate balances across all chains
 */
export async function aggregateBalances(address: string): Promise<AggregatedBalances> {
  const chains: ChainBalance[] = await Promise.all([
    getChainBalance("ARC", address),
    getChainBalance("BASE", address),
    getChainBalance("ARBITRUM", address),
    getChainBalance("ETH", address),
  ]);

  const total = chains.reduce((sum, chain) => {
    return sum + parseFloat(chain.balance);
  }, 0);

  return {
    total: total.toFixed(2),
    chains: chains.filter(c => parseFloat(c.balance) > 0), // Only show chains with balance
  };
}

/**
 * Consolidate balances to Arc (bridge all to Arc)
 */
export async function consolidateToArc(
  walletId: string,
  address: string
): Promise<Array<{ chain: string; bridgeId: string }>> {
  const balances = await aggregateBalances(address);
  
  // Filter out Arc (already on Arc) and chains with zero balance
  const chainsToBridge = balances.chains.filter(
    c => c.chain !== "ARC" && parseFloat(c.balance) > 0
  );

  const bridgePromises = chainsToBridge.map(async (chain) => {
    const { initiateBridge } = await import("../bridge/cctp-bridge");
    const bridge = await initiateBridge({
      walletId,
      amount: chain.balance,
      fromChain: chain.chain,
      toChain: "ARC",
      destinationAddress: address,
    });
    return {
      chain: chain.chain,
      bridgeId: bridge.bridgeId,
    };
  });

  return Promise.all(bridgePromises);
}


