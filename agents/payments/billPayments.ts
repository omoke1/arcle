
import { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';

export type BillType = 'airtime' | 'electricity' | 'betting' | 'internet' | 'tv';

export interface BillPaymentParams {
  walletId: string;
  userId: string;
  userToken: string;
  billType: BillType;
  provider: string;
  identifier: string; // Phone number, Meter number, Betting User ID
  amount: string;
}

export interface BillerProvider {
  id: string;
  name: string;
  type: BillType;
}

export const SUPPORTED_BILLERS: BillerProvider[] = [
  // Airtime
  { id: 'mtn', name: 'MTN', type: 'airtime' },
  { id: 'glo', name: 'Glo', type: 'airtime' },
  { id: 'airtel', name: 'Airtel', type: 'airtime' },
  { id: '9mobile', name: '9mobile', type: 'airtime' },
  
  // Electricity
  { id: 'ikeja_electric', name: 'Ikeja Electric', type: 'electricity' },
  { id: 'eko_electric', name: 'Eko Electric', type: 'electricity' },
  { id: 'abuja_electric', name: 'Abuja Electricity', type: 'electricity' },
  
  // Betting
  { id: 'bet9ja', name: 'Bet9ja', type: 'betting' },
  { id: 'sportybet', name: 'SportyBet', type: 'betting' },
  { id: '1xbet', name: '1xBet', type: 'betting' },
];

/**
 * Mock implementation of bill payment execution
 * In a real app, this would call an aggregator API like VTPass, Reloadly, etc.
 */
export async function executeBillPayment(params: BillPaymentParams): Promise<ExecutionResult> {
  console.log(`Executing ${params.billType} payment to ${params.provider} for ${params.identifier} amount ${params.amount}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Mock success response
  return {
    success: true,
    transactionHash: '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2),
    executedViaSessionKey: true, // Assuming small amounts can be auto-executed
    message: `Successfully paid ${params.amount} to ${params.provider} (${params.identifier})`
  };
}

/**
 * Validate biller details (Mock)
 */
export async function validateBillerDetails(type: BillType, provider: string, identifier: string): Promise<{ isValid: boolean; name?: string; error?: string }> {
  // Simulate validation
  await new Promise(resolve => setTimeout(resolve, 500));

  const validProvider = SUPPORTED_BILLERS.find(b => b.id === provider.toLowerCase() || b.name.toLowerCase() === provider.toLowerCase());
  
  if (!validProvider) {
    return { isValid: false, error: 'Invalid provider' };
  }

  if (type !== validProvider.type) {
      return { isValid: false, error: `Provider ${provider} does not support ${type}` };
  }

  // Mock customer name lookup
  return { 
    isValid: true, 
    name: `Customer ${identifier.slice(-4)}` 
  };
}
