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
      if (!res) {
        throw new Error("No dashboard data returned from server");
      }
      const rawMetrics = res.metrics || res.overview || {};
      const normalizedData: AdminDashboardData = {
        period: res.period,
        overview: res.overview,
        metrics: {
          total_customers: Number(rawMetrics.total_customers || 0),
          active_customers: Number(rawMetrics.active_customers ?? rawMetrics.total_customers ?? 0),
          total_subscriptions: Number(rawMetrics.total_subscriptions || 0),
          active_subscriptions: Number(rawMetrics.active_subscriptions || 0),
          total_invoiced: Number(rawMetrics.total_invoiced ?? rawMetrics.total_invoiced_amount ?? 0),
          total_collected: Number(rawMetrics.total_collected ?? rawMetrics.total_payments_collected ?? 0),
          total_outstanding: Number(rawMetrics.total_outstanding ?? rawMetrics.outstanding_balance ?? 0),
          overdue_amount: Number(rawMetrics.overdue_amount || 0),
          invoices_count: Number(rawMetrics.invoices_count ?? rawMetrics.total_invoices ?? 0),
          overdue_invoices_count: Number(rawMetrics.overdue_invoices_count || 0),
        },
        recent_invoices: Array.isArray(res.recent_invoices)
          ? res.recent_invoices.map((inv: any) => ({
              id: String(inv.id),
              invoice_number: String(inv.invoice_number || ""),
              customer_name: inv.customer_name ?? null,
              total_amount: Number(inv.total_amount || 0),
              balance_due: Number(inv.balance_due || 0),
              status: String(inv.status || "DRAFT"),
              issue_date: String(inv.issue_date || ""),
              due_date: String(inv.due_date || ""),
            }))
          : [],
        recent_payments: Array.isArray(res.recent_payments)
          ? res.recent_payments.map((p: any) => ({
              id: String(p.id),
              payment_number: String(p.payment_number || ""),
              payment_date: String(p.payment_date || ""),
              payment_method: String(p.payment_method || ""),
              amount: Number(p.amount || 0),
              status: String(p.status || "SUCCESS"),
              invoice_number: p.invoice_number ?? null,
            }))
          : [],
      };
      setData(normalizedData);
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
    <div className="space-y-8">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-yellow border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Operations Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <LayoutDashboard className="h-7 w-7 stroke-[2.5]" />
            Executive & Operations Dashboard
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Real-time subscription metrics, revenue collections, overdue receivables and billing status.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/invoices"
            className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider"
          >
            <Play className="h-4 w-4 stroke-[2.5]" /> Run Billing
          </Link>
          <button
            onClick={loadDashboard}
            className="nb-btn nb-btn-white p-2.5 text-nb-dark"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-4 w-4 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-5 bg-nb-coral text-white border-2 border-nb-dark shadow-nb flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="h-5 w-5 stroke-[2.5] shrink-0" />
          <span>{error}</span>
        </div>
      ) : loading || !data ? (
        <div className="py-24 text-center text-nb-dark flex flex-col items-center gap-3 bg-white border-2 border-nb-dark shadow-nb">
          <RefreshCw className="h-8 w-8 animate-spin stroke-[2.5] text-nb-dark" />
          <span className="text-xs font-black uppercase tracking-wider">Aggregating platform metrics...</span>
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Customers */}
            <div className="bg-white border-2 border-nb-dark p-4 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Customers
                </span>
                <div className="p-1.5 bg-nb-purple border-2 border-nb-dark shadow-nb-sm">
                  <Users className="h-4 w-4 stroke-[2.5] text-nb-dark" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-nb-dark">
                  {data.metrics.total_customers}
                </div>
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide bg-nb-green border border-nb-dark px-1.5 py-0.5">
                  {data.metrics.active_customers} active
                </span>
              </div>
            </div>

            {/* Subscriptions */}
            <div className="bg-white border-2 border-nb-dark p-4 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Subscriptions
                </span>
                <div className="p-1.5 bg-nb-blue border-2 border-nb-dark shadow-nb-sm text-white">
                  <RefreshCw className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-nb-dark">
                  {data.metrics.active_subscriptions}
                </div>
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide bg-cream border border-nb-dark px-1.5 py-0.5">
                  of {data.metrics.total_subscriptions} total
                </span>
              </div>
            </div>

            {/* Total Invoiced */}
            <div className="bg-white border-2 border-nb-dark p-4 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Total Invoiced
                </span>
                <div className="p-1.5 bg-nb-yellow border-2 border-nb-dark shadow-nb-sm">
                  <Receipt className="h-4 w-4 stroke-[2.5] text-nb-dark" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-nb-dark">
                  ${data.metrics.total_invoiced.toFixed(2)}
                </div>
                <span className="block text-[10px] font-bold text-zinc-600 mt-1">
                  {data.metrics.invoices_count} invoices
                </span>
              </div>
            </div>

            {/* Total Collected */}
            <div className="bg-white border-2 border-nb-dark p-4 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Collected
                </span>
                <div className="p-1.5 bg-nb-green border-2 border-nb-dark shadow-nb-sm">
                  <TrendingUp className="h-4 w-4 stroke-[2.5] text-nb-dark" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-nb-dark">
                  ${data.metrics.total_collected.toFixed(2)}
                </div>
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide bg-nb-green border border-nb-dark px-1.5 py-0.5">
                  Settled receipts
                </span>
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className="bg-white border-2 border-nb-dark p-4 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Outstanding
                </span>
                <div className="p-1.5 bg-nb-yellow border-2 border-nb-dark shadow-nb-sm">
                  <Clock className="h-4 w-4 stroke-[2.5] text-nb-dark" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-nb-dark">
                  ${data.metrics.total_outstanding.toFixed(2)}
                </div>
                <span className="block text-[10px] font-bold text-zinc-600 mt-1">
                  Receivables pending
                </span>
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-white border-2 border-nb-dark p-4 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Overdue
                </span>
                <div className="p-1.5 bg-nb-coral border-2 border-nb-dark shadow-nb-sm text-white">
                  <AlertCircle className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black tracking-tight text-nb-coral">
                  ${data.metrics.overdue_amount.toFixed(2)}
                </div>
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wide bg-nb-coral text-white border border-nb-dark px-1.5 py-0.5">
                  {data.metrics.overdue_invoices_count} past-due
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tables Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Invoices */}
            <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb">
              <div className="p-4 border-b-2 border-nb-dark bg-cream flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-nb-dark flex items-center gap-2">
                  <Receipt className="h-4 w-4 stroke-[2.5]" />
                  Recent Invoices
                </h3>
                <Link
                  href="/admin/invoices"
                  className="text-xs font-black uppercase tracking-wider text-nb-dark hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </Link>
              </div>
              {data.recent_invoices.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-zinc-500">
                  No invoices generated yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-nb-dark text-white border-b-2 border-nb-dark font-black uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-nb-dark text-nb-dark font-bold">
                      {data.recent_invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-cream transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3">{inv.customer_name || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-black">
                            ${inv.total_amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black">
                            ${inv.balance_due.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-nb-dark shadow-nb-sm ${
                                inv.status === "PAID"
                                  ? "bg-nb-green text-nb-dark"
                                  : inv.status === "PARTIALLY_PAID"
                                  ? "bg-nb-yellow text-nb-dark"
                                  : "bg-white text-nb-dark"
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
            <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb">
              <div className="p-4 border-b-2 border-nb-dark bg-cream flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-nb-dark flex items-center gap-2">
                  <CreditCard className="h-4 w-4 stroke-[2.5]" />
                  Recent Settlements
                </h3>
                <Link
                  href="/admin/payments"
                  className="text-xs font-black uppercase tracking-wider text-nb-dark hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </Link>
              </div>
              {data.recent_payments.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-zinc-500">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-nb-dark text-white border-b-2 border-nb-dark font-black uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Payment #</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-nb-dark text-nb-dark font-bold">
                      {data.recent_payments.map((p) => (
                        <tr key={p.id} className="hover:bg-cream transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black">
                            {p.payment_number}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 font-mono">{p.payment_date}</td>
                          <td className="py-2.5 px-3 font-black">{p.payment_method}</td>
                          <td className="py-2.5 px-3 text-right font-black">
                            +${p.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-nb-dark shadow-nb-sm ${
                                p.status === "SUCCESS"
                                  ? "bg-nb-green text-nb-dark"
                                  : "bg-nb-coral text-white"
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
