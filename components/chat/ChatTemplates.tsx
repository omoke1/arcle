"use client";

import { Button } from "@/components/ui/button";
import { CalendarDays, Search, SendHorizonal } from "lucide-react";

interface ChatTemplatesProps {
  onSendTemplate: () => void;
  onScanTemplate: () => void;
  onScheduleTemplate: () => void;
  className?: string;
}

export function ChatTemplates({ onSendTemplate, onScanTemplate, onScheduleTemplate, className }: ChatTemplatesProps) {
  return (
    <div className={"px-4 pt-2 pb-1 " + (className || "")}> 
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-3 py-1.5 text-white bg-dark-grey/50 hover:bg-dark-grey"
            onClick={onSendTemplate}
            aria-label="Send template"
          >
            <SendHorizonal className="w-4 h-4 mr-2" /> Send
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-3 py-1.5 text-white bg-dark-grey/50 hover:bg-dark-grey"
            onClick={onScanTemplate}
            aria-label="Scan template"
          >
            <Search className="w-4 h-4 mr-2" /> Scan
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-3 py-1.5 text-white bg-dark-grey/50 hover:bg-dark-grey"
            onClick={onScheduleTemplate}
            aria-label="Schedule template"
          >
            <CalendarDays className="w-4 h-4 mr-2" /> Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}

