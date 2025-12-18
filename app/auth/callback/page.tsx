"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            const supabase = getSupabaseClient();

            // The supabase client is configured with detectSessionInUrl: true
            // so it should automatically parse the hash and set the session.
            // We just need to give it a moment or check session status.

            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error("Auth callback error:", error);
                router.push("/?error=" + encodeURIComponent(error.message));
                return;
            }

            if (session) {
                console.log("Auth callback successful, session found");
                router.push("/chat"); // Or home page which will redirect to chat
            } else {
                // Wait a bit for the hash parsing to happen if it hasn't yet
                // (Supabase client does this on init, so it should be fast)
                // If still no session after a check, maybe redirect to home
                setTimeout(async () => {
                    const { data: { session: retrySession } } = await supabase.auth.getSession();
                    if (retrySession) {
                        router.push("/chat");
                    } else {
                        console.warn("No session found after callback");
                        router.push("/");
                    }
                }, 1000);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-aurora" />
                <p className="text-white/60">Completing sign in...</p>
            </div>
        </div>
    );
}
