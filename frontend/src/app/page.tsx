import React from "react";
import Link from "next/link";
import {
  Package,
  Layers,
  Receipt,
  Percent,
  FileText,
  Repeat,
  ArrowRight,
  Shield,
  Building2,
  CreditCard,
  LayoutDashboard,
  ShieldAlert,
  UserCheck,
  Play,
  LogIn,
} from "lucide-react";

export default function HomePage() {
  const coreModules = [
    {
      title: "Executive & Ops Dashboard",
      description: "Real-time metrics, MRR, overdue receivables, collection rates, and recent transactions.",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      badge: "Dashboard",
      color: "from-indigo-600 to-blue-600",
    },
    {
      title: "Invoices & Recurring Billing",
      description: "Manage recurring billing runs, generate compliant invoices, download PDFs, and send receipts.",
      href: "/admin/invoices",
      icon: Receipt,
      badge: "Billing",
      color: "from-blue-600 to-cyan-600",
    },
    {
      title: "Payments & Settlements",
      description: "Record partial/full settlements, track transaction references, and authorize immutable voids.",
      href: "/admin/payments",
      icon: CreditCard,
      badge: "Payments",
      color: "from-emerald-600 to-teal-600",
    },
    {
      title: "Customer Self-Service Portal",
      description: "Customer view of active subscriptions, outstanding balances, payment history, and tax invoices.",
      href: "/portal/dashboard",
      icon: UserCheck,
      badge: "Customer Portal",
      color: "from-purple-600 to-indigo-600",
    },
    {
      title: "Subscription Lifecycle",
      description: "Convert quotations to active contracts, manage pause/resume history, and handle terminations.",
      href: "/admin/subscriptions",
      icon: Repeat,
      badge: "Lifecycle",
      color: "from-teal-600 to-emerald-600",
    },
    {
      title: "Quotation Management",
      description: "Prepare quotations, apply frozen pricing, calculate rounding adjustments, and manage approval workflows.",
      href: "/admin/quotations",
      icon: FileText,
      badge: "Sales",
      color: "from-amber-500 to-orange-600",
    },
    {
      title: "Product Catalogue",
      description: "Manage billable goods, services, add-ons, pricing models, and SKU variants.",
      href: "/admin/products",
      icon: Package,
      badge: "Catalog",
      color: "from-indigo-500 to-blue-600",
    },
    {
      title: "Subscription Plans",
      description: "Configure billing intervals, quantity thresholds, auto-renew rules, and pause permissions.",
      href: "/admin/plans",
      icon: Layers,
      badge: "Plans",
      color: "from-blue-600 to-cyan-600",
    },
    {
      title: "Tax Rules & Exclusions",
      description: "Maintain statutory tax rates, compound taxation, and GiST exclusion temporal bounds.",
      href: "/admin/taxes",
      icon: Receipt,
      badge: "Taxes",
      color: "from-emerald-600 to-teal-600",
    },
    {
      title: "Discount Engine",
      description: "Create order and line-item discount rules, apply percentage or fixed amounts with duration bounds.",
      href: "/admin/discounts",
      icon: Percent,
      badge: "Discounts",
      color: "from-purple-600 to-indigo-600",
    },
    {
      title: "System Audit Trail",
      description: "Tamper-evident log tracking financial transactions, voids, billing engine runs, and administrative events.",
      href: "/admin/audit",
      icon: ShieldAlert,
      badge: "Admin Only",
      color: "from-slate-700 to-slate-900",
    },
    {
      title: "Sign In / Role Switcher",
      description: "Switch between Administrator, Operations Staff, and Customer user accounts with quick pre-filled credentials.",
      href: "/login",
      icon: LogIn,
      badge: "Auth",
      color: "from-rose-600 to-pink-600",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-7xl mx-auto space-y-12">
      {/* Top Header */}
      <header className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Stages 11–18 Complete • Enterprise Platform Ready
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-600" />
            Brightloop
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise Subscription Management, Recurring Billing Engine & Financial Ledger
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-700 transition"
          >
            <LogIn className="h-4 w-4" /> Sign In / Quick Demo Switch
          </Link>
          <div className="text-xs text-slate-500 border border-slate-200 rounded-lg p-2.5 bg-white shadow-xs hidden sm:block">
            <div className="font-medium text-slate-700">API Gateway:</div>
            <code className="text-indigo-600 font-mono">http://localhost:8000/api/v1</code>
          </div>
        </div>
      </header>

      {/* Modules Launchpad */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Platform Capabilities & Operations Consoles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-tailored interfaces for Administrators, Staff, and Customer Self-Service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coreModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href + mod.title}
                href={mod.href}
                className="group relative bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${mod.color} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {mod.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-indigo-600 group-hover:text-indigo-700">
                  Open Console
                  <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <p>
          Brightloop • Synchronous PostgreSQL 16 + SQLAlchemy 2.x • Psycopg 3 • Next.js 15
        </p>
        <p className="font-mono text-slate-400">
          Precision: Numeric(12,2) • Strict Overpayment Rejection • Banker&apos;s Rounding
        </p>
      </footer>
    </main>
  );
}
