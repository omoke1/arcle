"use client";

import { ArrowLeft, User, CreditCard, Settings, Shield, Link2, LogOut, Bell, Moon, Globe, Type } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SettingsPageProps {
  onBack: () => void;
  onLogout?: () => void;
}

export function SettingsPage({ onBack, onLogout }: SettingsPageProps) {
  return (
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <button className="text-casper hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Account Information */}
        <div className="bg-onyx rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-white text-sm">fredyomoke@gmail.com</span>
          <span className="bg-casper/20 text-casper text-xs px-3 py-1 rounded-full">Free</span>
        </div>

        {/* Upgrade Call-to-Action */}
        <div className="bg-onyx rounded-xl px-4 py-4 space-y-3">
          <div>
            <h3 className="text-white font-medium mb-1">Want more ARCLE?</h3>
            <p className="text-casper/70 text-sm">Upgrade for more usage and capabilities.</p>
          </div>
          <Button className="w-full bg-white text-onyx hover:bg-casper">
            Upgrade
          </Button>
        </div>

        {/* Settings Options */}
        <div className="space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <User className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Profile</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <CreditCard className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Billing</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Settings className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Capabilities</div>
              <div className="text-xs text-casper/70">2 enabled</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Shield className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Permissions</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Moon className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Color mode</div>
              <div className="text-xs text-casper/70">System</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Type className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Font style</div>
              <div className="text-xs text-casper/70">Default</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Globe className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Speech language</div>
              <div className="text-xs text-casper/70">English</div>
            </div>
          </button>

          <button className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <div className="flex items-center gap-3 flex-1">
              <Bell className="w-5 h-5 text-casper" />
              <span className="text-sm font-medium">Haptic feedback</span>
            </div>
            <div className="w-11 h-6 bg-white rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 transition-transform" />
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Shield className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Privacy</span>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Link2 className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Shared links</span>
          </button>

          {/* Log out */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-500 hover:bg-onyx transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium flex-1 text-left">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

