import Link from "next/link";
import { Layers, CheckCircle2, ShieldCheck, Database, ArrowRight, Clock } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
        <div className="flex items-center gap-3 text-indigo-600 mb-6">
          <Layers className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Brightloop
            </h1>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              Phase 1 Delivered &bull; Foundation Verified
            </span>
          </div>
        </div>

        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          Subscription Management System with native PostgreSQL 18 relational persistence, FastAPI backend, and Next.js App Router.
        </p>

        {/* Active Delivered Controls */}
        <div className="mb-8">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Delivered in Phase 1
          </h2>
          <Link
            href="/health-check"
            className="p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-400 transition-all group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 block"
          >
            <div>
              <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <span>Development Readiness Diagnostic Check</span>
              </div>
              <p className="text-sm text-slate-600">
                Live verification of FastAPI liveness, PostgreSQL 18 relational connectivity, and company/currency metadata.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-indigo-700 font-semibold whitespace-nowrap group-hover:translate-x-1 transition-transform">
              <span>Run checks</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* Roadmap Preview Cards (Non-clickable during Phase 1 to prevent 404s) */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Implementation Roadmap (Upcoming Phases)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <Layers className="w-5 h-5 text-slate-400" />
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Clock className="w-3 h-3" />
                  <span>Phase 2</span>
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Identity &amp; Auth</p>
              <p className="text-xs text-slate-500">
                Customer signup, login, password reset, and staff accounts.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className="w-5 h-5 text-slate-400" />
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <Clock className="w-3 h-3" />
                  <span>Phases 2–7</span>
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Operational Shell</p>
              <p className="text-xs text-slate-500">
                Admin and staff catalog, quotes, invoices, payments, and dashboards.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <Database className="w-5 h-5 text-slate-400" />
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  <Clock className="w-3 h-3" />
                  <span>Phases 2–7</span>
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">Customer Portal</p>
              <p className="text-xs text-slate-500">
                Self-service view for owned subscriptions, invoices, and requests.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Phase 1 Gate: Foundation &bull; Schema Migrations &bull; Tested PostgreSQL</span>
          <span>FastAPI + PostgreSQL 18</span>
        </div>
      </div>
    </main>
  );
}
