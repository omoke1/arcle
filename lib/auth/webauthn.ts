/**
 * WebAuthn Biometric Authentication
 * 
 * Provides biometric authentication using WebAuthn API
 * Falls back gracefully if not supported
 */

export interface WebAuthnCredentials {
  id: string;
  publicKey: string;
}

/**
 * Check if WebAuthn is supported
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.PublicKeyCredential !== 'undefined';
}

/**
 * Register WebAuthn credential (biometric)
 */
export async function registerBiometric(): Promise<WebAuthnCredentials | null> {
  if (!isWebAuthnSupported()) {
    console.warn("WebAuthn not supported");
    return null;
  }

  try {
    // Generate challenge
    const challenge = crypto.randomUUID();
    
    // Create credential
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: new TextEncoder().encode(challenge),
        rp: {
          name: "ARCLE",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(crypto.randomUUID()),
          name: "ARCLE User",
          displayName: "ARCLE User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Use device authenticator (Face ID, Touch ID)
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    }) as PublicKeyCredential;

    if (!credential) {
      return null;
    }

    // Extract credential ID and public key
    const response = credential.response as AuthenticatorAttestationResponse;
    const publicKey = Array.from(new Uint8Array(response.getPublicKey() || []))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      id: credential.id,
      publicKey: `0x${publicKey}`,
    };
  } catch (error) {
    console.error("Error registering biometric:", error);
    return null;
  }
}

/**
 * Authenticate with WebAuthn (biometric login)
 */
export async function authenticateBiometric(credentialId: string): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    const challenge = crypto.randomUUID();
    
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: new TextEncoder().encode(challenge),
        allowCredentials: [
          {
            id: new TextEncoder().encode(credentialId),
            type: "public-key",
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });

    return !!credential;
  } catch (error) {
    console.error("Error authenticating with biometric:", error);
    return false;
  }
}

/**
 * Check if biometric is already registered
 */
export function hasBiometricRegistered(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('arcle_webauthn_credential');
  return !!stored;
}

/**
 * Get stored credential ID
 */
export function getStoredCredentialId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('arcle_webauthn_credential');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.id || null;
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

/**
 * Store credential ID
 */
export function storeCredential(credential: WebAuthnCredentials): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('arcle_webauthn_credential', JSON.stringify(credential));
}


