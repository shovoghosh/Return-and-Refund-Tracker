"use client";

import { useMemo } from "react";

/** Fallback list if the runtime lacks Intl.supportedValuesOf. */
const FALLBACK = [
  "UTC",
  "America/Edmonton",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

/**
 * Time zone options for the settings picker. Uses the platform's canonical list
 * when available so users can always find their zone; the current value is
 * always included even if it is somehow absent from the list.
 */
export function useTimezoneOptions(current: string | undefined): string[] {
  return useMemo(() => {
    let zones: string[] = FALLBACK;
    try {
      const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
        .supportedValuesOf;
      if (typeof supported === "function") zones = supported("timeZone");
    } catch {
      zones = FALLBACK;
    }
    const set = new Set(zones);
    if (current) set.add(current);
    return [...set].sort();
  }, [current]);
}
