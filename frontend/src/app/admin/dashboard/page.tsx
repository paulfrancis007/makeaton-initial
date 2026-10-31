"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  RefreshCw,
  Receipt,
  CreditCard,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Clock,
  ArrowRight,
  Play,
} from "lucide-react";
import { dashboardApi, AdminDashboardData } from "@/lib/api";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getAdminDashboard();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-indigo-600" />
            Executive & Operations Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time subscription metrics, revenue collections, overdue receivables and billing status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/invoices"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-700 transition"
          >
            <Play className="h-3.5 w-3.5" /> Run Billing
          </Link>
          <button
            onClick={loadDashboard}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      ) : loading || !data ? (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          Aggregating platform metrics...
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Customers */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customers
                </span>
                <Users className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {data.metrics.total_customers}
                </span>
                <span className="text-xs text-emerald-600 font-medium">
                  {data.metrics.active_customers} active
                </span>
              </div>
            </div>

            {/* Subscriptions */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Subscriptions
                </span>
                <RefreshCw className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  {data.metrics.active_subscriptions}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  of {data.metrics.total_subscriptions} total
                </span>
              </div>
            </div>

            {/* Total Invoiced */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Invoiced
                </span>
                <Receipt className="h-4 w-4 text-slate-600" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-slate-900">
                  ${data.metrics.total_invoiced.toFixed(2)}
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Across {data.metrics.invoices_count} invoices
                </span>
              </div>
            </div>

            {/* Total Collected */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Collected
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-emerald-700">
                  ${data.metrics.total_collected.toFixed(2)}
                </span>
                <span className="block text-[11px] text-emerald-600 font-medium mt-0.5">
                  Settled receipts
                </span>
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Outstanding
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-700">
                  ${data.metrics.total_outstanding.toFixed(2)}
                </span>
                <span className="block text-[11px] text-amber-600 font-medium mt-0.5">
                  Receivables pending
                </span>
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Overdue
                </span>
                <AlertCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-rose-700">
                  ${data.metrics.overdue_amount.toFixed(2)}
                </span>
                <span className="block text-[11px] text-rose-600 font-semibold mt-0.5">
                  {data.metrics.overdue_invoices_count} past-due invoices
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Invoices */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  Recent Invoices
                </h3>
                <Link
                  href="/admin/invoices"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {data.recent_invoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No invoices generated yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.recent_invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3">{inv.customer_name || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            ${inv.total_amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-700 font-bold">
                            ${inv.balance_due.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : inv.status === "PARTIALLY_PAID"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Recent Settlements
                </h3>
                <Link
                  href="/admin/payments"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {data.recent_payments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Payment #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.recent_payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {p.payment_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.payment_date}</td>
                          <td className="py-2.5 px-3 font-medium">{p.payment_method}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            +${p.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
