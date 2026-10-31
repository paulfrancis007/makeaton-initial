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
  Building2,
  CreditCard,
  LayoutDashboard,
  ShieldAlert,
  UserCheck,
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
      accentBg: "bg-nb-yellow",
    },
    {
      title: "Invoices & Recurring Billing",
      description: "Manage recurring billing runs, generate compliant invoices, download PDFs, and send receipts.",
      href: "/admin/invoices",
      icon: Receipt,
      badge: "Billing",
      accentBg: "bg-nb-blue text-white",
    },
    {
      title: "Payments & Settlements",
      description: "Record partial/full settlements, track transaction references, and authorize immutable voids.",
      href: "/admin/payments",
      icon: CreditCard,
      badge: "Payments",
      accentBg: "bg-nb-green",
    },
    {
      title: "Customer Self-Service Portal",
      description: "Customer view of active subscriptions, outstanding balances, payment history, and tax invoices.",
      href: "/portal/dashboard",
      icon: UserCheck,
      badge: "Customer Portal",
      accentBg: "bg-nb-purple",
    },
    {
      title: "Subscription Lifecycle",
      description: "Convert quotations to active contracts, manage pause/resume history, and handle terminations.",
      href: "/admin/subscriptions",
      icon: Repeat,
      badge: "Lifecycle",
      accentBg: "bg-nb-coral text-white",
    },
    {
      title: "Quotation Management",
      description: "Prepare quotations, apply frozen pricing, calculate rounding adjustments, and manage approval workflows.",
      href: "/admin/quotations",
      icon: FileText,
      badge: "Sales",
      accentBg: "bg-nb-yellow",
    },
    {
      title: "Product Catalogue",
      description: "Manage billable goods, services, add-ons, pricing models, and SKU variants.",
      href: "/admin/products",
      icon: Package,
      badge: "Catalog",
      accentBg: "bg-nb-blue text-white",
    },
    {
      title: "Subscription Plans",
      description: "Configure billing intervals, quantity thresholds, auto-renew rules, and pause permissions.",
      href: "/admin/plans",
      icon: Layers,
      badge: "Plans",
      accentBg: "bg-nb-green",
    },
    {
      title: "Tax Rules & Exclusions",
      description: "Maintain statutory tax rates, compound taxation, and GiST exclusion temporal bounds.",
      href: "/admin/taxes",
      icon: Receipt,
      badge: "Taxes",
      accentBg: "bg-nb-coral text-white",
    },
    {
      title: "Discount Engine",
      description: "Create order and line-item discount rules, apply percentage or fixed amounts with duration bounds.",
      href: "/admin/discounts",
      icon: Percent,
      badge: "Discounts",
      accentBg: "bg-nb-purple",
    },
    {
      title: "System Audit Trail",
      description: "Tamper-evident log tracking financial transactions, voids, billing engine runs, and administrative events.",
      href: "/admin/audit",
      icon: ShieldAlert,
      badge: "Admin Only",
      accentBg: "bg-nb-dark text-white",
    },
    {
      title: "Sign In / Role Switcher",
      description: "Switch between Administrator, Operations Staff, and Customer user accounts with quick pre-filled credentials.",
      href: "/login",
      icon: LogIn,
      badge: "Auth",
      accentBg: "bg-nb-pink",
    },
  ];

  return (
    <div className="min-h-screen bg-cream text-nb-dark selection:bg-nb-yellow selection:text-nb-dark p-4 sm:p-8 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Top Hero Banner */}
        <header className="bg-white border-2 sm:border-3 border-nb-dark p-6 sm:p-8 shadow-nb-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-nb-yellow border-2 border-nb-dark px-3 py-1 text-xs font-black uppercase tracking-wider shadow-nb-sm">
              <span className="h-2.5 w-2.5 bg-nb-dark animate-pulse" />
              Production Ready • Neo-Brutalist Architecture
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight flex items-center gap-3">
              <div className="h-12 w-12 bg-nb-coral border-2 border-nb-dark flex items-center justify-center text-white shadow-nb-sm">
                <Building2 className="h-7 w-7 stroke-[2.5]" />
              </div>
              Brightloop
            </h1>
            <p className="text-sm font-bold text-zinc-700 max-w-2xl leading-relaxed">
              Enterprise Subscription Management, Automated Recurring Billing Engine, Tax Snapshotting & Ledger Settlement System.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-3">
            <Link
              href="/login"
              className="nb-btn nb-btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider"
            >
              <LogIn className="h-4 w-4 stroke-[2.5]" />
              Sign In / Role Switcher
            </Link>
            <div className="text-xs font-bold border-2 border-nb-dark p-2.5 bg-cream shadow-nb-sm">
              <div className="text-[10px] uppercase font-black tracking-wider text-zinc-600">REST API Gateway:</div>
              <code className="text-nb-dark font-mono font-bold">http://localhost:8000/api/v1</code>
            </div>
          </div>
        </header>

        {/* Modules Section */}
        <section className="space-y-6">
          <div className="border-b-2 border-nb-dark pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">
                Operations & Management Consoles
              </h2>
              <p className="text-xs font-bold text-zinc-600 mt-1">
                Unified role-based interfaces with real-time PostgreSQL persistence.
              </p>
            </div>
            <span className="hidden sm:inline-block px-3 py-1 bg-white border-2 border-nb-dark font-black text-xs uppercase shadow-nb-sm">
              12 Active Modules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href + mod.title}
                  href={mod.href}
                  className="group bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb hover:shadow-nb-lg hover:-translate-x-1 hover:-translate-y-1 transition-all duration-150 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`h-12 w-12 border-2 border-nb-dark flex items-center justify-center shadow-nb-sm ${mod.accentBg}`}
                      >
                        <Icon className="h-6 w-6 stroke-[2.5]" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-white border-2 border-nb-dark px-2.5 py-0.5 shadow-nb-sm">
                        {mod.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight group-hover:text-nb-blue transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs font-bold text-zinc-600 mt-2 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t-2 border-nb-dark flex items-center justify-between text-xs font-black uppercase tracking-wider">
                    <span>Open Console</span>
                    <div className="h-6 w-6 bg-nb-yellow border-2 border-nb-dark flex items-center justify-center group-hover:translate-x-1 transition-transform shadow-nb-sm">
                      <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-2 sm:border-3 border-nb-dark bg-white p-6 shadow-nb flex flex-col sm:flex-row items-center justify-between text-xs font-black uppercase tracking-wider gap-4">
          <p className="text-zinc-700">
            Brightloop • Synchronous PostgreSQL 16 + SQLAlchemy 2.x • Psycopg 3 • Next.js
          </p>
          <p className="font-mono bg-cream px-3 py-1 border-2 border-nb-dark shadow-nb-sm">
            NUMERIC(12,2) • BANKER&apos;S ROUNDING • GI-ST EXCLUSIONS
          </p>
        </footer>
      </div>
    </div>
  );
}
