import React from "react";
import Link from "next/link";
import { Layers, FileText, CreditCard, User } from "lucide-react";

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Customer Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/portal" className="flex items-center gap-2 text-indigo-600 font-bold text-xl tracking-tight">
              <Layers className="w-6 h-6" />
              <span>Customer Portal</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-700">
              <Link href="/portal/subscriptions" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>My Subscriptions</span>
              </Link>
              <Link href="/portal/invoices" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span>My Invoices</span>
              </Link>
              <Link href="/portal/profile" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>Profile</span>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium">
              Log In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Secure Customer Self-Service &bull; Brightloop
      </footer>
    </div>
  );
}
