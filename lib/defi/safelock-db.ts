/**
 * SafeLock Implementation (Supabase Version)
 * 
 * This is the production-ready version that uses Supabase for persistence.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

export type SafeLockStatus = "locked" | "matured" | "broken" | "unlocked" | "cancelled";

export interface SafeLock {
    id: string;
    user_id: string;
    wallet_id: string;
    amount: string;
    currency: string;
    lock_period: number;
    apy: string;
    penalty_rate: string;
    status: SafeLockStatus;
    maturity_date: string;
    auto_unlock: boolean;
    early_unlock_allowed: boolean;
    early_unlock_fee_percent: string;
    transaction_hash?: string;
    unlocked_at?: string;
    created_at: string;
    updated_at: string;
}

export interface SafeLockBreakdown {
    principal: string;
    yieldEarned: string;
    expectedYield: string;
    penalty: string;
    netAmount: string;
    daysLocked: number;
    daysRemaining: number;
    progressPercentage: number;
}

/**
 * Create a new SafeLock
 */
export async function createSafeLock(params: {
    userId: string;
    walletId: string;
    amount: string;
    lockPeriod: number;
    currency?: string;
    autoUnlock?: boolean;
}): Promise<SafeLock> {
    const supabase = getSupabaseAdmin();
    const { userId, walletId, amount, lockPeriod, currency = "USDC", autoUnlock = true } = params;

    const { apy, penaltyRate } = getRatesForLockPeriod(lockPeriod);

    const now = new Date();
    const maturityDate = new Date(now.getTime() + lockPeriod * 24 * 60 * 60 * 1000);

    const { data: safelock, error } = await supabase
        .from('safe_locks')
        .insert({
            user_id: userId,
            wallet_id: walletId,
            amount: amount,
            currency: currency,
            lock_period: lockPeriod,
            apy: apy,
            penalty_rate: penaltyRate,
            status: 'locked',
            maturity_date: maturityDate.toISOString(),
            auto_unlock: autoUnlock,
            early_unlock_allowed: true, // Default to true based on template behavior allowing break
            early_unlock_fee_percent: 0,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create SafeLock: ${error.message}`);
    }

    console.log(`[SafeLock DB] Created: $${amount} locked for ${lockPeriod} days at ${apy}% APY`);

    return safelock;
}

/**
 * Break SafeLock early (with penalty)
 */
export async function breakSafeLock(safelockId: string): Promise<SafeLockBreakdown | null> {
    const supabase = getSupabaseAdmin();

    const { data: lock, error } = await supabase
        .from('safe_locks')
        .select('*')
        .eq('id', safelockId)
        .single();

    if (error || !lock) {
        console.error(`[SafeLock DB] Lock ${safelockId} not found`);
        return null;
    }

    if (lock.status !== "locked") {
        console.error(`[SafeLock DB] Lock ${safelockId} is ${lock.status}, cannot break`);
        return null;
    }

    const breakdown = calculateSafeLockBreakdown(lock);
    const now = new Date();

    // Update status
    const { error: updateError } = await supabase
        .from('safe_locks')
        .update({
            status: 'broken',
            unlocked_at: now.toISOString()
        })
        .eq('id', safelockId);

    if (updateError) {
        console.error(`[SafeLock DB] Failed to break lock: ${updateError.message}`);
        return null;
    }

    console.log(`[SafeLock DB] Broke lock ${safelockId} early. Penalty: $${breakdown.penalty}, Net: $${breakdown.netAmount}`);

    return breakdown;
}

/**
 * Mature SafeLock (no penalty)
 */
export async function matureSafeLock(safelockId: string): Promise<SafeLockBreakdown | null> {
    const supabase = getSupabaseAdmin();

    const { data: lock, error } = await supabase
        .from('safe_locks')
        .select('*')
        .eq('id', safelockId)
        .single();

    if (error || !lock) {
        return null;
    }

    const now = new Date();
    const maturityDate = new Date(lock.maturity_date);

    if (now < maturityDate) {
        console.warn(`[SafeLock DB] Lock ${safelockId} not yet matured`);
        return null;
    }

    const daysLocked = Math.floor((now.getTime() - new Date(lock.created_at).getTime()) / (24 * 60 * 60 * 1000));
    const yieldEarned = calculateYield(lock.amount.toString(), parseFloat(lock.apy.toString()), daysLocked);
    const totalAmount = (parseFloat(lock.amount.toString()) + parseFloat(yieldEarned)).toFixed(2);

    const breakdown: SafeLockBreakdown = {
        principal: lock.amount.toString(),
        yieldEarned,
        expectedYield: yieldEarned,
        penalty: "0",
        netAmount: totalAmount,
        daysLocked,
        daysRemaining: 0,
        progressPercentage: 100,
    };

    await supabase
        .from('safe_locks')
        .update({
            status: 'matured',
            unlocked_at: now.toISOString()
        })
        .eq('id', safelockId);

    console.log(`[SafeLock DB] Matured lock ${safelockId}. Total: $${totalAmount}`);

    return breakdown;
}

/**
 * Calculate SafeLock breakdown
 */
export function calculateSafeLockBreakdown(lock: SafeLock): SafeLockBreakdown {
    const now = Date.now();
    const createdAt = new Date(lock.created_at).getTime();
    const daysLocked = Math.floor((now - createdAt) / (24 * 60 * 60 * 1000));
    const totalDays = lock.lock_period;
    const daysRemaining = Math.max(0, totalDays - daysLocked);
    const progressPercentage = Math.min(100, (daysLocked / totalDays) * 100);

    // Calculate yield earned so far (at full APY rate)
    const yieldEarned = calculateYield(lock.amount.toString(), parseFloat(lock.apy.toString()), daysLocked);

    // Calculate expected yield at maturity
    const expectedYield = calculateYield(lock.amount.toString(), parseFloat(lock.apy.toString()), totalDays);

    // Calculate penalty (progressive)
    const penaltyRate = calculateProgressivePenalty(parseFloat(lock.penalty_rate.toString()), progressPercentage);
    const penaltyAmount = (parseFloat(lock.amount.toString()) * (penaltyRate / 100)).toFixed(2);

    // Net amount = principal - penalty + yield earned
    const netAmount = (
        parseFloat(lock.amount.toString()) -
        parseFloat(penaltyAmount) +
        parseFloat(yieldEarned)
    ).toFixed(2);

    return {
        principal: lock.amount.toString(),
        yieldEarned,
        expectedYield,
        penalty: penaltyAmount,
        netAmount,
        daysLocked,
        daysRemaining,
        progressPercentage,
    };
}

/**
 * Calculate progressive penalty
 */
function calculateProgressivePenalty(basePenaltyRate: number, progressPercentage: number): number {
    if (progressPercentage >= 100) return 0;

    // More aggressive penalty in early days
    if (progressPercentage < 10) return basePenaltyRate; // 0-10%: full penalty
    if (progressPercentage < 25) return basePenaltyRate * 0.8; // 10-25%: 80%
    if (progressPercentage < 50) return basePenaltyRate * 0.6; // 25-50%: 60%
    if (progressPercentage < 75) return basePenaltyRate * 0.4; // 50-75%: 40%
    if (progressPercentage < 90) return basePenaltyRate * 0.2; // 75-90%: 20%
    return basePenaltyRate * 0.1; // 90-99%: 10%
}

/**
 * Get APY and penalty rate for lock period
 */
function getRatesForLockPeriod(lockPeriod: number): { apy: number; penaltyRate: number } {
    if (lockPeriod >= 365) {
        return { apy: 15, penaltyRate: 10 }; // 1 year
    } else if (lockPeriod >= 180) {
        return { apy: 12, penaltyRate: 8 }; // 6 months
    } else if (lockPeriod >= 90) {
        return { apy: 10, penaltyRate: 7 }; // 3 months
    } else if (lockPeriod >= 60) {
        return { apy: 9, penaltyRate: 6 }; // 2 months
    } else if (lockPeriod >= 30) {
        return { apy: 8, penaltyRate: 5 }; // 1 month
    } else if (lockPeriod >= 14) {
        return { apy: 7, penaltyRate: 5 }; // 2 weeks
    } else {
        return { apy: 6, penaltyRate: 3 }; // < 2 weeks
    }
}

/**
 * Calculate yield
 */
function calculateYield(principal: string, apy: number, days: number): string {
    const principalNum = parseFloat(principal);
    const dailyRate = apy / 365 / 100;
    const yield_ = principalNum * dailyRate * days;
    return yield_.toFixed(2);
}

/**
 * Get all SafeLocks for a user
 */
export async function getSafeLocksByUser(userId: string, status?: SafeLockStatus): Promise<SafeLock[]> {
    const supabase = getSupabaseAdmin();

    let query = supabase
        .from('safe_locks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error(`[SafeLock DB] Error fetching user locks: ${error.message}`);
        return [];
    }

    return data || [];
}

/**
 * Get single SafeLock
 */
export async function getSafeLock(safelockId: string): Promise<SafeLock | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('safe_locks')
        .select('*')
        .eq('id', safelockId)
        .single();

    if (error) {
        return null;
    }

    return data;
}

/**
 * Get matured SafeLocks
 */
export async function getMaturedSafeLocks(): Promise<SafeLock[]> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('safe_locks')
        .select('*')
        .eq('status', 'locked')
        .lte('maturity_date', now);

    if (error) {
        console.error(`[SafeLock DB] Error fetching matured locks: ${error.message}`);
        return [];
    }

    return data || [];
}

/**
 * Format SafeLock for display
 */
export function formatSafeLock(lock: SafeLock): string {
    const breakdown = calculateSafeLockBreakdown(lock);
    const maturityDate = new Date(lock.maturity_date).toLocaleDateString();

    let message = `🔒 SafeLock #${lock.id.substring(0, 8)}\n\n`;
    message += `Amount: $${lock.amount}\n`;
    message += `APY: ${lock.apy}%\n`;
    message += `Lock Period: ${lock.lock_period} days\n`;
    message += `Maturity: ${maturityDate}\n`;
    message += `Days Remaining: ${breakdown.daysRemaining}\n`;
    message += `Progress: ${breakdown.progressPercentage.toFixed(1)}%\n\n`;

    message += `Yield Earned: $${breakdown.yieldEarned}\n`;
    message += `Expected at Maturity: $${breakdown.expectedYield}\n`;
    message += `Status: ${lock.status}\n\n`;

    if (lock.status === "locked") {
        message += `⚠️ Early withdrawal:\n`;
        message += `Penalty: $${breakdown.penalty}\n`;
        message += `You'd receive: $${breakdown.netAmount}`;
    } else if (lock.status === "matured") {
        message += `✅ Matured! Withdraw $${breakdown.netAmount}`;
    }

    return message;
}

/**
 * Format all SafeLocks for a user
 */
export function formatAllSafeLocks(locks: SafeLock[]): string {
    if (locks.length === 0) {
        return "You don't have any SafeLocks yet.";
    }

    const locked = locks.filter(l => l.status === "locked");
    const matured = locks.filter(l => l.status === "matured");
    const broken = locks.filter(l => l.status === "broken");

    let message = `🔒 Your SafeLocks (${locks.length})\n\n`;

    if (locked.length > 0) {
        message += `Active (${locked.length}):\n`;
        locked.forEach((lock, i) => {
            const breakdown = calculateSafeLockBreakdown(lock);
            message += `${i + 1}. $${lock.amount} at ${lock.apy}% APY (${breakdown.progressPercentage.toFixed(0)}% complete)\n`;
        });
        message += `\n`;
    }

    if (matured.length > 0) {
        message += `✅ Matured (${matured.length}) - Ready to withdraw!\n`;
        message += `\n`;
    }

    if (broken.length > 0) {
        message += `❌ Broken Early (${broken.length})\n`;
    }

    return message;
}

/**
 * Get available lock periods with their rates
 */
export function getAvailableLockPeriods(): Array<{
    days: number;
    label: string;
    apy: number;
    penaltyRate: number;
}> {
    return [
        { days: 14, label: "2 Weeks", ...getRatesForLockPeriod(14) },
        { days: 30, label: "1 Month", ...getRatesForLockPeriod(30) },
        { days: 60, label: "2 Months", ...getRatesForLockPeriod(60) },
        { days: 90, label: "3 Months", ...getRatesForLockPeriod(90) },
        { days: 180, label: "6 Months", ...getRatesForLockPeriod(180) },
        { days: 365, label: "1 Year", ...getRatesForLockPeriod(365) },
    ];
}

/**
 * Format available lock periods
 */
export function formatAvailableLockPeriods(): string {
    const periods = getAvailableLockPeriods();

    let message = `🔒 SafeLock Rates:\n\n`;

    periods.forEach(p => {
        message += `${p.label} (${p.days} days):\n`;
        message += `  • APY: ${p.apy}%\n`;
        message += `  • Early withdrawal penalty: ${p.penaltyRate}%\n\n`;
    });

    message += `⚠️ Penalties decrease the closer you are to maturity!`;

    return message;
}
