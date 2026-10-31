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
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { setStoredToken } from "@/lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
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

  const roleBadgeStyle = {
    ADMIN: "bg-nb-purple text-nb-dark border-2 border-nb-dark shadow-nb-sm",
    STAFF: "bg-nb-blue text-white border-2 border-nb-dark shadow-nb-sm",
    CUSTOMER: "bg-nb-green text-nb-dark border-2 border-nb-dark shadow-nb-sm",
  };

  return (
    <header className="bg-white border-b-2 sm:border-b-3 border-nb-dark sticky top-0 z-30 shadow-nb">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="h-10 w-10 bg-nb-yellow border-2 border-nb-dark flex items-center justify-center text-nb-dark font-black shadow-nb-sm group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-nb transition-all">
                <Building2 className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-black text-nb-dark text-lg leading-tight tracking-tight block uppercase">
                  Brightloop
                </span>
                <span className="text-[10px] text-nb-dark font-bold uppercase tracking-wider block bg-nb-green px-1 border border-nb-dark inline-block mt-0.5">
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all rounded-none ${
                      isActive
                        ? "bg-nb-yellow text-nb-dark border-2 border-nb-dark shadow-nb-sm -translate-y-0.5"
                        : "text-nb-dark border-2 border-transparent hover:border-nb-dark hover:bg-cream hover:shadow-nb-sm"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 stroke-[2.5]" />
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
                  <span className="text-xs font-extrabold text-nb-dark">{user.full_name}</span>
                  <span className="text-[10px] text-zinc-600 font-mono font-bold">{user.email}</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 text-[11px] font-black tracking-wider uppercase ${
                    roleBadgeStyle[user.role as keyof typeof roleBadgeStyle] ||
                    "bg-cream text-nb-dark border-2 border-nb-dark shadow-nb-sm"
                  }`}
                >
                  {user.role}
                </span>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 border-2 border-nb-dark bg-white hover:bg-nb-coral hover:text-white shadow-nb-sm transition-all"
                >
                  <LogOut className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider"
                >
                  <LogIn className="h-3.5 w-3.5 stroke-[2.5]" />
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="p-1.5 border-2 border-nb-dark bg-white text-nb-dark hover:bg-nb-yellow shadow-nb-sm transition-all"
                  title="Manual Bearer Token Input"
                >
                  <KeyRound className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Direct Token Input */}
        {showTokenInput && (
          <form
            onSubmit={handleSaveToken}
            className="flex items-center gap-2 py-2.5 border-t-2 border-nb-dark bg-cream px-3 mt-1 mb-2 border-2 shadow-nb-sm"
          >
            <div className="relative flex-1">
              <KeyRound className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-nb-dark" />
              <input
                type="password"
                placeholder="Paste Bearer JWT Token..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="nb-input pl-8 pr-3 py-1.5 text-xs w-full font-mono bg-white"
              />
            </div>
            <button
              type="submit"
              className="nb-btn nb-btn-primary px-3 py-1.5 text-xs font-black uppercase"
            >
              {tokenSavedMsg ? "Saved!" : "Save Token"}
            </button>
          </form>
        )}

        {/* Mobile / Overflow Navigation */}
        <div className="xl:hidden flex overflow-x-auto py-2.5 space-x-2 border-t-2 border-nb-dark">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase whitespace-nowrap transition-all border-2 ${
                  isActive
                    ? "bg-nb-yellow text-nb-dark border-nb-dark shadow-nb-sm"
                    : "bg-white text-nb-dark border-nb-dark hover:bg-cream"
                }`}
              >
                <Icon className="h-3.5 w-3.5 stroke-[2.5]" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
