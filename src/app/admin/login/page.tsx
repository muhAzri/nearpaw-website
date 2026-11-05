import type { Metadata } from "next";
import { LoginView } from "@/frontend/features/admin";

export const metadata: Metadata = { title: "Sign in" };

export default function AdminLoginPage() {
  return <LoginView />;
}
