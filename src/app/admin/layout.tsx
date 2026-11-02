import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireProfile("admin");
  return <AppShell role="admin" name={profile.full_name || "Administração"}>{children}</AppShell>;
}
