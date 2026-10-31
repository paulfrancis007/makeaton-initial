"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  X,
  Eye,
  Calendar,
  Building,
  ShieldAlert,
} from "lucide-react";
import {
  subscriptionApi,
  Subscription,
  SubscriptionDetail,
} from "@/lib/api";

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [subDetail, setSubDetail] = useState<SubscriptionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pause Modal
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Close Modal
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await subscriptionApi.listSubscriptions({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        page,
        page_size: 10,
      });
      setSubscriptions(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const loadSubDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await subscriptionApi.getSubscription(id);
      setSubDetail(detail);
      setSelectedSubId(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load subscription details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!subDetail) return;
    setActionLoading(true);
    try {
      await subscriptionApi.activate(subDetail.id);
      loadSubDetail(subDetail.id);
      loadSubscriptions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to activate");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subDetail) return;
    setActionLoading(true);
    try {
      await subscriptionApi.pause(subDetail.id, pauseReason || undefined);
      setIsPauseOpen(false);
      setPauseReason("");
      loadSubDetail(subDetail.id);
      loadSubscriptions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to pause");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!subDetail) return;
    setActionLoading(true);
    try {
      await subscriptionApi.resume(subDetail.id);
      loadSubDetail(subDetail.id);
      loadSubscriptions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to resume");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subDetail) return;
    setActionLoading(true);
    try {
      await subscriptionApi.close(subDetail.id, closeReason || undefined);
      setIsCloseOpen(false);
      setCloseReason("");
      loadSubDetail(subDetail.id);
      loadSubscriptions();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to close subscription");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVE</span>;
      case "PAUSED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">PAUSED</span>;
      case "CONFIRMED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">CONFIRMED</span>;
      case "CLOSED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">CLOSED</span>;
      case "EXPIRED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">EXPIRED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <RefreshCw className="h-6 w-6" />
            <h1 className="text-2xl font-bold text-slate-900">Subscription Lifecycle</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage active customer contracts, billing cycles, pause/resume durations, renewal boundaries, and plan snapshots.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by subscription number or plan..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PAUSED">PAUSED</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading subscriptions...</div>
        ) : subscriptions.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No subscriptions found</h3>
            <p className="text-xs text-slate-500 mt-1">Convert approved customer quotations to activate contracts.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Subscription #</th>
                <th className="px-6 py-3 text-left">Plan Snapshot</th>
                <th className="px-6 py-3 text-left">Current Period</th>
                <th className="px-6 py-3 text-left">Next Billing</th>
                <th className="px-6 py-3 text-right">Recurring Total</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/75 transition">
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-indigo-700">{s.subscription_number}</div>
                    <div className="text-xs text-slate-400 font-mono">Anchor: Day {s.billing_anchor_day}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{s.plan_name_snapshot}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {s.interval_count_snapshot > 1 ? `${s.interval_count_snapshot} ` : ""}
                      {s.billing_interval_snapshot}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-600">
                    <div>{s.current_period_start} → {s.current_period_end}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono font-semibold text-indigo-900">
                    {s.next_billing_date}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                    ₹{Number(s.recurring_total_amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(s.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => loadSubDetail(s.id)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-indigo-600" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>Page {page} of {totalPages}</div>
            <div className="space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Detail Modal */}
      {selectedSubId && subDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Top Bar */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono text-indigo-900">
                    {subDetail.subscription_number}
                  </h2>
                  {getStatusBadge(subDetail.status)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-4">
                  <span>Customer: <strong className="text-slate-800">{subDetail.customer_company_name || subDetail.customer_id}</strong></span>
                  <span>Plan: <strong className="text-slate-800">{subDetail.plan_name_snapshot}</strong></span>
                  <span>Billing Anchor: <strong className="text-slate-800">Day {subDetail.billing_anchor_day}</strong></span>
                </div>
              </div>
              <button onClick={() => setSelectedSubId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Terms & Period Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Period Start</span>
                <span className="font-semibold text-slate-800">{subDetail.current_period_start}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Period End</span>
                <span className="font-semibold text-slate-800">{subDetail.current_period_end}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Next Invoice Date</span>
                <span className="font-semibold text-indigo-700">{subDetail.next_billing_date}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">Payment Terms</span>
                <span className="font-semibold text-slate-800">{subDetail.payment_terms_days} Days</span>
              </div>
            </div>

            {/* Agreed Subscription Lines */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Agreed Contract Lines & Pricing Snapshots
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-right">Agreed Unit Price</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Tax Rate</th>
                      <th className="px-3 py-2 text-right">Recurring Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {subDetail.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">{l.description_snapshot}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 border text-slate-700">
                            {l.line_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">₹{Number(l.unit_price_snapshot).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center font-mono">{l.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">{Number(l.tax_rate_snapshot).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">₹{Number(l.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pause History Table */}
            {subDetail.pause_history && subDetail.pause_history.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Pause & Suspension History
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-3 py-1.5 text-left">Paused At</th>
                        <th className="px-3 py-1.5 text-left">Resumed At</th>
                        <th className="px-3 py-1.5 text-left">Reason</th>
                        <th className="px-3 py-1.5 text-right">Days Extended</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {subDetail.pause_history.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-1.5 font-mono">{new Date(p.paused_at).toLocaleString()}</td>
                          <td className="px-3 py-1.5 font-mono">
                            {p.resumed_at ? new Date(p.resumed_at).toLocaleString() : <span className="text-amber-600 font-semibold">Currently Paused</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{p.pause_reason || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-semibold">{p.days_extended} d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-end text-xs space-y-1 font-mono">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Recurring Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{Number(subDetail.recurring_subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Recurring Discount:</span>
                <span className="text-emerald-700">- ₹{Number(subDetail.recurring_discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Recurring Tax:</span>
                <span className="text-slate-900">+ ₹{Number(subDetail.recurring_tax).toFixed(2)}</span>
              </div>
              <div className="border-t border-slate-300 pt-1.5 flex justify-between w-64 text-sm font-bold text-indigo-900">
                <span>Recurring Cycle Total:</span>
                <span>₹{Number(subDetail.recurring_total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Lifecycle Transitions Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                Status: {subDetail.status}
              </div>
              <div className="flex items-center gap-2">
                {subDetail.status === "CONFIRMED" && (
                  <button
                    disabled={actionLoading}
                    onClick={handleActivate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    <Play className="h-3.5 w-3.5" /> Activate Contract
                  </button>
                )}

                {subDetail.status === "ACTIVE" && (
                  <>
                    {subDetail.allow_pause_snapshot && (
                      <button
                        onClick={() => setIsPauseOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        <Pause className="h-3.5 w-3.5" /> Pause
                      </button>
                    )}
                    <button
                      onClick={() => setIsCloseOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium"
                    >
                      Close / Terminate
                    </button>
                  </>
                )}

                {subDetail.status === "PAUSED" && (
                  <>
                    <button
                      disabled={actionLoading}
                      onClick={handleResume}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Play className="h-3.5 w-3.5" /> Resume Subscription
                    </button>
                    <button
                      onClick={() => setIsCloseOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium"
                    >
                      Close / Terminate
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {isPauseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Pause Subscription</h3>
            <p className="text-xs text-slate-500">
              Pausing excludes the subscription from billing and extends its next billing date and period end upon resumption.
            </p>
            <form onSubmit={handlePause} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason (optional)</label>
                <textarea
                  rows={2}
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g. Seasonal customer shutdown..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPauseOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Confirm Pause
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {isCloseOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Close / Cancel Subscription</h3>
            <p className="text-xs text-slate-500">
              Closing is permanent. Closed subscriptions cannot be billed in future cycles.
            </p>
            <form onSubmit={handleClose} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Termination Reason</label>
                <textarea
                  rows={2}
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="e.g. Client requested non-renewal..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCloseOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Confirm Termination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
