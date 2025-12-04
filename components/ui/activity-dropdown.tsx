"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Bell, MessageCircle, Award, Calendar, Tag, CheckSquare, ChevronUp, DollarSign, TrendingUp, Shield, AlertCircle, Receipt, Send, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { getUserNotifications, getUnreadCount as getSupabaseUnreadCount, markAsRead } from "@/lib/db/services/notifications"

interface Activity {
  id: number | string
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  time: string
  type?: string
  isRead?: boolean
}

// Map notification types to icons (Supabase notification types)
const getNotificationIcon = (type?: string): { icon: React.ReactNode; bg: string } => {
  switch (type) {
    case "transaction":
      return { icon: <Send className="h-4 w-4" />, bg: "bg-blue-500/20 dark:bg-blue-500/20" }
    case "payment":
      return { icon: <DollarSign className="h-4 w-4" />, bg: "bg-green-500/20 dark:bg-green-500/20" }
    case "invoice":
      return { icon: <Receipt className="h-4 w-4" />, bg: "bg-purple-500/20 dark:bg-purple-500/20" }
    case "remittance":
      return { icon: <Globe className="h-4 w-4" />, bg: "bg-cyan-500/20 dark:bg-cyan-500/20" }
    case "subscription":
      return { icon: <Calendar className="h-4 w-4" />, bg: "bg-orange-500/20 dark:bg-orange-500/20" }
    case "system":
      return { icon: <Bell className="h-4 w-4" />, bg: "bg-neutral-500/20 dark:bg-neutral-500/20" }
    // Legacy types (for backward compatibility)
    case "goal_matured":
    case "safelock_matured":
      return { icon: <Award className="h-4 w-4" />, bg: "bg-green-500/20 dark:bg-green-500/20" }
    case "contribution_due":
    case "contribution_success":
      return { icon: <DollarSign className="h-4 w-4" />, bg: "bg-blue-500/20 dark:bg-blue-500/20" }
    case "goal_progress":
      return { icon: <TrendingUp className="h-4 w-4" />, bg: "bg-purple-500/20 dark:bg-purple-500/20" }
    case "low_balance":
    case "contribution_failed":
      return { icon: <AlertCircle className="h-4 w-4" />, bg: "bg-red-500/20 dark:bg-red-500/20" }
    default:
      return { icon: <Bell className="h-4 w-4" />, bg: "bg-neutral-700 dark:bg-neutral-700 bg-neutral-200" }
  }
}

// Format time relative to now
const formatTime = (date: Date | string): string => {
  const now = new Date()
  const notificationDate = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - notificationDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just Now"
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return notificationDate.toLocaleDateString()
}

// Default activities (fallback when no notifications)
const defaultActivities: Activity[] = [
  {
    id: 1,
    icon: <MessageCircle className="h-4 w-4" />,
    iconBg: "bg-neutral-700 dark:bg-neutral-700 bg-neutral-200",
    title: "Welcome to Arcle!",
    description: "Your AI-powered financial assistant is ready.",
    time: "Just Now",
  },
  {
    id: 2,
    icon: <Shield className="h-4 w-4" />,
    iconBg: "bg-neutral-700 dark:bg-neutral-700 bg-neutral-200",
    title: "Security Enabled",
    description: "Your wallet is protected with enterprise-grade security.",
    time: "2 min ago",
  },
]

export function ActivityDropdown({ userId }: { userId?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activities, setActivities] = useState<Activity[]>(defaultActivities)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Load notifications from Supabase service
    const loadNotifications = async () => {
      if (!userId) {
        setActivities(defaultActivities)
        setUnreadCount(0)
        return
      }

      try {
        // Map Circle userId to Supabase user_id via API route
        let supabaseUserId: string;
        try {
          const response = await fetch("/api/supabase/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ circleUserId: userId }),
          });
          
          if (!response.ok) {
            throw new Error("Failed to get Supabase user ID");
          }
          
          const data = await response.json();
          supabaseUserId = data.userId;
        } catch (error) {
          console.warn("[ActivityDropdown] Could not get Supabase user ID:", error);
          setActivities(defaultActivities)
          setUnreadCount(0)
          return;
        }

        // Load notifications from Supabase
        const notifications = await getUserNotifications(supabaseUserId, 5)
        const count = await getSupabaseUnreadCount(supabaseUserId)
        
        setUnreadCount(count)

        if (notifications && notifications.length > 0) {
          const mappedActivities: Activity[] = notifications.map((notif: any, index: number) => {
            const { icon, bg } = getNotificationIcon(notif.type)
            return {
              id: notif.id || index,
              icon,
              iconBg: bg,
              title: notif.title || "Notification",
              description: notif.message || "",
              time: formatTime(notif.created_at || new Date()),
              type: notif.type,
              isRead: notif.is_read || false,
            }
          })
          setActivities(mappedActivities)
        } else {
          // Use default activities if no notifications
          setActivities(defaultActivities)
        }
      } catch (error) {
        console.error("[ActivityDropdown] Error loading notifications:", error)
        setActivities(defaultActivities)
        setUnreadCount(0)
      }
    }

    loadNotifications()

    // Refresh notifications periodically
    const interval = setInterval(loadNotifications, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [userId])

  const handleNotificationClick = async (activity: Activity) => {
    if (!userId || !activity.id || typeof activity.id === 'number' || activity.isRead) return;
    
    try {
      // Mark notification as read
      await markAsRead(activity.id as string);
      
      // Refresh notifications to update unread count
      const response = await fetch("/api/supabase/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circleUserId: userId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const supabaseUserId = data.userId;
        const count = await getSupabaseUnreadCount(supabaseUserId);
        setUnreadCount(count);
      }
      
      // Update the activity in the list to mark as read
      setActivities(prev => prev.map(a => 
        a.id === activity.id ? { ...a, isRead: true } : a
      ));
    } catch (error) {
      console.error("[ActivityDropdown] Error marking notification as read:", error);
    }
  }

  const displayCount = activities.length
  const hasUnread = unreadCount > 0

  return (
    <div className="relative">
      {/* Notification Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 md:p-2 rounded-lg text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 md:w-5 md:h-5" />
        {hasUnread && (
          <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-aurora rounded-full"></span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div
            className={cn(
              "absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-md rounded-2xl shadow-2xl overflow-hidden z-50",
              "bg-white dark:bg-neutral-900",
              "shadow-xl shadow-black/10 dark:shadow-black/50",
              "transition-all duration-500 ease-in-out",
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 transition-colors duration-300">
                <Bell className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  {displayCount} {displayCount === 1 ? 'Activity' : 'Activities'}
                  {hasUnread && (
                    <span className="ml-2 text-xs font-normal text-aurora">
                      ({unreadCount} new)
                    </span>
                  )}
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  What&apos;s happening around you
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center">
                <ChevronUp
                  className={cn(
                    "h-5 w-5 text-neutral-400 transition-transform duration-500 ease-in-out",
                    isOpen ? "rotate-0" : "rotate-180",
                  )}
                />
              </div>
            </div>

            {/* Activity List */}
            <div className="max-h-[400px] overflow-y-auto">
              <div className="px-2 pb-4 pt-2">
                <div className="space-y-1">
                  {activities.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-neutral-500 dark:text-neutral-400">
                      <p className="text-sm">No activities yet</p>
                    </div>
                  ) : (
                    activities.map((activity, index) => (
                      <div
                        key={activity.id}
                        onClick={() => handleNotificationClick(activity)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl p-3",
                          "transition-all duration-500 ease-in-out",
                          "animate-in fade-in slide-in-from-top-2",
                          !activity.isRead 
                            ? "cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 bg-blue-50/50 dark:bg-blue-900/10" 
                            : "cursor-default hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
                        )}
                        style={{
                          animationDelay: `${index * 75}ms`,
                        }}
                      >
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                          activity.iconBg || "bg-neutral-100 dark:bg-neutral-700"
                        )}>
                          <span className="text-neutral-600 dark:text-neutral-300">{activity.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">{activity.title}</h4>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{activity.description}</p>
                        </div>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500 shrink-0 pt-0.5">
                          {activity.time}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

