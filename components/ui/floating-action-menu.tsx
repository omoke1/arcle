"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type FloatingActionMenuProps = {
  options: {
    label: string;
    onClick: () => void;
    Icon?: React.ReactNode;
  }[];
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  showToggleButton?: boolean;
};

const FloatingActionMenu = ({
  options,
  className,
  isOpen: controlledIsOpen,
  onClose,
  showToggleButton = true,
}: FloatingActionMenuProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const toggleMenu = () => {
    if (controlledIsOpen !== undefined) {
      onClose?.();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {showToggleButton && (
        <Button
          onClick={toggleMenu}
          className="w-10 h-10 rounded-full bg-[#11111198] hover:bg-[#111111d1] shadow-[0_0_20px_rgba(0,0,0,0.2)]"
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut",
              type: "spring",
              stiffness: 300,
              damping: 20,
            }}
          >
            <Plus className="w-6 h-6" />
          </motion.div>
        </Button>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            {!showToggleButton && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  if (controlledIsOpen !== undefined) {
                    onClose?.();
                  } else {
                    setInternalIsOpen(false);
                  }
                }}
              />
            )}
            <motion.div
              initial={{ opacity: 0, x: 10, y: 10, filter: "blur(10px)" }}
              animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: 10, y: 10, filter: "blur(10px)" }}
              transition={{
                duration: 0.6,
                type: "spring",
                stiffness: 300,
                damping: 20,
                delay: 0.1,
              }}
              className={cn(
                "absolute z-50 w-[min(90vw,340px)] max-h-[70vh] overflow-y-auto max-w-[90vw]",
                showToggleButton ? "bottom-10 right-0 mb-2" : "top-full right-0 mt-2",
                // Nudge inside viewport on very small screens
                "sm:right-0 sm:left-auto right-2"
              )}
            >
              <div className="flex flex-col items-end gap-2 max-w-[90vw]">
                {options.map((option, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                    }}
                    >
                    <Button
                      onClick={() => {
                        option.onClick();
                        if (controlledIsOpen !== undefined) {
                          onClose?.();
                        } else {
                          setInternalIsOpen(false);
                        }
                      }}
                      size="sm"
                      className="flex items-center gap-2 bg-[#11111198] hover:bg-[#111111d1] shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none rounded-xl backdrop-blur-sm text-white justify-start w-full max-w-[320px]"
                    >
                      {option.Icon}
                      <span>{option.label}</span>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingActionMenu;

