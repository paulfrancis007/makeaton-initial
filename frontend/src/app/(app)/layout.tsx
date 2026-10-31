import React from "react";
import Link from "next/link";
import { Layers, Users, FileText, CreditCard, LayoutDashboard, Settings } from "lucide-react";

export default function OperationalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/app" className="flex items-center gap-2 text-indigo-600 font-bold text-xl tracking-tight">
              <Layers className="w-6 h-6" />
              <span>Brightloop</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-700">
              <Link href="/app" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link href="/app/customers" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>Customers</span>
              </Link>
              <Link href="/app/subscriptions" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span>Subscriptions</span>
              </Link>
              <Link href="/app/invoices" className="px-3 py-2 rounded-md hover:bg-slate-100 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                <span>Invoices</span>
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              Operations Shell
            </span>
            <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Operational Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Brightloop Operations Portal &bull; Asia/Kolkata
      </footer>
    </div>
  );
}
