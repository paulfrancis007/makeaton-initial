"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  Layers,
  Percent,
  Receipt,
  FileText,
  RefreshCw,
  KeyRound,
  CheckCircle,
  Building2,
} from "lucide-react";
import { getStoredToken, setStoredToken } from "../lib/api";

export default function Navbar() {
  const pathname = usePathname();
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [tokenSavedMsg, setTokenSavedMsg] = useState(false);

  useEffect(() => {
    const t = getStoredToken();
    if (t) {
      setHasToken(true);
      setTokenInput(t);
    }
  }, []);

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredToken(tokenInput.trim());
    setHasToken(!!tokenInput.trim());
    setTokenSavedMsg(true);
    setTimeout(() => setTokenSavedMsg(false), 2500);
  };

  const navLinks = [
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/plans", label: "Plans", icon: Layers },
    { href: "/admin/taxes", label: "Taxes", icon: Receipt },
    { href: "/admin/discounts", label: "Discounts", icon: Percent },
    { href: "/admin/quotations", label: "Quotations", icon: FileText },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: RefreshCw },
  ];

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
                  Admin Console
                </span>
              </div>
            </Link>

            <nav className="hidden lg:flex space-x-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
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
            <form onSubmit={handleSaveToken} className="flex items-center gap-2">
              <div className="relative">
                <KeyRound className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="Bearer JWT Token..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-36 sm:w-52 font-mono"
                  title="Paste JWT Bearer Token (Admin / Staff) to authenticate API requests"
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white hover:bg-slate-800 transition shadow-2xs flex items-center gap-1"
              >
                {tokenSavedMsg ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    Saved
                  </>
                ) : (
                  "Save Auth"
                )}
              </button>
            </form>

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${
                  hasToken ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
              <span className="text-slate-500 text-[11px]">
                {hasToken ? "Active" : "No Auth"}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden flex overflow-x-auto py-2 space-x-2 border-t border-slate-100">
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
