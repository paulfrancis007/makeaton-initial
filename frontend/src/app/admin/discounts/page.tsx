"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Percent,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Calculator,
  ArrowRight,
} from "lucide-react";
import {
  catalogApi,
  DiscountEvaluationResponse,
  DiscountRule,
  Product,
} from "@/lib/api";

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Form states
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [formValue, setFormValue] = useState("10.0000");
  const [formScope, setFormScope] = useState<"ORDER" | "PRODUCT_SELECTION">("ORDER");
  const [formFrequency, setFormFrequency] = useState<
    "FIRST_INVOICE_ONLY" | "RECURRING_ALL_CYCLES" | "FINITE_CYCLES"
  >("FIRST_INVOICE_ONLY");
  const [formMaxCycles, setFormMaxCycles] = useState<string>("");
  const [formMinPurchase, setFormMinPurchase] = useState("0.0000");
  const [formMinQty, setFormMinQty] = useState(1);
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formMaxUses, setFormMaxUses] = useState<string>("");
  const [formEligibleProductIds, setFormEligibleProductIds] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Discount Evaluator State
  const [evalCode, setEvalCode] = useState("");
  const [evalSubtotal, setEvalSubtotal] = useState("1000.0000");
  const [evalCycle, setEvalCycle] = useState(1);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<DiscountEvaluationResponse | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const loadDiscounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listDiscountRules({
        search: searchTerm || undefined,
        discount_type: typeFilter || undefined,
        scope: scopeFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setDiscounts(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load discount rules");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, typeFilter, scopeFilter, statusFilter, page]);

  useEffect(() => {
    loadDiscounts();
  }, [loadDiscounts]);

  // Load available products for selection scope
  useEffect(() => {
    catalogApi.listProducts({ is_active: true, page_size: 100 }).then((res) => {
      setAvailableProducts(res.items);
    }).catch(() => {});
  }, []);

  const openCreateModal = () => {
    setFormCode("");
    setFormName("");
    setFormType("PERCENTAGE");
    setFormValue("10.0000");
    setFormScope("ORDER");
    setFormFrequency("FIRST_INVOICE_ONLY");
    setFormMaxCycles("");
    setFormMinPurchase("0.0000");
    setFormMinQty(1);
    setFormValidFrom("");
    setFormValidUntil("");
    setFormMaxUses("");
    setFormEligibleProductIds([]);
    setFormError(null);
    setEditingDiscount(null);
    setIsModalOpen(true);
  };

  const openEditModal = (d: DiscountRule) => {
    setFormCode(d.code);
    setFormName(d.name);
    setFormType(d.discount_type);
    setFormValue(d.discount_value);
    setFormScope(d.scope);
    setFormFrequency(d.application_frequency);
    setFormMaxCycles(d.max_cycles ? String(d.max_cycles) : "");
    setFormMinPurchase(d.minimum_purchase_amount);
    setFormMinQty(d.minimum_quantity);
    setFormValidFrom(d.valid_from ? d.valid_from.substring(0, 16) : "");
    setFormValidUntil(d.valid_until ? d.valid_until.substring(0, 16) : "");
    setFormMaxUses(d.max_uses ? String(d.max_uses) : "");
    setFormEligibleProductIds(d.eligible_product_ids || []);
    setFormError(null);
    setEditingDiscount(d);
    setIsModalOpen(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<DiscountRule> = {
        code: formCode.trim().toUpperCase(),
        name: formName.trim(),
        discount_type: formType,
        discount_value: formValue,
        scope: formScope,
        application_frequency: formFrequency,
        max_cycles: formMaxCycles ? Number(formMaxCycles) : null,
        minimum_purchase_amount: formMinPurchase,
        minimum_quantity: Number(formMinQty),
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : null,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
        max_uses: formMaxUses ? Number(formMaxUses) : null,
        eligible_product_ids: formScope === "PRODUCT_SELECTION" ? formEligibleProductIds : [],
      };

      if (editingDiscount) {
        await catalogApi.updateDiscountRule(editingDiscount.id, payload);
      } else {
        await catalogApi.createDiscountRule(payload);
      }
      setIsModalOpen(false);
      loadDiscounts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save discount rule");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateDiscount = async (d: DiscountRule) => {
    if (!confirm(`Are you sure you want to deactivate discount rule "${d.code}"?`)) return;
    try {
      await catalogApi.deactivateDiscountRule(d.id);
      loadDiscounts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalCode.trim()) return;
    setEvaluating(true);
    setEvalError(null);
    setEvalResult(null);
    try {
      const res = await catalogApi.evaluateDiscount({
        code: evalCode.trim(),
        order_subtotal: evalSubtotal,
        cycle_number: Number(evalCycle),
      });
      setEvalResult(res);
    } catch (err: unknown) {
      setEvalError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <Percent className="h-6 w-6" />
            <h1 className="text-2xl font-bold text-slate-900">Discount Rules & Engine</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure promotional percentage and fixed discounts, scope boundaries, cycle frequencies, usage quotas, and test calculations.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          New Discount Rule
        </button>
      </div>

      {/* Interactive Discount Evaluator Widget */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-5 shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-5 w-5 text-indigo-400" />
          <h3 className="font-semibold text-sm">Interactive Discount Evaluator</h3>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
            Real-time Calculation Engine
          </span>
        </div>

        <form onSubmit={handleEvaluate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Discount Code</label>
            <input
              type="text"
              required
              placeholder="e.g. SUMMER20"
              value={evalCode}
              onChange={(e) => setEvalCode(e.target.value.toUpperCase())}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono uppercase focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Order Subtotal (₹)</label>
            <input
              type="number"
              step="0.0001"
              required
              value={evalSubtotal}
              onChange={(e) => setEvalSubtotal(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Billing Cycle #</label>
            <input
              type="number"
              min="1"
              required
              value={evalCycle}
              onChange={(e) => setEvalCycle(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs font-mono focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={evaluating}
              className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition shadow-xs disabled:opacity-50"
            >
              {evaluating ? "Evaluating..." : "Evaluate Code"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {/* Evaluation Output */}
        {evalResult && (
          <div
            className={`mt-4 p-3 rounded-lg border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              evalResult.is_eligible
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/40 border-red-500/40 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {evalResult.is_eligible ? (
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400 shrink-0" />
              )}
              <div>
                <span className="font-bold">
                  {evalResult.is_eligible ? "Eligible" : "Ineligible"}
                </span>
                {evalResult.rule_name && (
                  <span className="text-slate-300 ml-1.5">({evalResult.rule_name})</span>
                )}
                {evalResult.rejection_reason && (
                  <div className="text-[11px] text-red-300 mt-0.5">
                    Reason: {evalResult.rejection_reason}
                  </div>
                )}
              </div>
            </div>

            {evalResult.is_eligible && (
              <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-emerald-500/30 pt-2 sm:pt-0 sm:pl-4">
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase block">Discount</span>
                  <span className="font-mono text-sm font-bold text-white">
                    ₹{Number(evalResult.discount_amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase block">Net Subtotal</span>
                  <span className="font-mono text-sm font-bold text-white">
                    ₹{(Number(evalSubtotal) - Number(evalResult.discount_amount)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {evalError && (
          <div className="mt-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-200">
            {evalError}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by discount code or name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="PERCENTAGE">PERCENTAGE</option>
          <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Scopes</option>
          <option value="ORDER">ORDER</option>
          <option value="PRODUCT_SELECTION">PRODUCT_SELECTION</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Discount Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading discount rules...</div>
        ) : discounts.length === 0 ? (
          <div className="p-12 text-center">
            <Percent className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No discount rules found</h3>
            <p className="text-xs text-slate-500 mt-1">Create promotional coupons and volume discount rules above.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Code & Name</th>
                <th className="px-6 py-3 text-left">Type & Value</th>
                <th className="px-6 py-3 text-left">Scope & Frequency</th>
                <th className="px-6 py-3 text-center">Usage</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/75 transition">
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-indigo-700">{d.code}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{d.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 font-mono">
                      {d.discount_type === "PERCENTAGE"
                        ? `${Number(d.discount_value).toFixed(2)}%`
                        : `₹${Number(d.discount_value).toFixed(2)}`}
                    </div>
                    <div className="text-[11px] text-slate-400 uppercase">{d.discount_type}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 block w-fit mb-1">
                      {d.scope}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {d.application_frequency}
                      {d.max_cycles ? ` (${d.max_cycles} cycles)` : ""}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs">
                    {d.current_uses} / {d.max_uses !== null ? d.max_uses : "∞"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {d.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(d)}
                      className="text-slate-400 hover:text-slate-700 p-1 transition"
                      title="Edit Discount Rule"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {d.is_active && (
                      <button
                        onClick={() => handleDeactivateDiscount(d)}
                        className="text-red-400 hover:text-red-600 p-1 transition"
                        title="Deactivate Discount Rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

      {/* Discount Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingDiscount ? "Edit Discount Rule" : "Create Discount Rule"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveDiscount} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coupon / Rule Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingDiscount}
                    placeholder="e.g. FLASH50"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50% Flash Sale"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Type *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERCENTAGE">PERCENTAGE</option>
                    <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Value {formType === "PERCENTAGE" ? "(%)" : "(₹)"} *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max={formType === "PERCENTAGE" ? "100" : undefined}
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Scope *
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as "ORDER" | "PRODUCT_SELECTION")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ORDER">ORDER (All products)</option>
                    <option value="PRODUCT_SELECTION">PRODUCT_SELECTION (Specific items)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Application Frequency *
                  </label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="FIRST_INVOICE_ONLY">FIRST_INVOICE_ONLY</option>
                    <option value="RECURRING_ALL_CYCLES">RECURRING_ALL_CYCLES</option>
                    <option value="FINITE_CYCLES">FINITE_CYCLES</option>
                  </select>
                </div>
              </div>

              {formFrequency === "FINITE_CYCLES" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Cycles *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 3"
                    value={formMaxCycles}
                    onChange={(e) => setFormMaxCycles(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Product Selection picker */}
              {formScope === "PRODUCT_SELECTION" && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Eligible Products (select at least one)
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 rounded p-2 bg-white">
                    {availableProducts.map((p) => {
                      const isChecked = formEligibleProductIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormEligibleProductIds([...formEligibleProductIds, p.id]);
                              } else {
                                setFormEligibleProductIds(formEligibleProductIds.filter((id) => id !== p.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{p.name} ({p.product_type})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Purchase Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formMinPurchase}
                    onChange={(e) => setFormMinPurchase(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMinQty}
                    onChange={(e) => setFormMinQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid From (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid Until (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Global Uses (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : editingDiscount ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
