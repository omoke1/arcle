"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Copy, CheckCircle } from "lucide-react";
import { 
  getInviteStats, 
  DAILY_INVITE_CODES, 
  generateNewCodeSet,
  hasValidAccess 
} from "@/lib/auth/invite-codes";
import type { InviteStats } from "@/lib/auth/invite-codes";

export default function InviteAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load stats on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if user has access (only allow if they've verified)
      if (!hasValidAccess()) {
        router.push('/');
        return;
      }
      
      loadStats();
    }
  }, [router]);

  const loadStats = () => {
    const currentStats = getInviteStats();
    setStats(currentStats);
  };

  const handleGenerateNewCodes = () => {
    const codes = generateNewCodeSet(10);
    setNewCodes(codes);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyAllCodes = () => {
    const allCodes = DAILY_INVITE_CODES.join('\n');
    navigator.clipboard.writeText(allCodes);
    setCopiedCode('ALL');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-onyx text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-onyx text-white px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extralight tracking-wider mb-2">
            Invite Code Admin
          </h1>
          <p className="text-white/60">
            Manage tester access codes for Arcle
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-white/60 text-sm mb-1">Total Codes</div>
            <div className="text-3xl font-extralight">{stats.totalCodes}</div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-white/60 text-sm mb-1">Used</div>
            <div className="text-3xl font-extralight text-green-400">{stats.usedCodes}</div>
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
            <div className="text-white/60 text-sm mb-1">Remaining</div>
            <div className="text-3xl font-extralight text-blue-400">{stats.remainingCodes}</div>
          </div>
        </div>

        {/* Current Codes */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extralight tracking-wide">Current Codes</h2>
            <button
              onClick={handleCopyAllCodes}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors text-sm"
            >
              {copiedCode === 'ALL' ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy All</span>
                </>
              )}
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {DAILY_INVITE_CODES.map((code, index) => {
              const isUsed = stats.usedCodesList.some(u => u.code === code);
              return (
                <div
                  key={code}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isUsed
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white/40 text-sm">#{index + 1}</span>
                    <span className="font-mono tracking-wider">{code}</span>
                    {isUsed && (
                      <span className="text-xs text-green-400">✓ Used</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleCopyCode(code)}
                    className="p-2 hover:bg-white/10 rounded transition-colors"
                  >
                    {copiedCode === code ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Used Codes History */}
        {stats.usedCodesList.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm mb-8">
            <h2 className="text-xl font-extralight tracking-wide mb-4">Usage History</h2>
            
            <div className="space-y-2">
              {stats.usedCodesList.map((used) => (
                <div
                  key={used.code}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <span className="font-mono tracking-wider">{used.code}</span>
                  <span className="text-sm text-white/60">
                    {new Date(used.usedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generate New Codes */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
          <h2 className="text-xl font-extralight tracking-wide mb-4">Generate New Codes</h2>
          <p className="text-white/60 text-sm mb-4">
            Generate a new set of 10 unique invite codes for the next batch of testers.
          </p>
          
          <button
            onClick={handleGenerateNewCodes}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors mb-4"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Generate New Set</span>
          </button>

          {newCodes.length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-white/60 mb-2">
                New codes generated! Copy and replace in <code className="text-white/80">lib/auth/invite-codes.ts</code>:
              </div>
              <div className="bg-black/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-white/90">
{`export const DAILY_INVITE_CODES = [
${newCodes.map((code, i) => `  '${code}', // Code ${i + 1}`).join('\n')}
];`}
                </pre>
              </div>
              <button
                onClick={() => {
                  const codeArray = `export const DAILY_INVITE_CODES = [\n${newCodes.map((code, i) => `  '${code}', // Code ${i + 1}`).join('\n')}\n];`;
                  navigator.clipboard.writeText(codeArray);
                  setCopiedCode('NEW_SET');
                  setTimeout(() => setCopiedCode(null), 2000);
                }}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors text-sm"
              >
                {copiedCode === 'NEW_SET' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Back to Chat */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/chat')}
            className="text-white/60 hover:text-white transition-colors text-sm"
          >
            ← Back to Chat
          </button>
        </div>
      </div>
    </div>
  );
}



