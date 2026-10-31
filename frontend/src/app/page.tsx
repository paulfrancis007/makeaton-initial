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
} from "lucide-react";

export default function HomePage() {
  const adminModules = [
    {
      title: "Quotation Management",
      description: "Prepare quotations, apply frozen pricing, calculate rounding adjustments, and manage approval workflows.",
      href: "/admin/quotations",
      icon: FileText,
      badge: "Stage 9",
      color: "from-amber-500 to-orange-600",
    },
    {
      title: "Subscription Lifecycle",
      description: "Convert confirmed quotations into active contracts, manage pause/resume history, and handle terminations.",
      href: "/admin/subscriptions",
      icon: Repeat,
      badge: "Stage 10",
      color: "from-teal-600 to-emerald-600",
    },
    {
      title: "Product Catalogue",
      description: "Manage billable goods, services, add-ons, pricing models, and SKU variants.",
      href: "/admin/products",
      icon: Package,
      badge: "Stage 7",
      color: "from-indigo-500 to-blue-600",
    },
    {
      title: "Subscription Plans",
      description: "Configure billing intervals, quantity thresholds, auto-renew rules, and pause permissions.",
      href: "/admin/plans",
      icon: Layers,
      badge: "Stage 7",
      color: "from-blue-600 to-cyan-600",
    },
    {
      title: "Tax Rules & Exclusions",
      description: "Maintain GST/VAT statutory rates, compound taxation, and GiST exclusion temporal bounds.",
      href: "/admin/taxes",
      icon: Receipt,
      badge: "Stage 7",
      color: "from-emerald-600 to-teal-600",
    },
    {
      title: "Discount Rules & Engine",
      description: "Create order and product discount codes, configure cycle frequencies, and test real-time calculations.",
      href: "/admin/discounts",
      icon: Percent,
      badge: "Stage 8",
      color: "from-purple-600 to-indigo-600",
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
              Stages 9 & 10 Active • Quotations & Subscription Lifecycle
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-indigo-600" />
            Brightloop
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise Subscription Management & Financial Billing Platform
          </p>
        </div>
        <div className="text-xs text-slate-500 border border-slate-200 rounded-lg p-3 bg-white shadow-xs">
          <div className="font-medium text-slate-700">API Gateway:</div>
          <code className="text-indigo-600 font-mono">http://localhost:8000/api/v1</code>
        </div>
      </header>

      {/* Admin Catalogue & Discount Launchpad */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Operational Management & Lifecycle Consoles
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Role-authorized administrative consoles for catalog maintenance, quotations, and subscription lifecycle.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {adminModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group relative bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {mod.badge}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition text-base">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
                  <span>Open Console</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Role Architecture Baseline */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 text-slate-900">
          <Shield className="h-6 w-6 text-indigo-600" />
          <h2 className="text-lg font-bold">Role-Based Access Control Architecture</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-1">
              ADMIN ROLE
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Full authority: configure catalog, tax rates, discount rules, manage staff, manage quotation templates, review customer subscriptions, and trigger billing runs.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">
              STAFF ROLE
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Operational authority: prepare and issue quotations, confirm quotations, convert confirmed quotations to subscriptions, pause/resume subscriptions. Cannot alter administrative configuration.
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
              CUSTOMER ROLE
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">
              Strict multi-tenant customer isolation: forbidden from administrative configuration endpoints; restricted to reviewing their own organization's quotations and active subscriptions.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
        Brightloop Subscription Management System • Completed Combined Stage 9 + Stage 10
      </footer>
    </main>
  );
}
