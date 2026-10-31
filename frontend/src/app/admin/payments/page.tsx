"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Search,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Ban,
  X,
} from "lucide-react";
import { paymentApi, Payment, formatApiError } from "@/lib/api";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Void Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [targetPayment, setTargetPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentApi.listPayments({
        status: statusFilter || undefined,
        method: methodFilter || undefined,
        page,
        page_size: 10,
      });
      // Client-side search filtering if query provided
      let items = res.items;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        items = items.filter(
          (p) =>
            p.payment_number.toLowerCase().includes(q) ||
            (p.reference_number && p.reference_number.toLowerCase().includes(q))
        );
      }
      setPayments(items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(formatApiError(err) || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, page, searchTerm]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openVoidModal = (payment: Payment) => {
    setTargetPayment(payment);
    setVoidReason("");
    setVoidError(null);
    setIsVoidModalOpen(true);
  };

  const handleVoidPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPayment) return;
    setVoidLoading(true);
    setVoidError(null);
    try {
      await paymentApi.voidPayment(targetPayment.id, voidReason);
      setIsVoidModalOpen(false);
      loadPayments();
    } catch (err: unknown) {
      setVoidError(formatApiError(err) || "Failed to void payment");
    } finally {
      setVoidLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-green text-nb-dark border border-nb-dark shadow-nb-sm">
            <CheckCircle className="h-3 w-3 stroke-[2.5]" /> Settled
          </span>
        );
      case "VOIDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-nb-coral text-white border border-nb-dark shadow-nb-sm">
            <Ban className="h-3 w-3 stroke-[2.5]" /> Voided
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-white text-nb-dark border border-nb-dark shadow-nb-sm">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark p-6 shadow-nb flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-nb-green border-2 border-nb-dark text-[10px] font-black uppercase tracking-wider shadow-nb-sm mb-2">
            Ledger & Settlements
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-2.5 text-nb-dark">
            <CreditCard className="h-7 w-7 stroke-[2.5]" />
            Payments & Collections
          </h1>
          <p className="text-xs font-bold text-zinc-600 mt-1">
            Track incoming customer settlements, inspect transaction metadata, and authorize payment voids.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 border-2 sm:border-3 border-nb-dark shadow-nb flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-nb-dark stroke-[2.5]" />
            <input
              type="text"
              placeholder="Search payment # or reference..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="nb-input pl-9 pr-3 py-2 text-xs w-full bg-white font-bold"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="nb-input text-xs py-2 px-3 bg-white font-bold"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">Settled</option>
            <option value="VOIDED">Voided</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="nb-input text-xs py-2 px-3 bg-white font-bold"
          >
            <option value="">All Methods</option>
            <option value="CARD">Credit Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <button
          onClick={() => loadPayments()}
          className="nb-btn nb-btn-white p-2 text-nb-dark"
          title="Refresh table"
        >
          <RefreshCw className={`h-4 w-4 stroke-[2.5] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white border-2 sm:border-3 border-nb-dark shadow-nb overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs font-black uppercase tracking-wider text-nb-dark flex flex-col items-center gap-3">
            <RefreshCw className="h-7 w-7 animate-spin stroke-[2.5] text-nb-dark" />
            Loading payments...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-white bg-nb-coral text-xs font-bold">{error}</div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center text-nb-dark flex flex-col items-center">
            <CreditCard className="h-12 w-12 stroke-[2] mb-3 text-zinc-400" />
            <p className="font-black uppercase tracking-wide text-base">No payments found</p>
            <p className="text-xs font-bold text-zinc-500 mt-1">
              Payments recorded against invoices will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold">
              <thead className="bg-nb-dark text-white font-black uppercase tracking-wider border-b-2 border-nb-dark text-[11px]">
                <tr>
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-nb-dark text-nb-dark">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-cream transition-colors">
                    <td className="py-3 px-4 font-mono font-black">
                      {p.payment_number}
                    </td>
                    <td className="py-3 px-4 text-zinc-600 font-mono">
                      {p.payment_date}
                    </td>
                    <td className="py-3 px-4 font-black">
                      {p.payment_method}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-600">
                      {p.reference_number || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-nb-dark">
                      ${parseFloat(p.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {statusBadge(p.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status === "SUCCESS" && (
                        <button
                          onClick={() => openVoidModal(p)}
                          className="nb-btn p-1.5 bg-nb-coral text-white inline-flex items-center gap-1 text-[11px] font-black uppercase"
                          title="Authorize Void"
                        >
                          <Ban className="h-3.5 w-3.5 stroke-[2.5]" />
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t-2 border-nb-dark bg-cream flex items-center justify-between text-xs font-black uppercase tracking-wider">
            <span>
              Page {page} of {totalPages}
            </span>
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

      {/* Void Payment Modal */}
      {isVoidModalOpen && targetPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 sm:border-3 border-nb-dark max-w-md w-full p-6 shadow-nb-xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-nb-dark pb-3">
              <h3 className="text-base font-black uppercase tracking-tight text-nb-dark flex items-center gap-2">
                <Ban className="h-5 w-5 stroke-[2.5]" />
                Authorize Payment Void
              </h3>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="nb-btn nb-btn-white p-1 text-nb-dark"
              >
                <X className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-3.5 bg-nb-yellow border-2 border-nb-dark shadow-nb-sm text-xs font-bold text-nb-dark space-y-1">
              <p className="font-black uppercase">Important Financial Reversal Invariant:</p>
              <p className="leading-relaxed">
                Voiding payment <strong>{targetPayment.payment_number}</strong> of{" "}
                <strong>${parseFloat(targetPayment.amount).toFixed(2)}</strong> will restore the original balance on the associated invoice. This action is immutable and logged in the audit trail.
              </p>
            </div>

            {voidError && (
              <div className="p-3 bg-nb-coral border-2 border-nb-dark text-white text-xs font-bold shadow-nb-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 stroke-[2.5] shrink-0" />
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                  Reason for Void *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Chargeback, customer dispute, duplicate charge entry..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="nb-input w-full text-xs p-2.5 font-bold bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-nb-dark">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="nb-btn nb-btn-white px-3.5 py-2 text-xs font-black uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidLoading}
                  className="nb-btn p-2 px-4 bg-nb-coral text-white text-xs font-black uppercase disabled:opacity-50"
                >
                  {voidLoading ? "Voiding..." : "Confirm Void"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
