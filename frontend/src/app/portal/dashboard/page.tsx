"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  RefreshCw,
  Receipt,
  CreditCard,
  AlertCircle,
  Download,
  Calendar,
  Building2,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { dashboardApi, invoiceApi, CustomerDashboardData } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function CustomerPortalDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<CustomerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getCustomerDashboard();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load account dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleDownloadPdf = async (id: string, invoiceNumber: string) => {
    try {
      const blob = await invoiceApi.downloadPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to download PDF receipt");
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-indigo-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-800/80 text-indigo-200 text-xs font-semibold mb-2">
            <Building2 className="h-3.5 w-3.5" />
            {data?.customer.company_name || "Enterprise Account"}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Customer Self-Service Portal
          </h1>
          <p className="text-indigo-200 text-xs mt-1">
            Welcome back, {user?.full_name || "Customer"}. Manage your active subscriptions, review billing history, and download invoice tax documents.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="p-2 rounded-lg bg-indigo-800 hover:bg-indigo-700 text-indigo-100 transition"
          title="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      ) : loading || !data ? (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
          Loading account overview...
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Subscriptions
                </span>
                <RefreshCw className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900">
                  {data.metrics.active_subscriptions}
                </span>
                <span className="text-xs text-slate-500">
                  of {data.metrics.total_subscriptions} total
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Outstanding Balance
                </span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="mt-2">
                <span
                  className={`text-3xl font-bold ${
                    data.metrics.outstanding_balance > 0
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }`}
                >
                  ${data.metrics.outstanding_balance.toFixed(2)}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  Across {data.metrics.unpaid_invoices_count} pending invoices
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Settled
                </span>
                <CreditCard className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold text-emerald-700">
                  ${data.metrics.total_paid.toFixed(2)}
                </span>
                <span className="block text-xs text-emerald-600 font-medium mt-0.5">
                  Lifetime payment volume
                </span>
              </div>
            </div>
          </div>

          {/* Subscriptions Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-indigo-600" />
                Your Subscriptions
              </h3>
            </div>
            {data.subscriptions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No active subscriptions on your account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Subscription #</th>
                      <th className="py-2.5 px-4">Start Date</th>
                      <th className="py-2.5 px-4">Next Billing Date</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {sub.subscription_number}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{sub.start_date}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {sub.next_billing_date || "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Invoices & Receipts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoices */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  Recent Invoices
                </h3>
                <Link
                  href="/portal/invoices"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {data.recent_invoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No billing invoices issued yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-100 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {data.recent_invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{inv.due_date}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            ${inv.total_amount.toFixed(2)}
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
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold"
                            >
                              <Download className="h-3 w-3 text-indigo-600" /> PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payments History */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  Settlement History
                </h3>
              </div>
              {data.recent_payments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No payment records found.
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
                          <td className="py-2.5 px-3">{p.payment_method}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            ${p.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
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
