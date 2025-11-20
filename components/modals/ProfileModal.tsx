"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Mail, User, Wallet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  onUpdateEmail: (email: string) => void;
  onUpdateDisplayName: (name: string) => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  email,
  displayName,
  avatarUrl,
  walletAddress,
  onUpdateEmail,
  onUpdateDisplayName,
}: ProfileModalProps) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempEmail, setTempEmail] = useState(email || '');
  const [tempName, setTempName] = useState(displayName || '');

  if (!isOpen) return null;

  const handleSaveEmail = () => {
    onUpdateEmail(tempEmail);
    setEditingEmail(false);
  };

  const handleSaveName = () => {
    onUpdateDisplayName(tempName);
    setEditingName(false);
  };

  const createdDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-onyx border border-white/20 rounded-2xl p-6 max-w-md w-full relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-extralight tracking-wider text-white mb-6">Profile Settings</h2>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-white" />
            )}
          </div>
        </div>

        {/* Display Name */}
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Display Name
          </label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="flex-1 bg-dark-grey border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="Enter your name"
              />
              <Button onClick={handleSaveName} size="sm" className="bg-white text-onyx hover:bg-white/90">Save</Button>
              <Button onClick={() => setEditingName(false)} size="sm" className="bg-transparent border border-white/20 text-white hover:bg-white/10">Cancel</Button>
            </div>
          ) : (
            <div
              onClick={() => setEditingName(true)}
              className="bg-dark-grey border border-white/20 rounded-lg px-3 py-2 text-white text-sm cursor-pointer hover:border-white/40 transition-colors"
            >
              {displayName || 'Click to set your name'}
            </div>
          )}
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Address
          </label>
          {editingEmail ? (
            <div className="flex gap-2">
              <input
                type="email"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                className="flex-1 bg-dark-grey border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                placeholder="your@email.com"
              />
              <Button onClick={handleSaveEmail} size="sm" className="bg-white text-onyx hover:bg-white/90">Save</Button>
              <Button onClick={() => setEditingEmail(false)} size="sm" className="bg-transparent border border-white/20 text-white hover:bg-white/10">Cancel</Button>
            </div>
          ) : (
            <div
              onClick={() => setEditingEmail(true)}
              className="bg-dark-grey border border-white/20 rounded-lg px-3 py-2 text-white text-sm cursor-pointer hover:border-white/40 transition-colors"
            >
              {email || 'Click to add your email'}
            </div>
          )}
        </div>

        {/* Wallet Address (Read-only) */}
        <div className="mb-4">
          <label className="text-white/60 text-sm mb-2 flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Wallet Address
          </label>
          <div className="bg-dark-grey border border-white/20 rounded-lg px-3 py-2 text-white/60 text-sm font-mono">
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'No wallet connected'}
          </div>
        </div>

        {/* Account Created */}
        <div className="mb-6">
          <label className="text-white/60 text-sm mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Member Since
          </label>
          <div className="bg-dark-grey border border-white/20 rounded-lg px-3 py-2 text-white/60 text-sm">
            {createdDate}
          </div>
        </div>

        {/* Close Button */}
        <Button onClick={onClose} className="w-full bg-white text-onyx hover:bg-white/90 border border-white/20">
          Done
        </Button>
      </div>
    </div>
  );
}

