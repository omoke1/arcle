/**
 * FX Integration for Remittances
 * 
 * Handles currency conversion for cross-border remittances
 * Now fully integrated with FX Agent and real FX rate services
 */

import { INERAAgent } from '@/agents/inera';
import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';
import { convertCurrency, getFXRate as getFXRateService } from '@/lib/fx/fx-rates';

export interface FXConversionParams {
  walletId: string;
  userId: string;
  userToken: string;
  amount: string;
  fromCurrency: string;
  toCurrency: string;
}

/**
 * Convert currency for remittance
 * 
 * This function:
 * 1. Gets real FX rate from Circle API, CoinGecko, or approximate sources
 * 2. Calculates converted amount
 * 3. Returns conversion result (does not execute on-chain swap)
 * 
 * Note: For actual on-chain currency swaps, use Circle's FX trade API or DEX
 */
export async function convertCurrencyForRemittance(params: FXConversionParams): Promise<ExecutionResult> {
  try {
    // Get FX rate using the real FX rate service
    const conversion = await convertCurrency(
      params.amount,
      params.fromCurrency.toUpperCase(),
      params.toCurrency.toUpperCase()
    );

    if (!conversion.success || !conversion.convertedAmount || conversion.rate === undefined) {
      return {
        success: false,
        executedViaSessionKey: false,
        error: conversion.error || 'Failed to convert currency',
      };
    }

    // Return conversion result
    // Note: This is a calculation, not an on-chain swap
    // For actual swaps, you would need to use Circle's FX trade API or a DEX
    return {
      success: true,
      executedViaSessionKey: false,
      message: `Converted ${params.amount} ${params.fromCurrency} to ${conversion.convertedAmount} ${params.toCurrency} at rate ${conversion.rate.toFixed(6)}`,
      data: {
        originalAmount: params.amount,
        convertedAmount: conversion.convertedAmount,
        fromCurrency: params.fromCurrency.toUpperCase(),
        toCurrency: params.toCurrency.toUpperCase(),
        rate: conversion.rate,
        note: 'This is a rate calculation. For on-chain swaps, use Circle FX trade API or DEX.',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      executedViaSessionKey: false,
      error: error.message || 'Currency conversion failed',
    };
  }
}

/**
 * Get FX rate for currency pair
 * 
 * Uses real FX rate service (Circle API, CoinGecko, or approximate)
 */
export async function getFXRate(fromCurrency: string, toCurrency: string): Promise<{
  rate: string;
  timestamp: number;
  source?: string;
}> {
  try {
    const rateResult = await getFXRateService(
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase()
    );

    if (!rateResult.success || !rateResult.rate) {
      // Fallback to approximate rate
      return {
        rate: '1.0',
        timestamp: Date.now(),
        source: 'approximate',
      };
    }

    return {
      rate: rateResult.rate.rate.toString(),
      timestamp: rateResult.rate.timestamp,
      source: rateResult.rate.source,
    };
  } catch (error) {
    console.error('[Remittance FX] Error fetching rate:', error);
    return {
      rate: '1.0',
      timestamp: Date.now(),
      source: 'fallback',
    };
  }
}

