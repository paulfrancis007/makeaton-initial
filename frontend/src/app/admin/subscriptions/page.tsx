"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  X,
  Eye,
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
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-green text-nb-dark border border-nb-dark shadow-nb-sm">ACTIVE</span>;
      case "PAUSED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-yellow text-nb-dark border border-nb-dark shadow-nb-sm">PAUSED</span>;
      case "CONFIRMED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-blue text-white border border-nb-dark shadow-nb-sm">CONFIRMED</span>;
      case "CLOSED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-zinc-200 text-zinc-700 border border-nb-dark shadow-nb-sm">CLOSED</span>;
      case "EXPIRED":
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-coral text-white border border-nb-dark shadow-nb-sm">EXPIRED</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white text-nb-dark border border-nb-dark shadow-nb-sm">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-coral text-white border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Contract Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <RefreshCw className="h-7 w-7 stroke-[2.5]" />
            Subscription Lifecycle
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Manage active customer contracts, billing cycles, pause/resume durations, renewal boundaries, and plan snapshots.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
          <input
            type="text"
            placeholder="Search by subscription number or plan..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="nb-input w-full pl-9 pr-4 py-2 text-xs bg-white font-bold"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="nb-input px-3 py-2 text-xs bg-white font-bold"
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
        <div className="p-3.5 bg-nb-coral text-white border-2 border-nb-dark shadow-nb flex items-center gap-2.5 text-xs font-bold">
          <AlertCircle className="h-5 w-5 stroke-[2.5] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading subscriptions...
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <RefreshCw className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <h3 className="font-black uppercase tracking-wide text-base">No subscriptions found</h3>
            <p className="text-xs font-bold text-zinc-500 mt-1">Convert approved customer quotations to activate contracts.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs font-bold">
            <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
              <tr>
                <th className="px-5 py-3 text-left">Subscription #</th>
                <th className="px-5 py-3 text-left">Plan Snapshot</th>
                <th className="px-5 py-3 text-left">Current Period</th>
                <th className="px-5 py-3 text-left">Next Billing</th>
                <th className="px-5 py-3 text-right">Recurring Total</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
              {subscriptions.map((s) => (
                <tr key={s.id} className="hover:bg-cream transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-mono font-black text-sm text-nb-dark">{s.subscription_number}</div>
                    <div className="text-[10px] text-zinc-500 font-mono font-bold mt-0.5">Anchor: Day {s.billing_anchor_day}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-black text-sm text-nb-dark">{s.plan_name_snapshot}</div>
                    <div className="text-[10px] text-zinc-600 font-mono font-bold">
                      {s.interval_count_snapshot > 1 ? `${s.interval_count_snapshot} ` : ""}
                      {s.billing_interval_snapshot}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-zinc-600">
                    <div>{s.current_period_start} → {s.current_period_end}</div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono font-black text-nb-dark">
                    {s.next_billing_date}
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-black text-nb-dark">
                    ₹{Number(s.recurring_total_amount).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {getStatusBadge(s.status)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => loadSubDetail(s.id)}
                      className="nb-btn nb-btn-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider"
                    >
                      <Eye className="h-3.5 w-3.5 stroke-[2.5]" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t-2 border-nb-dark bg-cream flex items-center justify-between text-xs font-black uppercase tracking-wider">
            <div>Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="nb-btn nb-btn-white px-3 py-1 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="nb-btn nb-btn-white px-3 py-1 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Detail Modal */}
      {selectedSubId && subDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-3xl w-full p-6 shadow-nb-xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Top Bar */}
            <div className="flex items-start justify-between border-b-2 border-nb-dark pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black font-mono text-nb-dark uppercase">
                    {subDetail.subscription_number}
                  </h2>
                  {getStatusBadge(subDetail.status)}
                </div>
                <div className="text-xs text-zinc-600 font-bold mt-1.5 flex flex-wrap gap-4">
                  <span>Customer: <strong className="text-nb-dark">{subDetail.customer_company_name || subDetail.customer_id}</strong></span>
                  <span>Plan: <strong className="text-nb-dark">{subDetail.plan_name_snapshot}</strong></span>
                  <span>Billing Anchor: <strong className="text-nb-dark">Day {subDetail.billing_anchor_day}</strong></span>
                </div>
              </div>
              <button onClick={() => setSelectedSubId(null)} className="nb-btn nb-btn-white p-1 text-nb-dark">
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Terms & Period Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-cream p-4 border-2 border-nb-dark shadow-nb-sm text-xs font-mono font-bold">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-black">Period Start</span>
                <span className="font-black text-nb-dark">{subDetail.current_period_start}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-black">Period End</span>
                <span className="font-black text-nb-dark">{subDetail.current_period_end}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-black">Next Invoice Date</span>
                <span className="font-black text-nb-blue">{subDetail.next_billing_date}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block font-black">Payment Terms</span>
                <span className="font-black text-nb-dark">{subDetail.payment_terms_days} Days</span>
              </div>
            </div>

            {/* Agreed Subscription Lines */}
            <div>
              <h3 className="text-xs font-black text-nb-dark uppercase tracking-wider mb-2">
                Agreed Contract Lines & Pricing Snapshots
              </h3>
              <div className="border-2 border-nb-dark overflow-hidden shadow-nb-sm">
                <table className="w-full text-left text-xs font-bold">
                  <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-right">Agreed Unit Price</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Tax Rate</th>
                      <th className="px-3 py-2 text-right">Recurring Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
                    {subDetail.lines.map((l) => (
                      <tr key={l.id} className="hover:bg-cream">
                        <td className="px-3 py-2 font-black text-nb-dark">{l.description_snapshot}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-1.5 py-0.5 text-[10px] font-black uppercase bg-cream border border-nb-dark">
                            {l.line_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">₹{Number(l.unit_price_snapshot).toFixed(2)}</td>
                        <td className="px-3 py-2 text-center font-mono font-black">{l.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-600">{Number(l.tax_rate_snapshot).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right font-mono font-black text-nb-dark">₹{Number(l.line_total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pause History Table */}
            {subDetail.pause_history && subDetail.pause_history.length > 0 && (
              <div>
                <h3 className="text-xs font-black text-nb-dark uppercase tracking-wider mb-2">
                  Pause & Suspension History
                </h3>
                <div className="border-2 border-nb-dark overflow-hidden shadow-nb-sm">
                  <table className="w-full text-left text-xs font-bold">
                    <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                      <tr>
                        <th className="px-3 py-1.5 text-left">Paused At</th>
                        <th className="px-3 py-1.5 text-left">Resumed At</th>
                        <th className="px-3 py-1.5 text-left">Reason</th>
                        <th className="px-3 py-1.5 text-right">Days Extended</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
                      {subDetail.pause_history.map((p) => (
                        <tr key={p.id} className="hover:bg-cream">
                          <td className="px-3 py-1.5 font-mono text-zinc-600">{new Date(p.paused_at).toLocaleString()}</td>
                          <td className="px-3 py-1.5 font-mono">
                            {p.resumed_at ? new Date(p.resumed_at).toLocaleString() : <span className="bg-nb-yellow border border-nb-dark px-1.5 py-0.5 text-[10px] font-black uppercase">Currently Paused</span>}
                          </td>
                          <td className="px-3 py-1.5 text-nb-dark">{p.pause_reason || "—"}</td>
                          <td className="px-3 py-1.5 text-right font-mono font-black">{p.days_extended} d</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="bg-cream p-4 border-2 border-nb-dark shadow-nb-sm flex flex-col items-end text-xs space-y-1 font-mono font-bold">
              <div className="flex justify-between w-64 text-zinc-700">
                <span>Recurring Subtotal:</span>
                <span className="font-black text-nb-dark">₹{Number(subDetail.recurring_subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-zinc-700">
                <span>Recurring Discount:</span>
                <span className="text-nb-green font-black">- ₹{Number(subDetail.recurring_discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-zinc-700">
                <span>Recurring Tax:</span>
                <span className="text-nb-dark font-black">+ ₹{Number(subDetail.recurring_tax).toFixed(2)}</span>
              </div>
              <div className="border-t-2 border-nb-dark pt-2 flex justify-between w-64 text-sm font-black text-nb-dark">
                <span>Recurring Cycle Total:</span>
                <span>₹{Number(subDetail.recurring_total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Lifecycle Transitions Bar */}
            <div className="flex items-center justify-between pt-3 border-t-2 border-nb-dark">
              <div className="text-xs font-mono font-bold text-zinc-600">
                Status: {subDetail.status}
              </div>
              <div className="flex items-center gap-2.5">
                {subDetail.status === "CONFIRMED" && (
                  <button
                    disabled={actionLoading}
                    onClick={handleActivate}
                    className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase"
                  >
                    <Play className="h-3.5 w-3.5 stroke-[2.5]" /> Activate Contract
                  </button>
                )}

                {subDetail.status === "ACTIVE" && (
                  <>
                    {subDetail.allow_pause_snapshot && (
                      <button
                        onClick={() => setIsPauseOpen(true)}
                        className="nb-btn nb-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase"
                      >
                        <Pause className="h-3.5 w-3.5 stroke-[2.5]" /> Pause
                      </button>
                    )}
                    <button
                      onClick={() => setIsCloseOpen(true)}
                      className="nb-btn p-2 bg-nb-coral text-white text-xs font-black uppercase"
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
                      className="nb-btn nb-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase"
                    >
                      <Play className="h-3.5 w-3.5 stroke-[2.5]" /> Resume Subscription
                    </button>
                    <button
                      onClick={() => setIsCloseOpen(true)}
                      className="nb-btn p-2 bg-nb-coral text-white text-xs font-black uppercase"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-sm w-full p-6 shadow-nb-xl space-y-4">
            <h3 className="font-black text-nb-dark text-base uppercase tracking-tight">Pause Subscription</h3>
            <p className="text-xs font-bold text-zinc-600 leading-relaxed">
              Pausing excludes the subscription from billing and extends its next billing date and period end upon resumption.
            </p>
            <form onSubmit={handlePause} className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">Reason (optional)</label>
                <textarea
                  rows={2}
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="e.g. Seasonal customer shutdown..."
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsPauseOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-1.5 text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="nb-btn nb-btn-primary px-4 py-1.5 text-xs font-black uppercase disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-sm w-full p-6 shadow-nb-xl space-y-4">
            <h3 className="font-black text-nb-dark text-base uppercase tracking-tight">Close / Cancel Subscription</h3>
            <p className="text-xs font-bold text-zinc-600 leading-relaxed">
              Closing is permanent. Closed subscriptions cannot be billed in future cycles.
            </p>
            <form onSubmit={handleClose} className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">Termination Reason</label>
                <textarea
                  rows={2}
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="e.g. Client requested non-renewal..."
                  className="nb-input w-full p-2.5 text-xs bg-white font-bold"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsCloseOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-1.5 text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="nb-btn p-2 px-4 bg-nb-coral text-white text-xs font-black uppercase disabled:opacity-50"
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
