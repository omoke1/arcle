"use client";

import { BorderBeam } from "@/components/ui/border-beam";

export function BorderBeamDemo() {
  return (
    <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-md border bg-background md:shadow-xl">
      <span className="pointer-events-none whitespace-pre-wrap bg-gradient-to-b from-black to-gray-300/80 bg-clip-text text-center text-8xl font-semibold leading-none text-transparent dark:from-white dark:to-slate-900/10">
        Arcle
      </span>
      <p className="mt-4 text-center text-lg md:text-xl text-white/60 font-extralight tracking-wide">
        money moves faster in chat
      </p>
      <BorderBeam size={250} duration={12} delay={9} />
    </div>
  );
}



