"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "cb_user_id";

/**
 * Anonymous per-browser identity (no auth yet). Generates a UUID on first
 * visit and persists it in localStorage; returns null until mounted so
 * server/client render match (localStorage isn't available during SSR).
 */
export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(STORAGE_KEY, id);
    }
    setUserId(id);
  }, []);

  return userId;
}
