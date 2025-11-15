/**
 * Notification Service
 * 
 * Handles all notification types for savings goals and SafeLocks.
 * 
 * To activate:
 * 1. Ensure Prisma is set up with Notification model
 * 2. Import and use in your API routes and cron jobs
 * 3. For email: Install Resend (npm install resend) and set RESEND_API_KEY
 */

// NOTE: Prisma import commented out until database is set up
// Uncomment this line when activating database:
// import { prisma } from "@/lib/db/prisma";

export type NotificationType =
  | "goal_matured"
  | "contribution_due"
  | "low_balance"
  | "goal_progress"
  | "safelock_matured"
  | "contribution_success"
  | "contribution_failed";

interface NotificationData {
  goalName?: string;
  safelockId?: string;
  amount?: string;
  percentage?: number;
  goalId?: string;
  error?: string;
}

const notificationTemplates: Record<NotificationType, (data: NotificationData) => { title: string; message: string }> = {
  goal_matured: (data) => ({
    title: "🎉 Savings Goal Matured!",
    message: `Your "${data.goalName}" savings goal is ready to withdraw! 🎊`,
  }),
  contribution_due: (data) => ({
    title: "⏰ Contribution Reminder",
    message: `Time to add $${data.amount} to your "${data.goalName}" goal.`,
  }),
  low_balance: (data) => ({
    title: "⚠️ Low Balance Alert",
    message: `Can't auto-deduct $${data.amount} for "${data.goalName}". Please add funds to your wallet.`,
  }),
  goal_progress: (data) => ({
    title: "📊 Goal Progress Milestone",
    message: `You're ${data.percentage}% towards your "${data.goalName}" goal! Keep going! 💪`,
  }),
  safelock_matured: (data) => ({
    title: "🔒 SafeLock Matured!",
    message: `Your SafeLock is ready to withdraw! Log in to claim your funds + yield.`,
  }),
  contribution_success: (data) => ({
    title: "💰 Contribution Added",
    message: `Successfully added $${data.amount} to "${data.goalName}"!`,
  }),
  contribution_failed: (data) => ({
    title: "❌ Contribution Failed",
    message: `Failed to add $${data.amount} to "${data.goalName}". ${data.error || "Please try again."}`,
  }),
};

/**
 * Send a notification to a user
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: NotificationData
): Promise<void> {
  const template = notificationTemplates[type];
  const { title, message } = template(data);

  // TODO: Uncomment when database is activated
  /*
  // Save to database
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data as any,
    },
  });
  */

  console.log(`[Notification] Sent ${type} to user ${userId} - ${title}`);

  // TODO: Add email notifications
  // if (process.env.RESEND_API_KEY) {
  //   await sendEmailNotification(userId, title, message);
  // }

  // TODO: Add web push notifications
  // if (process.env.VAPID_PUBLIC_KEY) {
  //   await sendPushNotification(userId, title, message);
  // }
}

/**
 * Get unread notifications for a user
 * TODO: Uncomment when database is activated
 */
export async function getUnreadNotifications(userId: string): Promise<any[]> {
  // TODO: Uncomment when database is activated
  /*
  return await prisma.notification.findMany({
    where: {
      userId,
      read: false,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  */
  return []; // Placeholder until database is set up
}

/**
 * Get unread notification count for a user
 * TODO: Uncomment when database is activated
 */
export function getUnreadCount(userId?: string): number {
  // TODO: Uncomment and make async when database is activated
  /*
  const { prisma } = await import("@/lib/db/prisma");
  return await prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
  */
  return 0; // Placeholder until database is set up
}

/**
 * Get notification preferences for a user
 * TODO: Implement when needed (requires database)
 */
export function getNotificationPreferences(userId?: string): any {
  return {
    transactionNotifications: true,
    balanceChangeNotifications: true,
    securityAlerts: true,
    systemNotifications: true,
    minBalanceChange: "10",
    email: false,
    push: false,
    inApp: true,
  };
}

/**
 * Update notification preferences for a user
 * TODO: Implement when needed (requires database)
 */
export function updateNotificationPreferences(preferencesOrUserId: any, preferences?: any): any {
  // Support both signatures:
  // updateNotificationPreferences(preferences) - without userId
  // updateNotificationPreferences(userId, preferences) - with userId
  const prefs = preferences || preferencesOrUserId;
  const userId = preferences ? preferencesOrUserId : undefined;
  
  console.log(`[Notification] Update preferences${userId ? ` for ${userId}` : ''} (placeholder)`);
  
  // Return updated preferences for display
  return {
    ...getNotificationPreferences(),
    ...prefs,
  };
}

/**
 * Get all notifications for a user
 * TODO: Uncomment when database is activated
 */
export function getAllNotifications(userId?: string, limit = 50): any[] {
  // TODO: Uncomment and make async when database is activated
  /*
  const { prisma } = await import("@/lib/db/prisma");
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  */
  return []; // Placeholder until database is set up
}

/**
 * Mark notification as read
 * TODO: Uncomment when database is activated
 */
export async function markAsRead(notificationId: string): Promise<void> {
  // TODO: Uncomment when database is activated
  /*
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
  */
  console.log(`[Notification] Mark as read: ${notificationId} (placeholder)`);
}

/**
 * Mark all notifications as read for a user
 * TODO: Uncomment when database is activated
 */
export function markAllAsRead(userId?: string): void {
  // TODO: Uncomment and make async when database is activated
  /*
  const { prisma } = await import("@/lib/db/prisma");
  await prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });
  */
  console.log(`[Notification] Mark all as read${userId ? ` for user ${userId}` : ''} (placeholder)`);
}

/**
 * Delete old notifications (cleanup)
 * TODO: Uncomment when database is activated
 */
export async function deleteOldNotifications(daysOld = 30): Promise<number> {
  // TODO: Uncomment when database is activated
  /*
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      read: true,
    },
  });

  console.log(`[Notification] Deleted ${result.count} old notifications`);
  return result.count;
  */
  console.log(`[Notification] Delete old notifications (placeholder)`);
  return 0;
}

/**
 * Send email notification (optional, requires Resend)
 */
async function sendEmailNotification(userId: string, title: string, message: string): Promise<void> {
  // TODO: Uncomment and configure when ready to use (requires Prisma + Resend)
  /*
  const { prisma } = await import("@/lib/db/prisma");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return;

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: "Arcle <notifications@arcle.app>",
    to: user.email,
    subject: title,
    html: `
      <h2>${title}</h2>
      <p>${message}</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/chat">View in Arcle</a></p>
    `,
  });
  */
}

/**
 * Send web push notification (optional, requires service worker)
 */
async function sendPushNotification(userId: string, title: string, message: string): Promise<void> {
  // TODO: Uncomment and configure when ready to use (requires Prisma + web-push)
  /*
  const webpush = await import("web-push");
  const { prisma } = await import("@/lib/db/prisma");
  
  webpush.setVapidDetails(
    "mailto:support@arcle.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  // Get user's push subscriptions from database
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId }
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        JSON.parse(sub.subscription),
        JSON.stringify({ title, body: message })
      );
    } catch (error) {
      console.error(`[Push] Failed to send to ${userId}:`, error);
    }
  }
  */
}

// Legacy function stubs for backwards compatibility with old notification files
// TODO: Remove these when old notification files are deprecated

export function createBalanceChangeNotification(...args: any[]): any {
  return { type: "balance_change", args };
}

export function createTransactionNotification(...args: any[]): any {
  return { type: "transaction", args };
}

export function addNotification(...args: any[]): void {
  console.log("[Notification] Legacy addNotification called", args);
}
