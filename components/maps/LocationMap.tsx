"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  className?: string;
  height?: string;
  showMarker?: boolean;
}

/**
 * LocationMap - Displays a location on Google Maps
 * Uses Google Maps Embed API (no API key required for basic embeds)
 */
export function LocationMap({
  latitude,
  longitude,
  address,
  className,
  height = "300px",
  showMarker = true,
}: LocationMapProps) {
  // Google Maps Embed URL
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&q=${latitude},${longitude}&zoom=15`;

  // Fallback to static map if no API key
  const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const staticMapUrl = hasApiKey 
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=600x300&markers=color:red%7C${latitude},${longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01},${latitude - 0.01},${longitude + 0.01},${latitude + 0.01}&layer=mapnik&marker=${latitude},${longitude}`;

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-white/10", className)}>
      {hasApiKey ? (
        <iframe
          src={mapUrl}
          width="100%"
          height={height}
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full"
        />
      ) : (
        <div className="relative" style={{ height }}>
          {hasApiKey ? (
            <img
              src={staticMapUrl}
              alt="Location map"
              className="w-full h-full object-cover"
            />
          ) : (
            <iframe
              src={staticMapUrl}
              width="100%"
              height={height}
              style={{ border: 0 }}
              className="w-full"
            />
          )}
          {showMarker && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <MapPin className="w-8 h-8 text-red-500 drop-shadow-lg" />
            </div>
          )}
        </div>
      )}
      
      {/* Address overlay */}
      {address && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-sm">
          <p className="truncate">{address}</p>
        </div>
      )}
      
      {/* Open in Google Maps link */}
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
      >
        Open in Maps
      </a>
    </div>
  );
}

