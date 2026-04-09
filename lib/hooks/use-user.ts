"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/auth-provider";

export function useUser() {
  return useContext(AuthContext);
}
