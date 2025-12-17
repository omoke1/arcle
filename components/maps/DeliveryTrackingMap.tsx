"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationMap } from "./LocationMap";

interface DeliveryTrackingMapProps {
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryLatitude: number;
  deliveryLongitude: number;
  currentLatitude?: number;
  currentLongitude?: number;
  dispatcherName?: string;
  estimatedArrival?: string;
  className?: string;
  height?: string;
}

/**
 * DeliveryTrackingMap - Shows delivery route with pickup, delivery, and current location
 */
export function DeliveryTrackingMap({
  pickupLatitude,
  pickupLongitude,
  deliveryLatitude,
  deliveryLongitude,
  currentLatitude,
  currentLongitude,
  dispatcherName,
  estimatedArrival,
  className,
  height = "400px",
}: DeliveryTrackingMapProps) {
  // Calculate center point between pickup and delivery
  const centerLat = (pickupLatitude + deliveryLatitude) / 2;
  const centerLng = (pickupLongitude + deliveryLongitude) / 2;

  // Google Maps directions URL
  const directionsUrl = `https://www.google.com/maps/dir/${pickupLatitude},${pickupLongitude}/${deliveryLatitude},${deliveryLongitude}`;
  
  // Google Maps Embed with waypoints
  const mapUrl = `https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}&origin=${pickupLatitude},${pickupLongitude}&destination=${deliveryLatitude},${deliveryLongitude}&zoom=13`;

  const hasApiKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-white/10 bg-[#1C1C1C]", className)}>
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
          {/* Fallback: Static map with route */}
          <img
            src={`https://maps.googleapis.com/maps/api/staticmap?size=600x400&path=color:0xE9F28E|weight:5|${pickupLatitude},${pickupLongitude}|${deliveryLatitude},${deliveryLongitude}&markers=color:green%7Clabel:P%7C${pickupLatitude},${pickupLongitude}&markers=color:red%7Clabel:D%7C${deliveryLatitude},${deliveryLongitude}${currentLatitude && currentLongitude ? `&markers=color:blue%7Clabel:C%7C${currentLatitude},${currentLongitude}` : ''}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`}
            alt="Delivery route"
            className="w-full h-full object-cover"
          />
          
          {/* Custom markers overlay */}
          <div className="absolute top-4 left-4 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <Package className="w-3 h-3" />
            Pickup
          </div>
          <div className="absolute top-4 right-4 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Delivery
          </div>
          {currentLatitude && currentLongitude && (
            <div className="absolute bottom-20 left-4 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Current
            </div>
          )}
        </div>
      )}

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-3">
        <div className="flex items-center justify-between">
          <div>
            {dispatcherName && (
              <p className="text-sm font-medium">Rider: {dispatcherName}</p>
            )}
            {estimatedArrival && (
              <p className="text-xs text-white/70 mt-1">
                ETA: {new Date(estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#E9F28E] hover:bg-[#E9F28E]/90 text-black px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
          >
            View Route
          </a>
        </div>
      </div>
    </div>
  );
}

