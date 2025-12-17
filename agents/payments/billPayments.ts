
import { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';

export type BillType = 'airtime' | 'electricity' | 'betting' | 'internet' | 'tv';

export interface BillPaymentParams {
  walletId: string;
  userId: string;
  userToken: string;
  billType: BillType;
  provider: string;
  identifier: string; // Phone number, Meter number, Betting User ID
  amount: string; // Expected to be in smallest units (e.g. kobo) by the caller
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
  
  // Electricity (Nigeria)
  { id: 'aedc', name: 'AEDC', type: 'electricity' },
  { id: 'ekedc', name: 'EKEDC', type: 'electricity' },
  { id: 'ikedc', name: 'IKEDC', type: 'electricity' },
  { id: 'phedc', name: 'PHEDC', type: 'electricity' },
  { id: 'kaedco', name: 'KAEDCO', type: 'electricity' },
  { id: 'jedc', name: 'JEDC', type: 'electricity' },
  { id: 'ibedc', name: 'IBEDC', type: 'electricity' },
  
  // Internet (Nigeria)
  { id: 'spectranet', name: 'Spectranet', type: 'internet' },
  { id: 'smile', name: 'Smile', type: 'internet' },
  { id: 'swift', name: 'Swift', type: 'internet' },
  
  // TV/Cable (Nigeria)
  { id: 'dstv', name: 'DStv', type: 'tv' },
  { id: 'gotv', name: 'GOtv', type: 'tv' },
  { id: 'startimes', name: 'StarTimes', type: 'tv' },
  
  // Betting (Nigeria)
  { id: 'bet9ja', name: 'Bet9ja', type: 'betting' },
  { id: 'sportybet', name: 'SportyBet', type: 'betting' },
  { id: 'nairabet', name: 'Nairabet', type: 'betting' },
];

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY;
const FLW_BASE_URL = process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3';

if (!FLW_SECRET_KEY) {
  console.warn(
    '[BillPayments] FLW_SECRET_KEY is not set. Flutterwave bill payments will fail until configured.',
  );
}

async function callFlutterwaveBillsApi(path: string, body: any): Promise<any> {
  if (!FLW_SECRET_KEY) {
    throw new Error('Flutterwave secret key (FLW_SECRET_KEY) is not configured');
  }

  const response = await fetch(`${FLW_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FLW_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok || json.status !== 'success') {
    console.error('[BillPayments] Flutterwave bills API error:', json);
    throw new Error(json.message || 'Failed to execute bill payment via Flutterwave');
  }

  return json;
}

/**
 * Execute a real bill payment via Flutterwave Bills API.
 *
 * Supports: Airtime, Electricity, Internet, TV, Betting
 */
export async function executeBillPayment(params: BillPaymentParams): Promise<ExecutionResult> {
  // Convert smallest units (e.g. kobo) back to major units for Flutterwave
  const amountMinor = BigInt(params.amount);
  const amountMajor = Number(amountMinor) / 100; // NGN has 2 decimal places

  const reference = `arcle-bill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Map bill type to Flutterwave type
  const flutterwaveTypeMap: Record<BillType, string> = {
    airtime: 'AIRTIME',
    electricity: 'ELECTRICITY',
    internet: 'INTERNET',
    tv: 'CABLE',
    betting: 'BETTING',
  };

  const flutterwaveType = flutterwaveTypeMap[params.billType];
  
  if (!flutterwaveType) {
    return {
      success: false,
      executedViaSessionKey: false,
      error: `Bill type "${params.billType}" is not supported`,
    };
  }

  // Build payload based on bill type
  const payload: any = {
    country: 'NG',
    customer: params.identifier,
    amount: amountMajor,
    type: flutterwaveType,
    reference,
  };

  // For electricity, add biller_code and item_code
  if (params.billType === 'electricity') {
    payload.biller_code = params.provider.toUpperCase();
    payload.item_code = params.provider.toUpperCase();
  }

  // For TV/Cable, add biller_code
  if (params.billType === 'tv') {
    payload.biller_code = params.provider.toUpperCase();
  }

  // For Internet, add biller_code
  if (params.billType === 'internet') {
    payload.biller_code = params.provider.toUpperCase();
  }

  // For Betting, add biller_code
  if (params.billType === 'betting') {
    payload.biller_code = params.provider.toUpperCase();
  }

  try {
    const json = await callFlutterwaveBillsApi('/bills', payload);
    const data = json.data || {};

    return {
      success: true,
      executedViaSessionKey: true,
      transactionId: data.id ? String(data.id) : undefined,
      transactionHash: data.flw_reference || data.reference || reference,
      message: json.message || `Successfully paid ${params.billType} of ${amountMajor} NGN for ${params.identifier}`,
    };
  } catch (error: any) {
    return {
      success: false,
      executedViaSessionKey: false,
      error: error.message || `Failed to execute ${params.billType} payment`,
    };
  }
}

/**
 * Validate biller details.
 *
 * Validates provider and identifier based on bill type
 */
export async function validateBillerDetails(
  type: BillType,
  provider: string,
  identifier: string,
): Promise<{ isValid: boolean; name?: string; error?: string }> {
  const providerLower = provider.toLowerCase();
  const validProvider = SUPPORTED_BILLERS.find(
    (b) => b.type === type && (b.id === providerLower || b.name.toLowerCase() === providerLower),
  );

  if (!validProvider) {
    return {
      isValid: false,
      error: `Invalid or unsupported ${type} provider: ${provider}. Supported providers: ${SUPPORTED_BILLERS.filter(b => b.type === type).map(b => b.name).join(', ')}`,
    };
  }

  // Validate identifier based on bill type
  switch (type) {
    case 'airtime': {
      const phone = identifier.replace(/[^\d]/g, '');
      if (phone.length < 10 || phone.length > 15) {
        return { isValid: false, error: 'Invalid phone number for airtime purchase' };
      }
      return {
        isValid: true,
        name: `${validProvider.name} Airtime for ${phone}`,
      };
    }

    case 'electricity': {
      // Meter numbers are typically 10-13 digits
      const meterNumber = identifier.replace(/[^\d]/g, '');
      if (meterNumber.length < 10 || meterNumber.length > 13) {
        return { isValid: false, error: 'Invalid meter number format' };
      }
      return {
        isValid: true,
        name: `${validProvider.name} Electricity for meter ${meterNumber}`,
      };
    }

    case 'internet': {
      // Internet account numbers vary, but typically 8-15 characters
      const accountNumber = identifier.trim();
      if (accountNumber.length < 8 || accountNumber.length > 15) {
        return { isValid: false, error: 'Invalid internet account number format' };
      }
      return {
        isValid: true,
        name: `${validProvider.name} Internet for ${accountNumber}`,
      };
    }

    case 'tv': {
      // TV subscription numbers vary, typically 8-12 digits
      const subscriptionNumber = identifier.replace(/[^\d]/g, '');
      if (subscriptionNumber.length < 8 || subscriptionNumber.length > 12) {
        return { isValid: false, error: 'Invalid TV subscription number format' };
      }
      return {
        isValid: true,
        name: `${validProvider.name} subscription for ${subscriptionNumber}`,
      };
    }

    case 'betting': {
      // Betting account numbers vary, typically 6-15 characters
      const accountNumber = identifier.trim();
      if (accountNumber.length < 6 || accountNumber.length > 15) {
        return { isValid: false, error: 'Invalid betting account number format' };
      }
      return {
        isValid: true,
        name: `${validProvider.name} betting account ${accountNumber}`,
      };
    }

    default:
      return {
        isValid: false,
        error: `Validation for bill type "${type}" is not yet implemented`,
      };
  }
}
