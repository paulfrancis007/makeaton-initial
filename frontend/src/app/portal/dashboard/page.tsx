"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Receipt,
  CreditCard,
  AlertCircle,
  Download,
  Building2,
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
      if (!res) {
        throw new Error("No customer portal data returned from server");
      }
      const rawMetrics = res.metrics || {};
      const normalizedData: CustomerDashboardData = {
        customer: res.customer || {
          id: (res.customer_ids && res.customer_ids[0]) || "",
          company_name: "Customer Account",
        },
        metrics: {
          active_subscriptions: Number(rawMetrics.active_subscriptions ?? res.active_subscriptions_count ?? 0),
          total_subscriptions: Number(rawMetrics.total_subscriptions ?? res.active_subscriptions_count ?? 0),
          outstanding_balance: Number(rawMetrics.outstanding_balance ?? res.total_outstanding_balance ?? 0),
          total_paid: Number(rawMetrics.total_paid || 0),
          unpaid_invoices_count: Number(rawMetrics.unpaid_invoices_count || 0),
        },
        subscriptions: Array.isArray(res.subscriptions)
          ? res.subscriptions.map((s: any) => ({
              id: String(s.id),
              subscription_number: String(s.subscription_number || ""),
              start_date: String(s.start_date || s.current_period_start || ""),
              next_billing_date: s.next_billing_date ? String(s.next_billing_date) : null,
              status: String(s.status || "ACTIVE"),
            }))
          : Array.isArray(res.active_subscriptions)
          ? res.active_subscriptions.map((s: any) => ({
              id: String(s.id),
              subscription_number: String(s.subscription_number || ""),
              start_date: String(s.start_date || s.current_period_start || ""),
              next_billing_date: s.next_billing_date ? String(s.next_billing_date) : null,
              status: String(s.status || "ACTIVE"),
            }))
          : [],
        recent_invoices: Array.isArray(res.recent_invoices)
          ? res.recent_invoices.map((inv: any) => ({
              id: String(inv.id),
              invoice_number: String(inv.invoice_number || ""),
              due_date: String(inv.due_date || ""),
              total_amount: Number(inv.total_amount || 0),
              status: String(inv.status || ""),
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
            }))
          : [],
      };
      setData(normalizedData);
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
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-nb-yellow text-nb-dark border-2 sm:border-3 border-nb-dark p-6 sm:p-8 shadow-nb-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-nb-dark text-nb-dark text-xs font-black uppercase tracking-wider shadow-nb-sm mb-3">
            <Building2 className="h-4 w-4 stroke-[2.5]" />
            {data?.customer.company_name || "Enterprise Account"}
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Customer Self-Service Portal
          </h1>
          <p className="text-xs font-bold text-zinc-700 mt-1 max-w-2xl leading-relaxed">
            Welcome back, {user?.full_name || "Customer"}. Manage your active subscriptions, review billing history, and download invoice tax documents.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="nb-btn nb-btn-white p-3 text-nb-dark"
          title="Refresh dashboard"
        >
          <RefreshCw className={`h-5 w-5 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="p-5 bg-nb-coral text-white border-2 border-nb-dark shadow-nb flex items-center gap-3 text-xs font-bold">
          <AlertCircle className="h-5 w-5 stroke-[2.5] shrink-0" />
          <span>{error}</span>
        </div>
      ) : loading || !data ? (
        <div className="py-24 text-center text-nb-dark flex flex-col items-center gap-3 bg-white border-2 border-nb-dark shadow-nb">
          <RefreshCw className="h-8 w-8 animate-spin stroke-[2.5] text-nb-dark" />
          <span className="text-xs font-black uppercase tracking-wider">Loading account overview...</span>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white border-2 sm:border-3 border-nb-dark p-5 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Active Subscriptions
                </span>
                <div className="p-1.5 bg-nb-blue border-2 border-nb-dark text-white shadow-nb-sm">
                  <RefreshCw className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-nb-dark">
                  {data.metrics.active_subscriptions}
                </span>
                <span className="text-xs font-bold text-zinc-600">
                  of {data.metrics.total_subscriptions} total
                </span>
              </div>
            </div>

            <div className="bg-white border-2 sm:border-3 border-nb-dark p-5 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Outstanding Balance
                </span>
                <div className="p-1.5 bg-nb-yellow border-2 border-nb-dark text-nb-dark shadow-nb-sm">
                  <Clock className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-4">
                <span
                  className={`text-3xl font-black ${
                    data.metrics.outstanding_balance > 0
                      ? "text-nb-coral"
                      : "text-nb-dark"
                  }`}
                >
                  ${data.metrics.outstanding_balance.toFixed(2)}
                </span>
                <span className="block text-xs font-bold text-zinc-600 mt-1">
                  Across {data.metrics.unpaid_invoices_count} pending invoices
                </span>
              </div>
            </div>

            <div className="bg-white border-2 sm:border-3 border-nb-dark p-5 shadow-nb flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  Total Settled
                </span>
                <div className="p-1.5 bg-nb-green border-2 border-nb-dark text-nb-dark shadow-nb-sm">
                  <CreditCard className="h-4 w-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-nb-dark">
                  ${data.metrics.total_paid.toFixed(2)}
                </span>
                <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider bg-nb-green border border-nb-dark px-1.5 py-0.5">
                  Lifetime payment volume
                </span>
              </div>
            </div>
          </div>

          {/* Subscriptions Section */}
          <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb">
            <div className="p-4 border-b-2 border-nb-dark bg-cream">
              <h3 className="text-sm font-black uppercase tracking-wider text-nb-dark flex items-center gap-2">
                <RefreshCw className="h-4 w-4 stroke-[2.5]" />
                Your Subscriptions
              </h3>
            </div>
            {data.subscriptions.length === 0 ? (
              <div className="p-8 text-center text-xs font-bold text-zinc-500">
                No active subscriptions on your account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-nb-dark text-white border-b-2 border-nb-dark font-black uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Subscription #</th>
                      <th className="py-2.5 px-4">Start Date</th>
                      <th className="py-2.5 px-4">Next Billing Date</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-nb-dark text-nb-dark font-bold">
                    {data.subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-cream transition-colors">
                        <td className="py-3 px-4 font-mono font-black">
                          {sub.subscription_number}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 font-mono">{sub.start_date}</td>
                        <td className="py-3 px-4 font-mono font-black">
                          {sub.next_billing_date || "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border border-nb-dark shadow-nb-sm ${
                              sub.status === "ACTIVE"
                                ? "bg-nb-green text-nb-dark"
                                : "bg-white text-nb-dark"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Invoices */}
            <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb">
              <div className="p-4 border-b-2 border-nb-dark bg-cream flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-nb-dark flex items-center gap-2">
                  <Receipt className="h-4 w-4 stroke-[2.5]" />
                  Recent Invoices
                </h3>
                <Link
                  href="/portal/invoices"
                  className="text-xs font-black uppercase tracking-wider text-nb-dark hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight className="h-3.5 w-3.5 stroke-[2.5]" />
                </Link>
              </div>
              {data.recent_invoices.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-zinc-500">
                  No billing invoices issued yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-nb-dark text-white border-b-2 border-nb-dark font-black uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Document</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-nb-dark text-nb-dark font-bold">
                      {data.recent_invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-cream transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 font-mono">{inv.due_date}</td>
                          <td className="py-2.5 px-3 text-right font-black">
                            ${inv.total_amount.toFixed(2)}
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
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                              className="nb-btn nb-btn-white inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider"
                            >
                              <Download className="h-3 w-3 stroke-[2.5]" /> PDF
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
            <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb">
              <div className="p-4 border-b-2 border-nb-dark bg-cream">
                <h3 className="text-sm font-black uppercase tracking-wider text-nb-dark flex items-center gap-2">
                  <CreditCard className="h-4 w-4 stroke-[2.5]" />
                  Settlement History
                </h3>
              </div>
              {data.recent_payments.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-zinc-500">
                  No payment records found.
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
                            ${p.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-green text-nb-dark border border-nb-dark shadow-nb-sm">
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
