"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  Mail,
  CreditCard,
  Ban,
  Eye,
  X,
  Play,
  Calendar,
  Building,
  RefreshCw,
} from "lucide-react";
import {
  invoiceApi,
  paymentApi,
  Invoice,
  InvoiceDetail,
} from "@/lib/api";

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Run Billing Modal
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split("T")[0]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingResult, setBillingResult] = useState<any | null>(null);

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [targetInvoice, setTargetInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CREDIT_CARD");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Email Notification Modal / Action
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoiceApi.listInvoices({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        is_overdue: isOverdueOnly ? true : undefined,
        page,
        page_size: 10,
      });
      setInvoices(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, isOverdueOnly, page]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const openInvoiceDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await invoiceApi.getInvoice(id);
      setSelectedInvoice(detail);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load invoice details");
    } finally {
      setDetailLoading(false);
    }
  };

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
      alert(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  const handleSendEmail = async (id: string) => {
    if (!confirm("Send invoice PDF to customer email?")) return;
    try {
      const res = await invoiceApi.sendEmail(id);
      alert(`Email dispatch processed: ${res.recipient} (${res.status})`);
      if (selectedInvoice && selectedInvoice.id === id) {
        openInvoiceDetail(id);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send email");
    }
  };

  const handleCancelInvoice = async (id: string) => {
    const reason = prompt("Enter cancellation reason:");
    if (!reason) return;
    try {
      await invoiceApi.cancelInvoice(id, reason);
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === id) {
        openInvoiceDetail(id);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel invoice");
    }
  };

  const handleRunBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingLoading(true);
    setBillingResult(null);
    try {
      const res = await invoiceApi.runBilling({ run_date: billingDate });
      setBillingResult(res);
      loadInvoices();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Batch billing run failed");
    } finally {
      setBillingLoading(false);
    }
  };

  const openRecordPayment = (inv: Invoice) => {
    setTargetInvoice(inv);
    setPaymentAmount(inv.balance_due);
    setPaymentMethod("CREDIT_CARD");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoice) return;
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      await paymentApi.createPayment({
        invoice_id: targetInvoice.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        reference_number: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      setIsPaymentModalOpen(false);
      loadInvoices();
      if (selectedInvoice && selectedInvoice.id === targetInvoice.id) {
        openInvoiceDetail(targetInvoice.id);
      }
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Payment recording failed");
    } finally {
      setPaymentLoading(false);
    }
  };

  const statusBadge = (status: string, isOverdue: boolean) => {
    if (isOverdue && status !== "PAID" && status !== "CANCELLED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle className="h-3 w-3" /> Overdue
        </span>
      );
    }
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="h-3 w-3" /> Paid
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="h-3 w-3" /> Partially Paid
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle className="h-3 w-3" /> Confirmed
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
            <Ban className="h-3 w-3" /> Cancelled
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
            <Receipt className="h-6 w-6 text-indigo-600" />
            Invoices & Billing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage recurring invoices, issue payments, generate PDF receipts and execute automated billing runs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setBillingResult(null);
              setIsBillingModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-700 transition"
          >
            <Play className="h-4 w-4" />
            Run Billing Engine
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice # or customer..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={isOverdueOnly}
              onChange={(e) => {
                setIsOverdueOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            Overdue Only
          </label>
        </div>
        <button
          onClick={() => loadInvoices()}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          title="Refresh table"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
            Loading invoices...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 text-sm">{error}</div>
        ) : invoices.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center">
            <Receipt className="h-10 w-10 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-base">No invoices found</p>
            <p className="text-xs text-slate-400 mt-1">
              Create an invoice or trigger the billing engine to generate invoices from active subscriptions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {inv.invoice_number}
                      <span className="block text-[10px] text-slate-400 font-sans">
                        Issued: {inv.issue_date}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {inv.customer_name || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {inv.billing_period_start || inv.period_start} → {inv.billing_period_end || inv.period_end}
                    </td>
                    <td className="py-3 px-4">
                      <span className={inv.is_overdue ? "text-rose-600 font-semibold" : ""}>
                        {inv.due_date}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      ${parseFloat(inv.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={
                          parseFloat(inv.balance_due) > 0
                            ? "font-bold text-amber-700"
                            : "text-emerald-700 font-medium"
                        }
                      >
                        ${parseFloat(inv.balance_due).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {statusBadge(inv.status, inv.is_overdue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openInvoiceDetail(inv.id)}
                          className="p-1.5 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                          className="p-1.5 rounded-md text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {parseFloat(inv.balance_due) > 0 && inv.status !== "CANCELLED" && (
                          <button
                            onClick={() => openRecordPayment(inv)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition"
                            title="Record Payment"
                          >
                            <CreditCard className="h-3 w-3" />
                            Pay
                          </button>
                        )}
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancelInvoice(inv.id)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Cancel Invoice"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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

      {/* Invoice Detail Drawer / Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-indigo-600" />
                  Invoice {selectedInvoice.invoice_number}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Issue Date: {selectedInvoice.issue_date} • Due Date: {selectedInvoice.due_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoice_number)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs shadow-2xs transition"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
                <button
                  onClick={() => handleSendEmail(selectedInvoice.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs shadow-2xs transition"
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Subtotal</span>
                  <span className="text-sm font-semibold text-slate-800">
                    ${parseFloat(selectedInvoice.subtotal_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Discount</span>
                  <span className="text-sm font-semibold text-slate-800">
                    -${parseFloat(selectedInvoice.discount_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Taxes</span>
                  <span className="text-sm font-semibold text-slate-800">
                    +${parseFloat(selectedInvoice.tax_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Balance Due</span>
                  <span className="text-sm font-bold text-amber-700">
                    ${parseFloat(selectedInvoice.balance_due).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Line Items
                </h4>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Discount</th>
                        <th className="py-2 px-3 text-right">Tax</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.lines.map((ln) => (
                        <tr key={ln.id}>
                          <td className="py-2 px-3">
                            <span className="font-medium text-slate-900 block">{ln.description}</span>
                            {ln.product_name && (
                              <span className="text-[10px] text-slate-500">
                                {ln.product_name} {ln.plan_name ? `• ${ln.plan_name}` : ""}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">{ln.quantity}</td>
                          <td className="py-2 px-3 text-right">${parseFloat(ln.unit_price).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">-${parseFloat(ln.discount_amount).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right">+${parseFloat(ln.tax_amount).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">
                            ${parseFloat(ln.line_total || ln.total_amount || "0").toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Payment History ({selectedInvoice.payments.length})
                </h4>
                {selectedInvoice.payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No payments recorded for this invoice yet.</p>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Payment #</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 font-mono font-medium">{p.payment_number}</td>
                            <td className="py-2 px-3 text-slate-500">{p.payment_date}</td>
                            <td className="py-2 px-3">{p.payment_method}</td>
                            <td className="py-2 px-3 text-right font-semibold">
                              ${parseFloat(p.amount).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-center">
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

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
              <div className="text-xs text-slate-500">
                Rounding adjustment: ${parseFloat(selectedInvoice.rounding_adjustment).toFixed(2)}
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run Billing Modal */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Play className="h-5 w-5 text-indigo-600" />
                Run Recurring Billing Engine
              </h3>
              <button
                onClick={() => setIsBillingModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRunBilling} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Execution Date
                </label>
                <input
                  type="date"
                  required
                  value={billingDate}
                  onChange={(e) => setBillingDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Evaluates all active subscriptions whose next billing date is on or before this date. Idempotent: previously invoiced periods will be skipped.
                </p>
              </div>

              {billingResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    Billing Run Completed
                  </p>
                  <p>Subscriptions evaluated: {billingResult.subscriptions_evaluated}</p>
                  <p>Invoices created: {billingResult.invoices_created}</p>
                  <p>Invoices skipped (already billed): {billingResult.invoices_skipped}</p>
                  {billingResult.failed > 0 && (
                    <p className="text-rose-600 font-semibold">Failed: {billingResult.failed}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={billingLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {billingLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Running...
                    </>
                  ) : (
                    "Execute Billing"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPaymentModalOpen && targetInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Record Payment
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-800">
                Invoice {targetInvoice.invoice_number}
              </p>
              <div className="flex justify-between text-slate-600">
                <span>Invoice Total:</span>
                <span>${parseFloat(targetInvoice.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-800">
                <span>Current Balance Due:</span>
                <span>${parseFloat(targetInvoice.balance_due).toFixed(2)}</span>
              </div>
            </div>

            {paymentError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={targetInvoice.balance_due}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[11px] text-slate-400">
                  Cannot exceed current balance due (${parseFloat(targetInvoice.balance_due).toFixed(2)})
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer / ACH</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Transaction ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-94821 or Bank Ref"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional settlement notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {paymentLoading ? "Recording..." : "Confirm & Settle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
