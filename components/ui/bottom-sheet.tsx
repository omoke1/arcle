"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={handleBackdropClick}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] animate-in fade-in duration-200"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[60] bg-carbon rounded-t-3xl",
          "shadow-2xl border-t border-graphite/50",
          "animate-in slide-in-from-bottom duration-300 ease-out",
          "max-h-[85vh] flex flex-col",
          className
        )}
      >
        {/* Draggable Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-soft-mist/20 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-6 py-4 flex items-center justify-between border-b border-graphite/50">
            <h2 className="text-lg font-semibold text-signal-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-soft-mist/70 hover:text-signal-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
          {children}
        </div>
      </div>
    </>
  );
}

