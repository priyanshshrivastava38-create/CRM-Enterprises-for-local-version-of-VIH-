"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ShellUser } from "@/components/shell/Sidebar";

const ShellUserContext = createContext<ShellUser | null>(null);

export const ShellUserProvider = ShellUserContext.Provider;

export function useShellUser() {
  return useContext(ShellUserContext);
}

/** "Good morning, Priya" — computed after mount so server and browser clocks/timezones can't disagree. */
export function useGreeting() {
  const user = useShellUser();
  const [partOfDay, setPartOfDay] = useState<string | null>(null);
  useEffect(() => {
    const hour = new Date().getHours();
    setPartOfDay(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);
  const firstName = user?.name.split(/\s+/)[0] ?? "";
  return `${partOfDay ?? "Welcome back"}${firstName ? `, ${firstName}` : ""}`;
}
