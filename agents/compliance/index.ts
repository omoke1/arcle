/**
 * Compliance Agent
 * 
 * Handles KYC/KYB, risk scoring, fraud detection, and compliance checks
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import type { IntentType } from '@/lib/ai/intent-classifier';
import { calculateRiskScore } from '@/lib/security/risk-scoring';
import { analyzeContract } from '@/lib/security/contract-analysis';

class ComplianceAgent {
  /**
   * Execute a low-level compliance action
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'risk-score': {
        const { address, amount, tokenAddress } = params;
        if (!address) {
          throw new Error('Missing address for risk scoring');
        }
        return await calculateRiskScore(address, amount || '0', tokenAddress);
      }

      case 'analyze-contract': {
        const { address } = params;
        if (!address) {
          throw new Error('Missing contract address');
        }
        return await analyzeContract(address);
      }

      case 'kyc-status': {
        // TODO: Implement KYC status check from database
        const { userId } = params;
        return {
          status: 'not_verified',
          message: 'KYC verification feature coming soon',
        };
      }

      default:
        throw new Error(`Unknown compliance action: ${action}`);
    }
  }

  /**
   * Handle a routed compliance request
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities, context } = request;
    const intentLower = intent.toLowerCase();

    // Risk scoring
    if (intentLower.includes('risk') || intentLower.includes('safe') || intentLower.includes('scam')) {
      const address = entities.address || entities.toAddress || entities.recipient;
      const amount = entities.amount || '0';
      const tokenAddress = entities.tokenAddress;

      if (!address) {
        return {
          success: false,
          message: 'I need an address to check the risk score. For example: "Check risk for address 0x..."',
          agent: 'compliance',
          error: 'Missing address',
        };
      }

      try {
        const riskScore = await this.execute('risk-score', { address, amount, tokenAddress });
        
        const riskLevel = riskScore.overallRisk < 30 ? '🟢 Low Risk' :
                         riskScore.overallRisk < 60 ? '🟡 Medium Risk' :
                         riskScore.overallRisk < 80 ? '🟠 High Risk' : '🔴 Very High Risk';

        const lines = [
          `🔍 Risk Analysis for ${address.substring(0, 10)}...${address.substring(address.length - 8)}:\n`,
          `Overall Risk Score: ${riskScore.overallRisk}/100 ${riskLevel}\n`,
          `• Contract Verified: ${riskScore.isContractVerified ? '✅ Yes' : '❌ No'}`,
          `• Contract Age: ${riskScore.contractAge ? `${riskScore.contractAge} days` : 'Unknown'}`,
          `• Transaction Count: ${riskScore.transactionCount}`,
          `• Phishing Risk: ${riskScore.isPhishing ? '⚠️ High' : '✅ Low'}`,
          `• Scam Address: ${riskScore.isScamAddress ? '⚠️ Yes' : '✅ No'}`,
        ];

        if (riskScore.overallRisk >= 60) {
          lines.push(`\n⚠️ WARNING: This address has a high risk score. Proceed with caution.`);
        }

        return {
          success: true,
          message: lines.join('\n'),
          agent: 'compliance',
          data: riskScore,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Could not calculate risk score: ${error.message}`,
          agent: 'compliance',
          error: error.message,
        };
      }
    }

    // Contract analysis
    if (intentLower.includes('contract') || intentLower.includes('analyze') || intentLower.includes('verify')) {
      const address = entities.address || entities.contractAddress;
      if (!address) {
        return {
          success: false,
          message: 'I need a contract address to analyze. For example: "Analyze contract 0x..."',
          agent: 'compliance',
          error: 'Missing contract address',
        };
      }

      try {
        const analysis = await this.execute('analyze-contract', { address });
        
        const lines = [
          `📋 Contract Analysis for ${address.substring(0, 10)}...${address.substring(address.length - 8)}:\n`,
          `Verified: ${analysis.verified ? '✅ Yes' : '❌ No'}`,
          `Age: ${analysis.age ? `${analysis.age} days` : 'Unknown'}`,
          `Risk Level: ${analysis.riskLevel || 'Unknown'}`,
        ];

        return {
          success: true,
          message: lines.join('\n'),
          agent: 'compliance',
          data: analysis,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Could not analyze contract: ${error.message}`,
          agent: 'compliance',
          error: error.message,
        };
      }
    }

    // KYC status
    if (intentLower.includes('kyc') || intentLower.includes('verify') || intentLower.includes('identity')) {
      const userId = (context as any)?.userId;
      if (!userId) {
        return {
          success: false,
          message: 'I need your user ID to check KYC status.',
          agent: 'compliance',
          error: 'Missing userId',
        };
      }

      try {
        const kycStatus = await this.execute('kyc-status', { userId });
        return {
          success: true,
          message: `KYC Status: ${kycStatus.status}\n\n${kycStatus.message}`,
          agent: 'compliance',
          data: kycStatus,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Could not check KYC status: ${error.message}`,
          agent: 'compliance',
          error: error.message,
        };
      }
    }

    // Default help
    return {
      success: true,
      message: `I can help you with compliance and security:\n\n` +
        `• **Risk Scoring**: "Check risk for address 0x..." or "Is this address safe?"\n` +
        `• **Contract Analysis**: "Analyze contract 0x..." or "Verify contract"\n` +
        `• **KYC Status**: "Check my KYC status" or "Am I verified?"\n` +
        `• **Fraud Detection**: Automatic risk checks on all transactions\n\n` +
        `What would you like to check?`,
      agent: 'compliance',
    };
  }

  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean {
    const intentStr = typeof intent === 'string' ? intent.toLowerCase() : intent;
    
    if (typeof intent === 'string' && !intent.includes(' ')) {
      const complianceIntents: IntentType[] = ['kyc', 'compliance', 'risk', 'fraud', 'scan'];
      if (complianceIntents.includes(intentStr as IntentType)) {
        return true;
      }
    }
    
    const complianceKeywords = ['kyc', 'verify', 'compliance', 'risk', 'fraud', 'scam', 'safe', 'contract', 'analyze'];
    return complianceKeywords.some((keyword) => intentStr.includes(keyword));
  }
}

const complianceAgent = new ComplianceAgent();

export default complianceAgent;
export { ComplianceAgent };

