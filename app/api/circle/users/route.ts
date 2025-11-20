/**
 * Circle User Management API
 * 
 * For User-Controlled Wallets, we need to create users first
 * https://developers.circle.com/user-controlled-wallets/docs
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserCircleClient } from "@/lib/circle-user-sdk";
import { circleConfig } from "@/lib/circle";

export interface CreateUserRequest {
  userId?: string; // Optional: provide your own user ID
  userSource?: {
    id: string;
    type: "EMAIL" | "PHONE" | "WALLET";
  };
  action?: "create" | "email-login" | "resend-otp"; // Action to perform
  email?: string; // For email authentication
  deviceId?: string; // For email authentication
  deviceToken?: string; // Device token from email login
  otpToken?: string; // OTP token for resending
  userToken?: string; // User token for resending OTP
}

/**
 * POST /api/circle/users
 * Create a new user for User-Controlled Wallets or handle email authentication
 * 
 * Actions:
 * - "create" (default): Create a standard user
 * - "email-login": Initiate email OTP authentication
 * - "resend-otp": Resend OTP email
 */
export async function POST(request: NextRequest) {
  try {
    // Enhanced validation and logging for Vercel debugging
    console.log("=== USER CREATION REQUEST ===");
    console.log("App ID configured:", !!circleConfig.appId);
    console.log("App ID value:", circleConfig.appId ? `${circleConfig.appId.substring(0, 8)}...` : "NOT SET");
    console.log("API Key configured:", !!circleConfig.apiKey);
    console.log("API Key prefix:", circleConfig.apiKey ? circleConfig.apiKey.split(":")[0] : "NOT SET");
    console.log("Environment:", circleConfig.environment);
    
    if (!circleConfig.appId) {
      console.error("❌ NEXT_PUBLIC_CIRCLE_APP_ID is missing!");
      return NextResponse.json(
        {
          success: false,
          error: "Circle App ID not configured. Set NEXT_PUBLIC_CIRCLE_APP_ID in Vercel environment variables.",
          hint: "Go to Vercel Dashboard → Settings → Environment Variables and add NEXT_PUBLIC_CIRCLE_APP_ID",
        },
        { status: 400 }
      );
    }

    if (!circleConfig.apiKey) {
      console.error("❌ CIRCLE_API_KEY is missing!");
      return NextResponse.json(
        {
          success: false,
          error: "Circle API key not configured. Set CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY in Vercel environment variables.",
          hint: "Go to Vercel Dashboard → Settings → Environment Variables and add CIRCLE_API_KEY",
        },
        { status: 401 }
      );
    }

    const body: CreateUserRequest = await request.json();
    
    let client;
    try {
      client = getUserCircleClient();
      console.log("✅ User-Controlled Wallets SDK client initialized successfully");
    } catch (sdkError: any) {
      console.error("❌ Failed to initialize SDK:", sdkError.message);
      return NextResponse.json(
        {
          success: false,
          error: `SDK initialization failed: ${sdkError.message}`,
          hint: "Check that NEXT_PUBLIC_CIRCLE_APP_ID and CIRCLE_API_KEY are correctly set in Vercel",
        },
        { status: 401 }
      );
    }
    
    // Handle email authentication
    if (body.action === "email-login" && body.email) {
      console.log("Initiating email authentication...", { email: body.email });
      
      const deviceId = body.deviceId || `device-${Date.now()}`;
      
      const response = await client.createDeviceTokenForEmailLogin({
        email: body.email,
        deviceId,
      });
      
      console.log("Email authentication response:", response);
      
      return NextResponse.json({
        success: true,
        data: {
          deviceId,
          deviceToken: response.data?.deviceToken,
          deviceEncryptionKey: response.data?.deviceEncryptionKey,
          otpToken: response.data?.otpToken,
          email: body.email,
        },
      });
    }
    
    // Handle OTP resend
    if (body.action === "resend-otp" && body.email && body.deviceId && body.otpToken) {
      console.log("Resending OTP...");
      
      // resendOTP requires userId or userToken, deviceId, email, and otpToken
      const resendParams: any = {
        deviceId: body.deviceId,
        email: body.email,
        otpToken: body.otpToken,
      };
      
      if (body.userId) {
        resendParams.userId = body.userId;
      } else if (body.userToken) {
        resendParams.userToken = body.userToken;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: "Either userId or userToken is required for resending OTP",
          },
          { status: 400 }
        );
      }
      
      const response = await client.resendOTP(resendParams);
      
      console.log("Resend OTP response:", response);
      
      return NextResponse.json({
        success: true,
        data: {
          otpToken: response.data?.otpToken,
        },
      });
    }

    // Create user
    // Circle API requires userId to be provided - generate one if not provided
    const userId = body.userId || `arcle-user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const createUserParams: any = {
      userId,
    };
    
    if (body.userSource) {
      createUserParams.userSource = body.userSource;
    }
    
    console.log("Creating user with SDK...", { 
      appId: circleConfig.appId,
      apiKeyPrefix: circleConfig.apiKey?.substring(0, 15) + "...",
      params: createUserParams 
    });
    
    const userResponse = await client.createUser(createUserParams);
    
    console.log("User creation response:", userResponse);
    
    // Response structure: userResponse.data is the user object directly
    const user = userResponse.data;
    
    if (!user || !user.id) {
      throw new Error("Failed to create user - no user returned");
    }

    // Create user token using the createUserToken method
    let userToken: string | undefined;
    let encryptionKey: string | undefined;
    let refreshToken: string | undefined;
    
    try {
      console.log("Creating user token...", { userId: user.id });
      const tokenResponse = await client.createUserToken({
        userId: user.id,
      });
      
      console.log("User token response:", tokenResponse);
      
      if (tokenResponse.data) {
        userToken = tokenResponse.data.userToken;
        encryptionKey = tokenResponse.data.encryptionKey;
        // refreshToken may not be in the type definition but might be in the response
        refreshToken = (tokenResponse.data as any).refreshToken;
        
        // Log token creation status for debugging
        console.log("User token created:", {
          hasUserToken: !!userToken,
          hasEncryptionKey: !!encryptionKey,
          hasRefreshToken: !!refreshToken,
          encryptionKeyLength: encryptionKey?.length || 0,
        });
        
        // Note: refreshToken and deviceId should be stored client-side for proper token refresh
        // For now, we return them so the client can store them
      }
    } catch (tokenError: any) {
      console.error("Error creating user token:", tokenError);
      // Return user without token - client can create token later if needed
      return NextResponse.json(
        {
          success: false,
          error: "User created but failed to generate token",
          details: tokenError.response?.data || tokenError.message,
          userId: user.id,
        },
        { status: 500 }
      );
    }

    if (!userToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to retrieve userToken",
          userId: user.id,
        },
        { status: 500 }
      );
    }

    // Encryption key is optional but recommended for PIN setup
    // If missing, the client will need to create a new token
    if (!encryptionKey) {
      console.warn("⚠️ Encryption key not returned from createUserToken. PIN setup may fail.");
      console.warn("   This is sometimes normal - try creating wallet again to get a fresh encryption key.");
    }
    
    return NextResponse.json(
      {
        success: true,
        data: {
          userId: user.id,
          userToken,
          // Always include encryptionKey if available (even if empty, so client knows)
          encryptionKey: encryptionKey || undefined,
          refreshToken: refreshToken || undefined, // Include refreshToken if available (for future token refresh)
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("=== ERROR CREATING USER ===");
    console.error("Error message:", error.message);
    console.error("Error type:", error.constructor?.name);
    console.error("HTTP Status:", error.response?.status);
    console.error("Error data:", error.response?.data);
    console.error("Error code:", error.response?.data?.code);
    console.error("Full error:", error);
    
    // Check for authentication errors (401)
    const is401 = error.response?.status === 401 || 
                  error.message?.includes("401") || 
                  error.message?.includes("Unauthorized") ||
                  error.response?.data?.code === 155001; // Circle's authentication error code
    
    if (is401) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication failed. Check your Circle API key and App ID.",
          details: {
            message: error.response?.data?.message || error.message,
            code: error.response?.data?.code,
            hint: "Verify NEXT_PUBLIC_CIRCLE_APP_ID and CIRCLE_API_KEY are set correctly in Vercel environment variables",
            appIdConfigured: !!circleConfig.appId,
            apiKeyConfigured: !!circleConfig.apiKey,
          },
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create user",
        details: error.response?.data || error.toString(),
        status: error.response?.status,
      },
      { status: error.response?.status || 500 }
    );
  }
}

/**
 * GET /api/circle/users/[userId]
 * Get user details
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "userId is required",
        },
        { status: 400 }
      );
    }

    const client = getUserCircleClient();
    const userResponse = await client.getUser({ userId });

    if (!userResponse.data?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: userResponse.data.user,
    });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch user",
      },
      { status: 500 }
    );
  }
}

