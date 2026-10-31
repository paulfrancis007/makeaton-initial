import Link from "next/link";
import { Layers, CheckCircle2, ShieldCheck, Database, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
        <div className="flex items-center gap-3 text-indigo-600 mb-6">
          <Layers className="w-10 h-10" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Brightloop
          </h1>
        </div>

        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          Subscription Management System with native PostgreSQL 18 relational persistence, FastAPI backend, and Next.js App Router.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/health-check"
            className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-1">
                <CheckCircle2 className="w-5 h-5" />
                <span>Development Readiness Check</span>
              </div>
              <p className="text-sm text-slate-500">
                Verify live backend connectivity, database readiness, and company metadata.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-sm text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
              <span>Run checks</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          <Link
            href="/app"
            className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-1">
                <ShieldCheck className="w-5 h-5" />
                <span>Operational Portal Shell</span>
              </div>
              <p className="text-sm text-slate-500">
                Foundation for Admin and Staff operations (Dashboards, Customers, Subscriptions).
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-sm text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
              <span>View app shell</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          <Link
            href="/portal"
            className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-1">
                <Database className="w-5 h-5" />
                <span>Customer Portal Shell</span>
              </div>
              <p className="text-sm text-slate-500">
                Self-service shell for customer subscriptions, invoices, and payment history.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-sm text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
              <span>View portal shell</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          <Link
            href="/login"
            className="p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-1">
                <Layers className="w-5 h-5" />
                <span>Authentication Shell</span>
              </div>
              <p className="text-sm text-slate-500">
                Sign-in and password management container for all roles.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-sm text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
              <span>Go to sign in</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <span>Phase 1: Foundation &amp; Database Architecture</span>
          <span>FastAPI + PostgreSQL 18</span>
        </div>
      </div>
    </main>
  );
}
