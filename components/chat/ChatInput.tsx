"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Plus, X, Send, Camera, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { startVoiceRecognition, isVoiceRecognitionSupported } from "@/lib/voice/voice-recognition";
import { SoundWaveIcon } from "@/components/ui/SoundWaveIcon";
import { AttachmentMenu } from "./AttachmentMenu";
import { QRCodeScanner } from "./QRCodeScanner";
import { BorderBeam } from "@/components/ui/border-beam";

interface ChatInputProps {
  onSendMessage: (message: string, replyTo?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: {
    id: string;
    content: string;
    role: "user" | "assistant";
  } | null; // Message being replied to
  onCancelReply?: () => void; // Cancel reply
  isCentered?: boolean; // Whether input is centered on welcome screen
  onQRCodeScanned?: (data: {
    type: "usdc_address" | "fiat_payment" | "unknown";
    address?: string;
    amount?: string;
    currency?: string;
    rawData: string;
  }) => void; // Callback when QR code is scanned
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Chat with ARCLE...",
  replyTo,
  onCancelReply,
  isCentered = false,
  onQRCodeScanned,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const stopRecognitionRef = useRef<(() => void) | null>(null);
  
  // Update placeholder when replying
  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  // Determine voice support on client only to avoid SSR/CSR mismatch
  useEffect(() => {
    setVoiceSupported(isVoiceRecognitionSupported());
  }, []);

  // Detect mobile for BorderBeam size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), replyTo?.id);
      setMessage(""); // This will automatically switch back to mic icon
      // Clear reply after sending
      if (onCancelReply) {
        onCancelReply();
      }
    }
  };

  const handleSendClick = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), replyTo?.id);
      setMessage(""); // This will automatically switch back to mic icon
      // Clear reply after sending
      if (onCancelReply) {
        onCancelReply();
      }
    }
  };

  const handlePlusClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Toggle menu state directly
    setShowAttachmentMenu((prev) => {
      const newState = !prev;
      console.log("[ChatInput] Plus clicked, menu state:", newState);
      return newState;
    });
  };

  const hasText = message.trim().length > 0;

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const locationMessage =
          `📍 Delivery location shared\n` +
          `- latitude: ${latitude}\n` +
          `- longitude: ${longitude}\n` +
          `${locationUrl}\n\n` +
          `Use this location for delivery or order tracking.`;
        
        onSendMessage(locationMessage);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        let errorMessage = "Unable to get your location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        
        alert(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className={cn(
        "bg-carbon/95 backdrop-blur-sm relative",
        !isCentered && "border-t border-graphite/50",
        "w-full"
      )}
    >
      {/* Reply Preview */}
      {replyTo && (
        <div className="px-2 sm:px-4 pt-2 sm:pt-3 pb-2 border-b border-graphite/40">
          <div className="flex items-start gap-2 max-w-2xl mx-auto">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-soft-mist/80">
                  Replying to {replyTo.role === "assistant" ? "ARCLE" : "you"}
                </span>
              </div>
              <p className="text-xs text-soft-mist/70 line-clamp-2 truncate">
                {replyTo.content.length > 100
                  ? replyTo.content.substring(0, 100) + "..."
                  : replyTo.content}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="h-6 w-6 rounded-full text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50 flex-shrink-0 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Main Input Bar - Centered and Compact */}
      <div className="px-2 sm:px-4 py-3 sm:py-4 pb-safe">
        <div className="max-w-2xl mx-auto">
          <div className="relative rounded-full overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 bg-graphite rounded-full px-2.5 sm:px-3.5 py-2 sm:py-2.5 relative">
              {/* BorderBeam - Smaller size on mobile, larger on desktop */}
              <BorderBeam 
                size={isMobile ? 150 : 250}
                duration={12} 
                delay={0}
                borderWidth={1.5}
                colorFrom="#E9F28E"
                colorTo="rgba(233, 242, 142, 0.3)"
                className="rounded-full"
              />
            {/* Plus Icon */}
            <button
              ref={plusButtonRef}
              type="button"
              disabled={disabled}
              className="flex-shrink-0 text-signal-white hover:text-aurora transition-colors disabled:opacity-50 cursor-pointer w-10 h-10 rounded-full bg-graphite/80 border border-graphite/50 flex items-center justify-center"
              onClick={handlePlusClick}
              onMouseDown={(e) => {
                // Prevent form submission when clicking plus
                e.preventDefault();
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                // Also prevent on pointer events
                e.preventDefault();
                e.stopPropagation();
              }}
              aria-label="Open attachment menu"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

        {/* Input Field */}
            <input
              type="text"
              ref={inputRef}
            value={message}
              onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
              placeholder={placeholder || "Ask anything"}
            disabled={disabled}
            className={cn(
                "flex-1 bg-transparent border-none outline-none",
                "text-signal-white placeholder:text-soft-mist/50",
                "text-sm sm:text-[15px] leading-6",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "touch-manipulation" // Prevent double-tap zoom on mobile
              )}
            style={{ fontSize: '16px' }} // Prevent iOS zoom on focus
            />

            {/* Camera Icon (when empty) or Send Icon (when user has typed) */}
            {!isListening && (
              <div className="flex items-center gap-2 sm:gap-3">
                {hasText ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleSendClick}
                    className="flex-shrink-0 text-signal-white hover:text-aurora transition-colors disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                ) : (
                  <>
                    {/* Location Icon for sharing location */}
                    <button
                      type="button"
                      disabled={disabled || isGettingLocation}
                      onClick={handleShareLocation}
                      className="flex-shrink-0 text-signal-white hover:text-aurora transition-colors disabled:opacity-50"
                      aria-label="Share location"
                      title="Share your location for delivery tracking"
                    >
                      {isGettingLocation ? (
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-signal-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                    {/* Camera Icon for QR Scanning */}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setShowQRScanner(true)}
                      className="flex-shrink-0 text-signal-white hover:text-aurora transition-colors disabled:opacity-50"
                      aria-label="Scan QR code"
                    >
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    {/* Microphone Icon */}
                    <button
                      type="button"
                      disabled={disabled || !voiceSupported}
                      onClick={() => {
                        setIsListening(true);
                        const stop = startVoiceRecognition(
                          (result) => {
                            if (result.text) {
                              setMessage(result.text);
                              if (result.confidence && result.confidence > 0.7) {
                                setTimeout(() => {
                                  onSendMessage(result.text);
                                  setMessage("");
                                }, 300);
                              }
                            }
                            setIsListening(false);
                            stopRecognitionRef.current = null;
                          },
                          (error) => {
                            console.error("Voice recognition error:", error);
                            setIsListening(false);
                            stopRecognitionRef.current = null;
                          }
                        );
                        stopRecognitionRef.current = stop;
                      }}
                      className="flex-shrink-0 text-signal-white hover:text-aurora transition-colors disabled:opacity-50"
                      aria-label="Start voice recording"
                    >
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Sound Wave Button (when listening) */}
            {isListening && (
              <button
                type="button"
                onClick={() => {
                  if (stopRecognitionRef.current) {
                    stopRecognitionRef.current();
                    setIsListening(false);
                    stopRecognitionRef.current = null;
                  }
                }}
                className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-signal-white flex items-center justify-center hover:bg-soft-mist transition-colors"
                aria-label="Stop voice recording"
              >
                <SoundWaveIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-carbon" />
              </button>
            )}
            </div>
          </div>
        </div>
      </div>
    </form>
    
    {/* Attachment Menu - Rendered outside form to avoid pointer-events issues */}
    {showAttachmentMenu && (
      <AttachmentMenu
        isOpen={showAttachmentMenu}
        onClose={() => {
          console.log("[ChatInput] Closing attachment menu");
          setShowAttachmentMenu(false);
        }}
        onSelect={(action) => {
          // Handle different actions
          switch (action) {
            case "upload":
              // Trigger file upload
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.accept = "image/*,video/*,.pdf,.doc,.docx,.txt";
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files.length > 0) {
                  const fileNames = Array.from(files).map(f => f.name).join(", ");
                  onSendMessage(`Uploaded: ${fileNames}`);
                }
              };
              input.click();
              break;
            case "place-order":
              onSendMessage("I want to place an order with one of our partner vendors. Can you help me with that?");
              break;
            case "create-payment-link":
              onSendMessage("Create a payment link");
              break;
            case "send-invoice":
              onSendMessage("Create and send an invoice");
              break;
            case "request-payment":
              onSendMessage("Request payment from a client");
              break;
            case "transaction-receipt":
              onSendMessage("Generate transaction receipt");
              break;
            case "schedule-payment":
              onSendMessage("Schedule a payment");
              break;
            case "payroll":
              onSendMessage("Set up payroll");
              break;
            case "multiple-payment":
              onSendMessage("Send multiple payments");
              break;
            case "export-data":
              onSendMessage("Export my transaction data");
              break;
            default:
              break;
          }
          setShowAttachmentMenu(false);
        }}
        anchorRef={plusButtonRef}
      />
    )}

    {/* QR Code Scanner */}
    <QRCodeScanner
      isOpen={showQRScanner}
      onClose={() => setShowQRScanner(false)}
      onScan={(data) => {
        setShowQRScanner(false);
        if (onQRCodeScanned) {
          onQRCodeScanned(data);
        }
        // Auto-send message based on QR code type
        if (data.type === "usdc_address" && data.address) {
          onSendMessage(`Send USDC to ${data.address}`);
        } else if (data.type === "fiat_payment") {
          const amountText = data.amount ? ` ${data.amount} ${data.currency || "USD"}` : "";
          onSendMessage(`Process payment${amountText} from scanned QR code`);
        } else {
          onSendMessage(`Scanned QR code: ${data.rawData}`);
        }
      }}
    />
    </>
  );
}

