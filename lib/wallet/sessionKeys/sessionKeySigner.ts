/**
 * Session Key Signer
 * 
 * Signs transactions with session keys for automatic execution
 * Builds ERC-4337 UserOps and submits to bundler
 */

import { ethers } from 'ethers';
import type { WalletActionParams } from './delegateExecution';
import type { CircleSessionKey } from './sessionPermissions';

export interface UserOperation {
  sender: string; // MSCA wallet address
  nonce: bigint;
  initCode: string; // Empty for existing wallets
  callData: string; // Encoded function call
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string; // For gas sponsorship
  signature: string; // Session key signature
}

export interface SignedUserOperation extends UserOperation {
  hash: string; // UserOp hash
}

/**
 * Build ERC-4337 UserOperation for a transaction
 */
export async function buildUserOperation(
  params: WalletActionParams,
  sessionKey: CircleSessionKey,
  mscaAddress: string
): Promise<UserOperation> {
  // Get current nonce for the MSCA wallet
  const { getNonce } = await import('../msca/rpcProvider');
  const nonce = await getNonce(mscaAddress);

  // Build callData based on action type
  const callData = await buildCallData(params, mscaAddress);

  // Estimate gas
  const { estimateGas } = await import('../msca/rpcProvider');
  const estimatedGas = await estimateGas(
    mscaAddress,
    params.contractAddress || params.destinationAddress || ethers.ZeroAddress,
    callData,
    params.amount ? BigInt(params.amount) : 0n
  );

  // ERC-4337 gas limits
  const callGasLimit = estimatedGas;
  const verificationGasLimit = 100000n; // Standard verification gas
  const preVerificationGas = 21000n; // Base transaction cost

  // Get current gas prices
  const { getGasPrices } = await import('../msca/rpcProvider');
  const { maxFeePerGas, maxPriorityFeePerGas } = await getGasPrices();

  const userOp: UserOperation = {
    sender: mscaAddress,
    nonce,
    initCode: '0x', // Empty for existing wallets
    callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    paymasterAndData: '0x', // Will be filled by paymaster if gas sponsored
    signature: '0x', // Will be filled after signing
  };

  return userOp;
}

/**
 * Build callData for different action types
 */
async function buildCallData(
  params: WalletActionParams,
  mscaAddress: string
): Promise<string> {
  const iface = new ethers.Interface([
    // Transfer ERC-20 (USDC)
    'function transfer(address to, uint256 amount) external returns (bool)',
    // Approve
    'function approve(address spender, uint256 amount) external returns (bool)',
    // Generic contract call
    'function execute(address target, uint256 value, bytes calldata data) external',
  ]);

  switch (params.action) {
    case 'transfer':
      if (!params.destinationAddress || !params.amount) {
        throw new Error('Transfer requires destinationAddress and amount');
      }
      // For MSCA, we use execute() to call USDC transfer
      return iface.encodeFunctionData('execute', [
        params.contractAddress || '0x...', // USDC address
        0n,
        iface.encodeFunctionData('transfer', [
          params.destinationAddress,
          BigInt(params.amount),
        ]),
      ]);

    case 'approve':
      if (!params.contractAddress || !params.amount) {
        throw new Error('Approve requires contractAddress and amount');
      }
      return iface.encodeFunctionData('execute', [
        params.contractAddress,
        0n,
        iface.encodeFunctionData('approve', [
          params.destinationAddress || params.contractAddress,
          BigInt(params.amount),
        ]),
      ]);

    case 'swap':
    case 'bridge':
    case 'cctp':
    case 'gateway':
      // These would use specific contract interfaces
      // For now, return generic execute call
      if (params.contractAddress && params.abiFunctionSignature && params.abiParameters) {
        const contractIface = new ethers.Interface([
          `function ${params.abiFunctionSignature}`,
        ]);
        const data = contractIface.encodeFunctionData(
          params.abiFunctionSignature,
          params.abiParameters
        );
        return iface.encodeFunctionData('execute', [
          params.contractAddress,
          params.amount ? BigInt(params.amount) : 0n,
          data,
        ]);
      }
      throw new Error(`Action ${params.action} requires contractAddress and abiFunctionSignature`);

    default:
      throw new Error(`Unsupported action: ${params.action}`);
  }
}

/**
 * Sign UserOperation with session key
 * 
 * Note: In production, the session key would be a wallet with a private key
 * For now, this is a placeholder that shows the structure
 */
export async function signUserOperationWithSessionKey(
  userOp: UserOperation,
  sessionKey: CircleSessionKey,
  entryPointAddress: string = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' // ERC-4337 EntryPoint
): Promise<SignedUserOperation> {
  // Calculate UserOp hash (ERC-4337 standard)
  const userOpHash = getUserOpHash(userOp, entryPointAddress);

  // TODO: Sign with session key private key
  // In production, this would:
  // 1. Get session key private key (from secure storage)
  // 2. Sign the userOpHash
  // 3. Return signed UserOp
  
  // For now, return with placeholder signature
  // The actual signature would be generated by the session key wallet
  const signature = '0x' + '0'.repeat(130); // Placeholder 65-byte signature

  return {
    ...userOp,
    signature,
    hash: userOpHash,
  };
}

/**
 * Calculate UserOp hash (ERC-4337)
 */
function getUserOpHash(
  userOp: UserOperation,
  entryPointAddress: string
): string {
  // ERC-4337 UserOp hash calculation
  const userOpHash = ethers.solidityPackedKeccak256(
    [
      'bytes32', // userOpHash
      'address', // entryPoint
      'uint256', // chainId
    ],
    [
      ethers.solidityPackedKeccak256(
        [
          'address', // sender
          'uint256', // nonce
          'bytes32', // initCode hash
          'bytes32', // callData hash
          'uint256', // callGasLimit
          'uint256', // verificationGasLimit
          'uint256', // preVerificationGas
          'uint256', // maxFeePerGas
          'uint256', // maxPriorityFeePerGas
          'bytes32', // paymasterAndData hash
        ],
        [
          userOp.sender,
          userOp.nonce,
          ethers.keccak256(userOp.initCode),
          ethers.keccak256(userOp.callData),
          userOp.callGasLimit,
          userOp.verificationGasLimit,
          userOp.preVerificationGas,
          userOp.maxFeePerGas,
          userOp.maxPriorityFeePerGas,
          ethers.keccak256(userOp.paymasterAndData),
        ]
      ),
      entryPointAddress,
      5042002n, // Arc Testnet chain ID
    ]
  );

  return userOpHash;
}

/**
 * Submit UserOperation to ERC-4337 bundler
 * 
 * Note: This requires a bundler service (e.g., Alchemy, Stackup, or self-hosted)
 */
export async function submitUserOperation(
  signedUserOp: SignedUserOperation,
  bundlerUrl?: string
): Promise<{ success: boolean; userOpHash?: string; error?: string }> {
  const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'; // ERC-4337 EntryPoint
  
  try {
    // Default bundler URL (can be overridden)
    const bundlerEndpoint = bundlerUrl || process.env.ERC4337_BUNDLER_URL || '';

    if (!bundlerEndpoint) {
      // If no bundler, we can still submit via Circle's API if they support it
      // For now, return error
      return {
        success: false,
        error: 'No bundler URL configured. Set ERC4337_BUNDLER_URL or use Circle API',
      };
    }

    // Submit to bundler (ERC-4337 standard endpoint)
    const response = await fetch(`${bundlerEndpoint}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: signedUserOp.sender,
            nonce: '0x' + signedUserOp.nonce.toString(16),
            initCode: signedUserOp.initCode,
            callData: signedUserOp.callData,
            callGasLimit: '0x' + signedUserOp.callGasLimit.toString(16),
            verificationGasLimit: '0x' + signedUserOp.verificationGasLimit.toString(16),
            preVerificationGas: '0x' + signedUserOp.preVerificationGas.toString(16),
            maxFeePerGas: '0x' + signedUserOp.maxFeePerGas.toString(16),
            maxPriorityFeePerGas: '0x' + signedUserOp.maxPriorityFeePerGas.toString(16),
            paymasterAndData: signedUserOp.paymasterAndData,
            signature: signedUserOp.signature,
          },
          entryPointAddress, // ERC-4337 EntryPoint address
        ],
      }),
    });

    const result = await response.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Bundler error',
      };
    }

    return {
      success: true,
      userOpHash: result.result,
    };
  } catch (error: any) {
    console.error('[Session Key Signer] Error submitting UserOp:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit UserOperation',
    };
  }
}

/**
 * Batch multiple UserOperations
 */
export async function batchUserOperations(
  userOps: UserOperation[],
  sessionKey: CircleSessionKey
): Promise<SignedUserOperation[]> {
  const signedOps: SignedUserOperation[] = [];

  for (const userOp of userOps) {
    const signed = await signUserOperationWithSessionKey(userOp, sessionKey);
    signedOps.push(signed);
  }

  return signedOps;
}

