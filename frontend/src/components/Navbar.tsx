"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  Layers,
  Percent,
  Receipt,
  FileText,
  RefreshCw,
  Building2,
  CreditCard,
  LayoutDashboard,
  ShieldAlert,
  LogOut,
  LogIn,
  KeyRound,
  CheckCircle,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { setStoredToken } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, token, logout } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSavedMsg, setTokenSavedMsg] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredToken(tokenInput.trim());
    setTokenSavedMsg(true);
    setTimeout(() => {
      setTokenSavedMsg(false);
      window.location.reload();
    }, 1000);
  };

  // Determine navigation items based on role
  let navLinks: { href: string; label: string; icon: any }[] = [];

  if (role === "ADMIN" || role === "STAFF") {
    navLinks = [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/invoices", label: "Invoices", icon: Receipt },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: RefreshCw },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/plans", label: "Plans", icon: Layers },
      { href: "/admin/taxes", label: "Taxes", icon: Receipt },
      { href: "/admin/discounts", label: "Discounts", icon: Percent },
    ];
    if (role === "ADMIN") {
      navLinks.push({ href: "/admin/audit", label: "Audit", icon: ShieldAlert });
    }
  } else if (role === "CUSTOMER") {
    navLinks = [
      { href: "/portal/dashboard", label: "Portal", icon: LayoutDashboard },
      { href: "/portal/invoices", label: "My Invoices", icon: Receipt },
    ];
  } else {
    // Default preview / public links
    navLinks = [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/invoices", label: "Invoices", icon: Receipt },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: RefreshCw },
      { href: "/admin/quotations", label: "Quotations", icon: FileText },
      { href: "/admin/products", label: "Catalog", icon: Package },
      { href: "/portal/dashboard", label: "Customer Portal", icon: UserCheck },
    ];
  }

  const roleBadgeColor = {
    ADMIN: "bg-purple-100 text-purple-800 border-purple-200",
    STAFF: "bg-blue-100 text-blue-800 border-blue-200",
    CUSTOMER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs group-hover:bg-indigo-700 transition">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg leading-tight block">
                  Brightloop
                </span>
                <span className="text-[11px] text-slate-500 font-medium tracking-tight block">
                  Subscription Cloud
                </span>
              </div>
            </Link>

            <nav className="hidden xl:flex space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* User Session Info or Login CTA */}
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-semibold text-slate-900">{user.full_name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{user.email}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${
                    roleBadgeColor[user.role as keyof typeof roleBadgeColor] ||
                    "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {user.role}
                </span>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-2xs"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                  title="Manual Bearer Token Input"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Direct Token Input */}
        {showTokenInput && (
          <form
            onSubmit={handleSaveToken}
            className="flex items-center gap-2 py-2 border-t border-slate-100 bg-slate-50 px-2 rounded-b-md"
          >
            <div className="relative flex-1">
              <KeyRound className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Paste Bearer JWT Token..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs rounded-md border border-slate-300 w-full font-mono bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
            >
              {tokenSavedMsg ? "Saved" : "Save Token"}
            </button>
          </form>
        )}

        {/* Mobile / Overflow Navigation */}
        <div className="xl:hidden flex overflow-x-auto py-2 space-x-2 border-t border-slate-100">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
