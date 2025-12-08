"use client";

import { useState, useRef, useEffect } from "react";
import {
  Paperclip,
  ShoppingBag,
  Link,
  FileText,
  DollarSign,
  MoreHorizontal,
  ChevronRight,
  Receipt,
  Calendar,
  Download,
  Users,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}

export function AttachmentMenu({
  isOpen,
  onClose,
  onSelect,
  anchorRef,
}: AttachmentMenuProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [highlightedItem, setHighlightedItem] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the anchor button (Plus icon) or its parent
      if (anchorRef.current) {
        const anchorElement = anchorRef.current;
        // Check if target is the button or any of its children
        if (anchorElement.contains(target) || anchorElement === target) {
          return;
        }
        // Also check parent elements up to the form
        let parent = (target as Element).parentElement;
        while (parent && parent !== document.body) {
          if (parent === anchorElement || parent.closest('form')?.contains(anchorElement)) {
            return;
          }
          parent = parent.parentElement;
        }
      }
      
      // Don't close if clicking inside the menus
      if (menuRef.current && menuRef.current.contains(target)) {
        return;
      }
      
      if (moreMenuRef.current && moreMenuRef.current.contains(target)) {
        return;
      }
      
      // Close if clicking outside
      onClose();
      setShowMoreMenu(false);
    };

    // Use a delay to allow the button click to register first
    // Use requestAnimationFrame to ensure DOM is updated
    const frameId = requestAnimationFrame(() => {
      // Double RAF to ensure menu is rendered
      requestAnimationFrame(() => {
        setTimeout(() => {
          document.addEventListener("mousedown", handleClickOutside, true);
          document.addEventListener("click", handleClickOutside, true);
        }, 150);
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, [isOpen, onClose, anchorRef]);

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log("[AttachmentMenu] Menu is open, anchorRef:", anchorRef.current);
      console.log("[AttachmentMenu] Menu position:", getMenuPosition());
    }
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

  const mainMenuItems = [
    {
      id: "add-files",
      label: "Add photos & files",
      icon: Paperclip,
      action: "upload",
    },
    {
      id: "place-order",
      label: "Place order",
      icon: ShoppingBag,
      action: "place-order",
    },
    {
      id: "create-payment-link",
      label: "Create payment link",
      icon: Link,
      action: "create-payment-link",
    },
    {
      id: "send-invoice",
      label: "Send invoice",
      icon: FileText,
      action: "send-invoice",
    },
    {
      id: "request-payment",
      label: "Request payment",
      icon: DollarSign,
      action: "request-payment",
    },
    {
      id: "more",
      label: "More",
      icon: MoreHorizontal,
      hasSubmenu: true,
    },
  ];

  const moreMenuItems = [
    {
      id: "transaction-receipt",
      label: "Transaction receipt",
      icon: Receipt,
      action: "transaction-receipt",
    },
    {
      id: "schedule-payment",
      label: "Schedule payment",
      icon: Calendar,
      action: "schedule-payment",
    },
    {
      id: "payroll",
      label: "Payroll",
      icon: Users,
      action: "payroll",
    },
    {
      id: "multiple-payment",
      label: "Multiple payment",
      icon: Send,
      action: "multiple-payment",
    },
    {
      id: "export-data",
      label: "Export data",
      icon: Download,
      action: "export-data",
    },
  ];

  const handleItemClick = (item: typeof mainMenuItems[0] | typeof moreMenuItems[0]) => {
    if ("hasSubmenu" in item && item.hasSubmenu) {
      setShowMoreMenu(true);
      return;
    }
    onSelect(item.action as string);
    onClose();
    setShowMoreMenu(false);
  };

  // Calculate position based on anchor
  const getMenuPosition = () => {
    if (!anchorRef.current) {
      console.warn("[AttachmentMenu] anchorRef is null");
      return { top: 0, left: 0 };
    }
    const rect = anchorRef.current.getBoundingClientRect();
    const inputBar = anchorRef.current.closest('.max-w-2xl')?.getBoundingClientRect();
    
    // Calculate position with bounds checking
    let top = rect.bottom + 8;
    let left = inputBar ? inputBar.left : rect.left;
    
    // Responsive bounds
    const menuWidth = isMobile ? Math.min(320, window.innerWidth - 32) : 240;
    const menuHeight = isMobile ? 360 : 320;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust if menu would go off right edge
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 16; // 16px padding from edge
    }
    
    // Adjust if menu would go off bottom edge (show above instead)
    if (top + menuHeight > viewportHeight) {
      top = rect.top - menuHeight - 8; // Show above the button
    }
    
    // Ensure minimum padding from edges
    left = Math.max(16, left);
    top = Math.max(16, top);
    
    const position = { top, left };
    console.log("[AttachmentMenu] Calculated position:", position, "rect:", rect, "viewport:", { width: viewportWidth, height: viewportHeight });
    return position;
  };

  const getMoreMenuPosition = () => {
    if (!menuRef.current) return { top: 0, left: 0 };
    const rect = menuRef.current.getBoundingClientRect();
    // On mobile, stack below the main menu; on desktop, align to the right.
    if (isMobile) {
      return {
        top: rect.bottom + 8,
        left: rect.left,
      };
    }
    return {
      top: rect.top,
      left: rect.right - 8,
    };
  };

  const menuPosition = getMenuPosition();
  const moreMenuPosition = getMoreMenuPosition();

  return (
    <>
      {/* Main Menu */}
      <div
        ref={menuRef}
        className="fixed z-[9999] bg-graphite border border-graphite/60 rounded-xl shadow-lg py-1.5 min-w-[220px] max-w-[90vw] max-h-[70vh] overflow-y-auto pointer-events-auto"
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          width: isMobile ? "min(320px, 90vw)" : "240px",
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {mainMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => {
                if (item.hasSubmenu) {
                  setShowMoreMenu(true);
                }
                setHighlightedItem(item.id);
              }}
              onMouseLeave={() => {
                if (!item.hasSubmenu) {
                  setHighlightedItem(null);
                }
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-signal-white",
                "hover:bg-graphite/70 transition-colors",
                highlightedItem === item.id && "bg-graphite/70"
              )}
            >
              <Icon className="w-4 h-4 text-soft-mist/70" />
              <span className="flex-1">{item.label}</span>
              {item.hasSubmenu && (
                <ChevronRight className="w-4 h-4 text-soft-mist/50" />
              )}
            </button>
          );
        })}
      </div>

      {/* More Sub-menu */}
      {showMoreMenu && (
        <div
          ref={moreMenuRef}
          className="fixed z-[9999] bg-graphite border border-graphite/60 rounded-xl shadow-lg py-1.5 min-w-[220px] max-w-[90vw] max-h-[70vh] overflow-y-auto"
          style={{
            top: `${moreMenuPosition.top}px`,
            left: `${moreMenuPosition.left}px`,
            width: isMobile ? "min(320px, 90vw)" : "240px",
          }}
          onMouseEnter={() => setShowMoreMenu(true)}
          onMouseLeave={() => setShowMoreMenu(false)}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {moreMenuItems.map((item) => {
            const Icon = item.icon;
            const isHighlighted = highlightedItem === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setHighlightedItem(item.id)}
                onMouseLeave={() => setHighlightedItem(null)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-signal-white",
                  "hover:bg-graphite/70 transition-colors",
                  isHighlighted && "bg-graphite/70"
                )}
              >
                <Icon className="w-4 h-4 text-soft-mist/70" />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

