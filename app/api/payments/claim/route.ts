/**
 * Claim Pending Payment API
 * 
 * Allows recipients to claim pending phone/email payments
 * Auto-creates wallet if recipient doesn't have one
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingPaymentByClaimCode,
  claimPendingPayment,
  getPendingPaymentsByPhone,
  getPendingPaymentsByEmail,
} from '@/lib/db/services/pendingPayments';
import {
  getMappingByPhone,
  getMappingByEmail,
  createOrUpdateMapping,
} from '@/lib/db/services/phoneWalletMappings';
import { getOrCreateSupabaseUser } from '@/lib/supabase-data';
import { getUserCircleClient } from '@/lib/circle-user-sdk';
import crypto from 'crypto';

/**
 * POST - Claim a pending payment
 * Auto-creates wallet if recipient doesn't have one
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimCode, phone, email, userId, userToken, walletId } = body;

    // For security, a valid claim always requires the secret claimCode.
    // phone/email may be used by the UI to help users discover codes,
    // but the backend will not claim purely by phone/email.
    if (!claimCode) {
      return NextResponse.json(
        { error: 'claimCode is required to claim a payment' },
        { status: 400 }
      );
    }

    // Look up pending payment strictly by claimCode
    const pendingPayment = await getPendingPaymentByClaimCode(claimCode);

    if (!pendingPayment) {
      return NextResponse.json(
        { error: 'Pending payment not found' },
        { status: 404 }
      );
    }

    // Optional: if caller also supplied phone/email, ensure they match the intended recipient
    if (phone && pendingPayment.recipient_phone && phone !== pendingPayment.recipient_phone) {
      return NextResponse.json(
        { error: 'Phone number does not match this payment' },
        { status: 400 }
      );
    }

    if (email && pendingPayment.recipient_email && email.toLowerCase() !== pendingPayment.recipient_email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email address does not match this payment' },
        { status: 400 }
      );
    }

    // Verify payment is claimable
    if (pendingPayment.status !== 'pending') {
      return NextResponse.json(
        { error: `Payment has already been ${pendingPayment.status}` },
        { status: 400 }
      );
    }

    if (new Date(pendingPayment.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Payment has expired' },
        { status: 400 }
      );
    }

    // Check if escrow deposit was completed
    if (!pendingPayment.escrow_address || !pendingPayment.escrow_deposit_tx_hash) {
      return NextResponse.json(
        { error: 'Payment escrow deposit not completed. Sender needs to complete deposit first.' },
        { status: 400 }
      );
    }

    // Get or create recipient wallet
    let recipientWalletId = walletId;
    let recipientWalletAddress: string;
    let recipientCircleUserId = userId;

    // Check if phone/email is already mapped to a wallet
    const recipientPhone = pendingPayment.recipient_phone;
    const recipientEmail = pendingPayment.recipient_email;
    
    let existingMapping;
    if (recipientPhone) {
      existingMapping = await getMappingByPhone(recipientPhone);
    } else if (recipientEmail) {
      existingMapping = await getMappingByEmail(recipientEmail);
    }

    if (existingMapping) {
      // Use existing wallet
      recipientWalletId = existingMapping.wallet_id;
      recipientWalletAddress = existingMapping.wallet_address;
      recipientCircleUserId = existingMapping.circle_user_id;
    } else {
      // Auto-create wallet for recipient
      if (!userId || !userToken) {
        // Create new Circle user and wallet via API
        // Call the API routes to create user and wallet
        const createUserResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/circle/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        
        const userData = await createUserResponse.json();
        
        if (!userData.userId || !userData.userToken) {
          return NextResponse.json(
            { error: 'Failed to create user account' },
            { status: 500 }
          );
        }

        recipientCircleUserId = userData.userId;
        const userTokenForWallet = userData.userToken;

        // Create wallet for new user
        const createWalletResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/circle/wallets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: recipientCircleUserId,
            userToken: userTokenForWallet,
          }),
        });
        
        const walletData = await createWalletResponse.json();

        if (!walletData.walletId) {
          return NextResponse.json(
            { error: 'Failed to create wallet' },
            { status: 500 }
          );
        }

        recipientWalletId = walletData.walletId;

        // Get wallet address
        const client = getUserCircleClient();
        const walletInfo = await (client as any).getWallet({
          userToken: userTokenForWallet,
          id: recipientWalletId,
        });

        if (!walletInfo.data?.addresses || walletInfo.data.addresses.length === 0) {
          return NextResponse.json(
            { error: 'Could not get wallet address' },
            { status: 500 }
          );
        }

        recipientWalletAddress = walletInfo.data.addresses[0].address;

        // Create mapping
        await createOrUpdateMapping({
          phone: recipientPhone,
          email: recipientEmail,
          wallet_address: recipientWalletAddress,
          wallet_id: recipientWalletId,
          circle_user_id: recipientCircleUserId,
          verified: false, // Will be verified via SMS/email OTP later
        });
      } else {
        // User provided credentials - use their existing wallet
        const client = getUserCircleClient();
        const walletResponse = await (client as any).getWallet({
          userToken,
          id: walletId,
        });

        if (!walletResponse.data?.addresses || walletResponse.data.addresses.length === 0) {
          return NextResponse.json(
            { error: 'Could not get wallet address' },
            { status: 500 }
          );
        }

        recipientWalletAddress = walletResponse.data.addresses[0].address;

        // Create mapping for future payments
        await createOrUpdateMapping({
          phone: recipientPhone,
          email: recipientEmail,
          wallet_address: recipientWalletAddress,
          wallet_id: walletId,
          circle_user_id: userId,
          verified: true, // User authenticated, so verified
        });
      }
    }

    // Claim from escrow contract
    const supabaseUserId = await getOrCreateSupabaseUser(recipientCircleUserId);
    
    // Generate payment ID for escrow (must match the one used during deposit)
    const { generatePaymentId } = await import('@/lib/escrow/escrowService');
    const paymentId = generatePaymentId(pendingPayment.id);

    // Claim from escrow
    const { claimFromEscrow } = await import('@/lib/escrow/escrowService');
    const claimTxHash = await claimFromEscrow(
      paymentId,
      claimCode,
      recipientWalletAddress
    );

    // Mark payment as claimed
    const claimedPayment = await claimPendingPayment(
      claimCode,
      supabaseUserId,
      recipientWalletId,
      recipientWalletAddress,
      claimTxHash
    );

      return NextResponse.json({
      success: true,
      message: 'Payment claimed successfully! Funds have been transferred to your wallet.',
      data: {
        pendingPaymentId: claimedPayment.id,
        claimTxHash: claimTxHash,
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        walletAddress: recipientWalletAddress,
        walletId: recipientWalletId,
      },
    });
  } catch (error: any) {
    console.error('[Claim Payment API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to claim payment' },
      { status: 500 }
    );
  }
}

/**
 * GET - List pending payments for a phone/email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');
    const claimCode = searchParams.get('claimCode');

    if (claimCode) {
      const pending = await getPendingPaymentByClaimCode(claimCode);
      if (!pending) {
        return NextResponse.json(
          { error: 'Pending payment not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: pending });
    }

    if (phone) {
      const pending = await getPendingPaymentsByPhone(phone);
      return NextResponse.json({ success: true, data: pending });
    }

    if (email) {
      const pending = await getPendingPaymentsByEmail(email.toLowerCase());
      return NextResponse.json({ success: true, data: pending });
    }

    return NextResponse.json(
      { error: 'Must provide phone, email, or claimCode' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Claim Payment API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get pending payments' },
      { status: 500 }
    );
  }
}
