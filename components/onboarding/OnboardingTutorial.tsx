"use client";

import { useState } from "react";
import { ArrowRight, Wallet, Shield, Sparkles, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerBiometric, isWebAuthnSupported } from "@/lib/auth/webauthn";

interface OnboardingTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTutorial({ onComplete, onSkip }: OnboardingTutorialProps) {
  const [step, setStep] = useState(0);
  const [biometricRegistered, setBiometricRegistered] = useState(false);

  const steps = [
    {
      title: "Welcome to ARCLE",
      description: "Your AI-powered wallet on Arc blockchain",
      icon: Sparkles,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-casper/70">
            ARCLE is a smart wallet that protects you from scams, automates payments, and makes crypto simple.
          </p>
          <div className="bg-dark-grey rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm text-white">AI-powered security</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm text-white">Automated payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span className="text-sm text-white">Cross-chain bridging</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Secure Your Wallet",
      description: "Enable biometric authentication for quick access",
      icon: Shield,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-casper/70">
            Use Face ID, Touch ID, or your device&apos;s biometric to secure your wallet.
          </p>
          {isWebAuthnSupported() ? (
            <div className="space-y-3">
              {!biometricRegistered ? (
                <Button
                  onClick={async () => {
                    const credential = await registerBiometric();
                    if (credential) {
                      setBiometricRegistered(true);
                    }
                  }}
                  className="w-full bg-white hover:bg-white/80 text-onyx"
                >
                  Enable Biometric
                </Button>
              ) : (
                <div className="bg-success/20 border border-success/50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-success" />
                    <span className="text-sm text-white">Biometric enabled</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-dark-grey rounded-lg p-4">
              <p className="text-sm text-casper/70">
                Biometric authentication not available on this device. You can enable it later in settings.
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Create Your Wallet",
      description: "Your wallet will be created automatically",
      icon: Wallet,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-casper/70">
            We&apos;ll create a secure smart contract wallet on Arc for you. No seed phrases needed!
          </p>
          <div className="bg-dark-grey rounded-lg p-4 space-y-2">
            <p className="text-xs text-casper/70">What you&apos;ll get:</p>
            <ul className="space-y-1 text-sm text-white">
              <li>• Smart contract account with advanced features</li>
              <li>• AI assistant for transaction management</li>
              <li>• Optional testnet tokens to get started</li>
              <li>• Secure cloud backup (no seed phrases)</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLastStep = step === steps.length - 1;

  return (
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-casper hover:text-white transition-colors text-sm"
        >
          Skip
        </button>
        <div className="flex items-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === step ? "bg-white" : "bg-dark-grey/50"
              }`}
            />
          ))}
        </div>
        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 scrollbar-hide">
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
            <Icon className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">{currentStep.title}</h2>
            <p className="text-sm text-casper/70">{currentStep.description}</p>
          </div>

          {/* Content */}
          <div className="w-full max-w-md">{currentStep.content}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-dark-grey/50 flex items-center justify-between gap-4">
        {step > 0 && (
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            className="text-casper hover:text-white"
          >
            Back
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={isLastStep ? onComplete : () => setStep(step + 1)}
          className="bg-white hover:bg-white/80 text-onyx flex items-center gap-2"
        >
          {isLastStep ? "Get Started" : "Next"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

