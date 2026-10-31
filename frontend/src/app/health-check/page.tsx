"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, RefreshCw, ArrowLeft, Database, Server, Building } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";

interface HealthState {
  loading: boolean;
  error?: string;
  liveness?: { status: string; app: string; environment: string };
  readiness?: { status: string; database: string; environment: string };
  metadata?: {
    company_name: string;
    company_tax_id?: string;
    company_email: string;
    company_phone?: string;
    default_currency: string;
    timezone: string;
  };
}

export default function DevelopmentHealthPage() {
  const [state, setState] = useState<HealthState>({ loading: true });

  const runChecks = async () => {
    setState({ loading: true });
    try {
      const [liveness, readiness, metadata] = await Promise.all([
        apiClient<{ status: string; app: string; environment: string }>("/health"),
        apiClient<{ status: string; database: string; environment: string }>("/ready"),
        apiClient<{
          company_name: string;
          company_tax_id?: string;
          company_email: string;
          company_phone?: string;
          default_currency: string;
          timezone: string;
        }>("/meta"),
      ]);
      setState({ loading: false, liveness, readiness, metadata });
    } catch (err: any) {
      const message = err instanceof ApiError ? `${err.code}: ${err.message}` : err.message || "Unknown error";
      setState({ loading: false, error: message });
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium mb-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to home</span>
            </Link>
            <h1 className="text-xl font-bold text-slate-900">
              Development Health &amp; Readiness
            </h1>
            <p className="text-xs text-slate-500">
              Temporary diagnostic page (Phase 1 gate verification)
            </p>
          </div>
          <button
            onClick={runChecks}
            disabled={state.loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state.loading ? "animate-spin" : ""}`} />
            <span>Recheck</span>
          </button>
        </div>

        {state.loading && (
          <div className="py-12 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>Checking backend and database connectivity...</span>
          </div>
        )}

        {state.error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 mb-6">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-semibold">Backend Connection Failed</p>
              <p className="text-xs mt-1 text-red-600">{state.error}</p>
              <p className="text-xs mt-2 text-slate-500">
                Ensure the FastAPI backend is running at http://127.0.0.1:8000.
              </p>
            </div>
          </div>
        )}

        {!state.loading && !state.error && (
          <div className="space-y-4">
            {/* Liveness Check */}
            <div className="p-4 rounded-lg border border-emerald-100 bg-emerald-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">FastAPI Backend Liveness</p>
                  <p className="text-xs text-slate-500">
                    Application: {state.liveness?.app} &bull; Environment: {state.liveness?.environment}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{state.liveness?.status.toUpperCase()}</span>
              </span>
            </div>

            {/* Database Readiness Check */}
            <div className="p-4 rounded-lg border border-emerald-100 bg-emerald-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">PostgreSQL Relational Readiness</p>
                  <p className="text-xs text-slate-500">
                    Status: {state.readiness?.database} &bull; Native PostgreSQL 18
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{state.readiness?.status.toUpperCase()}</span>
              </span>
            </div>

            {/* Company & Currency Config */}
            <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-3 text-slate-900 font-semibold text-sm">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Configured Issuer &amp; Currency Context</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Company:</span>{" "}
                  <span className="font-medium text-slate-700">{state.metadata?.company_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Tax ID:</span>{" "}
                  <span className="font-medium text-slate-700">{state.metadata?.company_tax_id || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400">Default Currency:</span>{" "}
                  <span className="font-semibold text-indigo-700">{state.metadata?.default_currency}</span>
                </div>
                <div>
                  <span className="text-slate-400">Business Timezone:</span>{" "}
                  <span className="font-medium text-slate-700">{state.metadata?.timezone}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          Phase 1 Gate: Foundation &bull; Database Schema &bull; Reproducible Startup
        </div>
      </div>
    </div>
  );
}
