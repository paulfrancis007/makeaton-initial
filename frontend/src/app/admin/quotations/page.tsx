"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Check,
  RefreshCw,
  X,
  Layers,
  Building,
  Calendar,
  Eye,
} from "lucide-react";
import {
  catalogApi,
  customerApi,
  quotationApi,
  subscriptionApi,
  Customer,
  Plan,
  Product,
  Quotation,
  QuotationDetail,
  QuotationTemplate,
} from "@/lib/api";

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Aux state for dropdowns
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<QuotationTemplate[]>([]);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<QuotationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form states
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPlanId, setFormPlanId] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formValidityDays, setFormValidityDays] = useState(30);
  const [formNotes, setFormNotes] = useState("");
  const [formDiscountCode, setFormDiscountCode] = useState("");
  const [formLines, setFormLines] = useState<
    { product_id: string; quantity: number; unit_price?: string }[]
  >([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Conversion prompt
  const [converting, setConverting] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  const loadQuotations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await quotationApi.listQuotations({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        page,
        page_size: 10,
      });
      setQuotations(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page]);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  // Load supporting entities for creation
  useEffect(() => {
    customerApi.listCustomers({ is_active: true, page_size: 100 }).then((r) => setCustomers(r.items)).catch(() => {});
    catalogApi.listPlans({ is_active: true, page_size: 100 }).then((r) => setPlans(r.items)).catch(() => {});
    catalogApi.listProducts({ is_active: true, page_size: 100 }).then((r) => setProducts(r.items)).catch(() => {});
    quotationApi.listTemplates({ is_active: true, page_size: 100 }).then((r) => setTemplates(r.items)).catch(() => {});
  }, []);

  const loadQuotationDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await quotationApi.getQuotation(id);
      setQuotationDetail(detail);
      setSelectedQuotationId(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to fetch quotation details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTemplateSelect = async (templateId: string) => {
    setFormTemplateId(templateId);
    if (!templateId) return;
    try {
      const tpl = await quotationApi.getTemplate(templateId);
      setFormPlanId(tpl.plan_id);
      setFormValidityDays(tpl.validity_duration_days);
      const lines = tpl.lines.map((l) => ({
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price: l.unit_price_override || undefined,
      }));
      setFormLines(lines);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const openCreateModal = () => {
    setFormCustomerId(customers[0]?.id || "");
    setFormPlanId(plans[0]?.id || "");
    setFormTemplateId("");
    setFormValidityDays(30);
    setFormNotes("");
    setFormDiscountCode("");
    setFormLines([]);
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleAddLine = () => {
    if (products.length === 0) return;
    setFormLines([...formLines, { product_id: products[0].id, quantity: 1 }]);
  };

  const handleRemoveLine = (index: number) => {
    setFormLines(formLines.filter((_, i) => i !== index));
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId || !formPlanId) {
      setFormError("Please select both a customer organization and a subscription plan.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const linesPayload = formLines.map((l) => ({
        line_type: "PRODUCT",
        product_id: l.product_id,
        quantity: Number(l.quantity),
        unit_price: l.unit_price ? l.unit_price : undefined,
      }));

      const quote = await quotationApi.createQuotation({
        customer_id: formCustomerId,
        plan_id: formPlanId,
        template_id: formTemplateId || undefined,
        validity_duration_days: Number(formValidityDays),
        notes: formNotes || undefined,
        discount_code: formDiscountCode.trim() || undefined,
        lines: linesPayload,
      });

      setIsCreateOpen(false);
      loadQuotations();
      loadQuotationDetail(quote.id);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create quotation");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusTransition = async (targetStatus: string, reason?: string) => {
    if (!quotationDetail) return;
    try {
      await quotationApi.updateStatus(quotationDetail.id, targetStatus, reason);
      loadQuotationDetail(quotationDetail.id);
      loadQuotations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to transition status");
    }
  };

  const handleConvertToSubscription = async () => {
    if (!quotationDetail) return;
    if (!confirm(`Convert Quotation ${quotationDetail.quotation_number} into an active subscription?`)) return;
    setConverting(true);
    try {
      const sub = await subscriptionApi.convertFromQuotation(quotationDetail.id, {
        start_date: new Date().toISOString().split("T")[0],
        payment_terms_days: 15,
      });
      setConversionSuccess(`Successfully generated Subscription: ${sub.subscription_number}`);
      setTimeout(() => setConversionSuccess(null), 5000);
      loadQuotationDetail(quotationDetail.id);
      loadQuotations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to convert quotation to subscription");
    } finally {
      setConverting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">DRAFT</span>;
      case "SENT":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">SENT</span>;
      case "CONFIRMED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">CONFIRMED</span>;
      case "REJECTED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">REJECTED</span>;
      case "EXPIRED":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">EXPIRED</span>;
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
            <FileText className="h-6 w-6" />
            <h1 className="text-2xl font-bold text-slate-900">Quotation Management</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create commercial proposals from templates, review tax and discount snapshots, manage approval lifecycles, and convert to subscriptions.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs transition"
        >
          <Plus className="h-4 w-4" />
          Prepare Quotation
        </button>
      </div>

      {conversionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{conversionSuccess}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by quotation number or notes..."
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
          <option value="DRAFT">DRAFT</option>
          <option value="SENT">SENT</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="REJECTED">REJECTED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No quotations found</h3>
            <p className="text-xs text-slate-500 mt-1">Prepare commercial proposals for customers above.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Quote #</th>
                <th className="px-6 py-3 text-left">Issue / Expiry</th>
                <th className="px-6 py-3 text-right">Subtotal</th>
                <th className="px-6 py-3 text-right">Tax</th>
                <th className="px-6 py-3 text-right">Total Payable</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/75 transition">
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-indigo-700">{q.quotation_number}</div>
                    {q.notes && <div className="text-xs text-slate-400 line-clamp-1">{q.notes}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-600">
                    <div>Issued: {q.issue_date}</div>
                    <div className="text-slate-400">Expires: {q.expiry_date}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-700">
                    ₹{Number(q.subtotal_amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-500">
                    ₹{Number(q.tax_amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                    ₹{Number(q.total_amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(q.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => loadQuotationDetail(q.id)}
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

      {/* Quotation Detail Modal */}
      {selectedQuotationId && quotationDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-mono text-indigo-900">
                    {quotationDetail.quotation_number}
                  </h2>
                  {getStatusBadge(quotationDetail.status)}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-4">
                  <span>Customer: <strong className="text-slate-800">{quotationDetail.customer_company_name || quotationDetail.customer_id}</strong></span>
                  <span>Plan: <strong className="text-slate-800">{quotationDetail.plan_name || "Plan Fee Included"}</strong></span>
                </div>
              </div>
              <button onClick={() => setSelectedQuotationId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Line Items Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Agreed Line Items & Snapshots
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-center">Type</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Tax Rate</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {quotationDetail.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          {l.description_snapshot}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border">
                            {l.line_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          ₹{Number(l.unit_price).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">{l.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-500">
                          {Number(l.tax_rate_snapshot).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          ₹{Number(l.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary Block with Explicit Rounding Adjustment */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col items-end text-xs space-y-1.5 font-mono">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{Number(quotationDetail.subtotal_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Discount:</span>
                <span className="text-emerald-700">- ₹{Number(quotationDetail.discount_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Statutory Tax:</span>
                <span className="text-slate-900">+ ₹{Number(quotationDetail.tax_amount).toFixed(2)}</span>
              </div>
              {Number(quotationDetail.rounding_adjustment) !== 0 && (
                <div className="flex justify-between w-64 text-slate-500 text-[11px]">
                  <span>Rounding Adjustment:</span>
                  <span>{Number(quotationDetail.rounding_adjustment) > 0 ? "+" : ""}₹{Number(quotationDetail.rounding_adjustment).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1.5 flex justify-between w-64 text-sm font-bold text-indigo-900">
                <span>Total Payable:</span>
                <span>₹{Number(quotationDetail.total_amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons based on lifecycle */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                Valid until {quotationDetail.expiry_date}
              </div>
              <div className="flex items-center gap-2">
                {quotationDetail.status === "DRAFT" && (
                  <>
                    <button
                      onClick={() => handleStatusTransition("SENT")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Send className="h-3.5 w-3.5" /> Dispatch to Customer
                    </button>
                    <button
                      onClick={() => handleStatusTransition("REJECTED")}
                      className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs"
                    >
                      Cancel Quote
                    </button>
                  </>
                )}

                {quotationDetail.status === "SENT" && (
                  <>
                    <button
                      onClick={() => handleStatusTransition("CONFIRMED")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                    >
                      <Check className="h-3.5 w-3.5" /> Confirm / Approve
                    </button>
                    <button
                      onClick={() => handleStatusTransition("REJECTED")}
                      className="px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs"
                    >
                      Reject
                    </button>
                  </>
                )}

                {quotationDetail.status === "CONFIRMED" && (
                  <button
                    disabled={converting}
                    onClick={handleConvertToSubscription}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {converting ? "Converting..." : "Convert to Subscription"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prepare Quotation Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Prepare Commercial Quotation
              </h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveQuotation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Organization *
                </label>
                <select
                  required
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select customer organization...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name} ({c.contact_email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subscription Plan *
                  </label>
                  <select
                    required
                    value={formPlanId}
                    onChange={(e) => setFormPlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select plan...</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (₹{Number(p.base_price).toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quotation Template (optional)
                  </label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">No template (custom lines)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Lines Section */}
              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 uppercase">
                    Additional Product Lines
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    + Add Product Line
                  </button>
                </div>

                {formLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded">
                    <select
                      value={line.product_id}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].product_id = e.target.value;
                        setFormLines(updated);
                      }}
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (₹{Number(p.base_sales_price).toFixed(2)})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].quantity = Number(e.target.value);
                        setFormLines(updated);
                      }}
                      className="w-16 px-2 py-1 text-xs border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-red-500 hover:text-red-700 text-xs px-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Promotional Discount Code (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SUMMER20"
                    value={formDiscountCode}
                    onChange={(e) => setFormDiscountCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Validity Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formValidityDays}
                    onChange={(e) => setFormValidityDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes & Special Commercial Terms
                </label>
                <textarea
                  rows={2}
                  placeholder="Terms agreed with customer..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50"
                >
                  {formSubmitting ? "Generating Quote..." : "Generate Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
