import React from "react";
import { CheckCircle2, Shield, Layers, Users, Database } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-6xl mx-auto">
      <header className="border-b border-slate-200 pb-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Stage 1 Foundation Active
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mt-2">
            Brightloop
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Subscription Management System
          </p>
        </div>
        <div className="text-xs text-slate-500 border border-slate-200 rounded-lg p-3 bg-white shadow-sm">
          <div className="font-medium text-slate-700">API Health Endpoint:</div>
          <code className="text-indigo-600 font-mono">http://localhost:8000/api/v1/health</code>
        </div>
      </header>

      <section className="space-y-8 my-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-slate-900 mb-4">
            <Layers className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">System Architecture & Status</h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Stage 1 has established the frontend and backend baseline. The frontend is powered by Next.js 15 App Router with TypeScript and Tailwind CSS, communicating with a modular FastAPI backend and a Dockerized PostgreSQL 16 database.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Next.js Frontend</h3>
                <p className="text-xs text-slate-500 mt-1">App Router, TypeScript, Tailwind CSS, Lucide icons ready.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">FastAPI Backend</h3>
                <p className="text-xs text-slate-500 mt-1">Pydantic v2 settings, CORS, health check at /api/v1/health.</p>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-3">
              <Database className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">PostgreSQL Service</h3>
                <p className="text-xs text-slate-500 mt-1">Docker Compose configured for PostgreSQL 16 on port 5432.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 text-slate-900 mb-4">
            <Users className="h-6 w-6 text-indigo-600" />
            <h2 className="text-xl font-semibold">Planned Role Boundaries</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-slate-900 text-sm">ADMIN</h3>
              </div>
              <p className="text-xs text-slate-600">
                Full catalog authority, tax & discount management, staff provisioning, billing execution, and system-wide revenue analytics.
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-sm">STAFF</h3>
              </div>
              <p className="text-xs text-slate-600">
                Operational customer management, quotation preparation from templates, subscription confirmations, invoice dispatch, and payment recording.
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="font-semibold text-slate-900 text-sm">CUSTOMER</h3>
              </div>
              <p className="text-xs text-slate-600">
                Self-service customer portal strictly isolated to own profile, active subscriptions, downloadable invoices, and payment histories.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-6 mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <p>Brightloop Subscription Management System — Stage 1 Foundation</p>
        <p className="font-mono text-slate-400">makeaton-initial</p>
      </footer>
    </main>
  );
}
