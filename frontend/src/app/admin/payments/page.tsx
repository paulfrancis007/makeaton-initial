"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Ban,
  X,
  FileText,
  DollarSign,
} from "lucide-react";
import { paymentApi, Payment } from "@/lib/api";

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
      setError(err instanceof Error ? err.message : "Failed to load payments");
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
      setVoidError(err instanceof Error ? err.message : "Failed to void payment");
    } finally {
      setVoidLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="h-3 w-3" /> Settled
          </span>
        );
      case "VOIDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <Ban className="h-3 w-3" /> Voided
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-600" />
            Payments & Collections
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track incoming customer settlements, inspect transaction metadata, and authorize payment voids.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search payment # or reference..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-full focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:ring-2 focus:ring-indigo-500"
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
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Methods</option>
            <option value="CREDIT_CARD">Credit Card</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
        <button
          onClick={() => loadPayments()}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          title="Refresh table"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
            Loading payments...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 text-sm">{error}</div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center">
            <CreditCard className="h-10 w-10 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-base">No payments found</p>
            <p className="text-xs text-slate-400 mt-1">
              Payments recorded against invoices will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {p.payment_number}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.payment_date}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {p.payment_method}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {p.reference_number || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${parseFloat(p.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {statusBadge(p.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status === "SUCCESS" && (
                        <button
                          onClick={() => openVoidModal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition"
                          title="Authorize Void"
                        >
                          <Ban className="h-3.5 w-3.5" />
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
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Void Payment Modal */}
      {isVoidModalOpen && targetPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Ban className="h-5 w-5 text-rose-600" />
                Authorize Payment Void
              </h3>
              <button
                onClick={() => setIsVoidModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <p className="font-bold">Important Financial Reversal Invariant:</p>
              <p>
                Voiding payment <strong>{targetPayment.payment_number}</strong> of{" "}
                <strong>${parseFloat(targetPayment.amount).toFixed(2)}</strong> will restore the original balance on the associated invoice. This action is immutable and logged in the audit trail.
              </p>
            </div>

            {voidError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Void *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Chargeback, customer dispute, duplicate charge entry..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs shadow-sm hover:bg-rose-700 disabled:opacity-50"
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
