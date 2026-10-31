"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Layers,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Receipt,
  Edit2,
  Trash2,
  X,
  Calendar,
} from "lucide-react";
import {
  catalogApi,
  Plan,
  TaxRule,
} from "@/lib/api";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [intervalFilter, setIntervalFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [selectedPlanForTaxes, setSelectedPlanForTaxes] = useState<Plan | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formInterval, setFormInterval] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [formIntervalCount, setFormIntervalCount] = useState(1);
  const [formBasePrice, setFormBasePrice] = useState("0.0000");
  const [formMinQty, setFormMinQty] = useState(1);
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formAutoRenew, setFormAutoRenew] = useState(true);
  const [formAutoClose, setFormAutoClose] = useState(false);
  const [formAllowPause, setFormAllowPause] = useState(true);
  const [formAllowEarlyClose, setFormAllowEarlyClose] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Taxes state
  const [allTaxRules, setAllTaxRules] = useState<TaxRule[]>([]);
  const [assignedTaxIds, setAssignedTaxIds] = useState<string[]>([]);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [taxesSaving, setTaxesSaving] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listPlans({
        search: searchTerm || undefined,
        billing_interval: intervalFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setPlans(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, intervalFilter, statusFilter, page]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const loadTaxesForPlan = useCallback(async (planId: string) => {
    setTaxesLoading(true);
    try {
      const [taxRulesRes, assignedTaxes] = await Promise.all([
        catalogApi.listTaxRules({ is_active: true, page_size: 100 }),
        catalogApi.getPlanTaxes(planId),
      ]);
      setAllTaxRules(taxRulesRes.items);
      setAssignedTaxIds(assignedTaxes.map((t) => t.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load taxes");
    } finally {
      setTaxesLoading(false);
    }
  }, []);

  const openCreateModal = () => {
    setFormName("");
    setFormDesc("");
    setFormInterval("MONTHLY");
    setFormIntervalCount(1);
    setFormBasePrice("0.0000");
    setFormMinQty(1);
    setFormStartDate("");
    setFormEndDate("");
    setFormAutoRenew(true);
    setFormAutoClose(false);
    setFormAllowPause(true);
    setFormAllowEarlyClose(true);
    setFormError(null);
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Plan) => {
    setFormName(p.name);
    setFormDesc(p.description || "");
    setFormInterval(p.billing_interval);
    setFormIntervalCount(p.interval_count);
    setFormBasePrice(p.base_price);
    setFormMinQty(p.minimum_quantity);
    setFormStartDate(p.availability_start_date || "");
    setFormEndDate(p.availability_end_date || "");
    setFormAutoRenew(p.auto_renew);
    setFormAutoClose(p.auto_close_on_expiry);
    setFormAllowPause(p.allow_pause);
    setFormAllowEarlyClose(p.allow_early_closure);
    setFormError(null);
    setEditingPlan(p);
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formAutoRenew && formAutoClose) {
      setFormError("Auto-Renew and Auto-Close on Expiry cannot both be enabled simultaneously.");
      return;
    }
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        name: formName,
        description: formDesc || null,
        billing_interval: formInterval,
        interval_count: Number(formIntervalCount),
        base_price: formBasePrice,
        minimum_quantity: Number(formMinQty),
        availability_start_date: formStartDate || null,
        availability_end_date: formEndDate || null,
        auto_renew: formAutoRenew,
        auto_close_on_expiry: formAutoClose,
        allow_pause: formAllowPause,
        allow_early_closure: formAllowEarlyClose,
      };

      if (editingPlan) {
        await catalogApi.updatePlan(editingPlan.id, payload);
      } else {
        await catalogApi.createPlan(payload);
      }
      setIsModalOpen(false);
      loadPlans();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivatePlan = async (p: Plan) => {
    if (!confirm(`Are you sure you want to deactivate plan "${p.name}"?`)) return;
    try {
      await catalogApi.deactivatePlan(p.id);
      loadPlans();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleSaveTaxes = async () => {
    if (!selectedPlanForTaxes) return;
    setTaxesSaving(true);
    try {
      await catalogApi.setPlanTaxes(selectedPlanForTaxes.id, assignedTaxIds);
      setSelectedPlanForTaxes(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save taxes");
    } finally {
      setTaxesSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <Layers className="h-6 w-6" />
            <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure recurring billing plans, intervals, renewal rules, pause limits, and tax mappings.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          New Plan
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by plan name or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={intervalFilter}
          onChange={(e) => {
            setIntervalFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Intervals</option>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
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

      {/* Plans Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading subscription plans...</div>
        ) : plans.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No plans found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or create a new plan.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Plan Name</th>
                <th className="px-6 py-3 text-left">Interval</th>
                <th className="px-6 py-3 text-right">Base Price</th>
                <th className="px-6 py-3 text-center">Renewal Policy</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/75 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-slate-500 line-clamp-1">{p.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {p.interval_count > 1 ? `${p.interval_count} ` : ""}
                    {p.billing_interval}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                    ₹{Number(p.base_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {p.auto_renew ? (
                      <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        Auto-Renew
                      </span>
                    ) : p.auto_close_on_expiry ? (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Auto-Close
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Manual</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {p.is_active ? (
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
                      onClick={() => {
                        setSelectedPlanForTaxes(p);
                        loadTaxesForPlan(p.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                      title="Assign Tax Rules"
                    >
                      <Receipt className="h-3.5 w-3.5 text-emerald-600" /> Taxes
                    </button>
                    <button
                      onClick={() => openEditModal(p)}
                      className="text-slate-400 hover:text-slate-700 p-1 transition"
                      title="Edit Plan"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {p.is_active && (
                      <button
                        onClick={() => handleDeactivatePlan(p)}
                        className="text-red-400 hover:text-red-600 p-1 transition"
                        title="Deactivate Plan"
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

      {/* Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingPlan ? "Edit Plan" : "Create Subscription Plan"}
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

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Enterprise Monthly"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing Interval *
                  </label>
                  <select
                    value={formInterval}
                    onChange={(e) => setFormInterval(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="DAILY">DAILY</option>
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Interval Count *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formIntervalCount}
                    onChange={(e) => setFormIntervalCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Recurring Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={formBasePrice}
                    onChange={(e) => setFormBasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formMinQty}
                    onChange={(e) => setFormMinQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Renewal Invariant Policy */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Renewal Constraints (Mutually Exclusive)
                </span>
                <div className="flex items-center gap-6 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoRenew}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setFormAutoRenew(val);
                        if (val) setFormAutoClose(false);
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-800">Auto-Renew</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoClose}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setFormAutoClose(val);
                        if (val) setFormAutoRenew(false);
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-slate-800">Auto-Close on Expiry</span>
                  </label>
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
                  {formSubmitting ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Assignment Modal */}
      {selectedPlanForTaxes && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Assign Plan Taxes
                </h2>
                <p className="text-xs text-slate-500">
                  Plan: {selectedPlanForTaxes.name}
                </p>
              </div>
              <button onClick={() => setSelectedPlanForTaxes(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {taxesLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading taxes...</div>
            ) : allTaxRules.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No active tax rules configured. Create tax rules in the Tax Rules menu first.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {allTaxRules.map((tr) => {
                  const isChecked = assignedTaxIds.includes(tr.id);
                  return (
                    <label
                      key={tr.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-50 text-xs cursor-pointer border border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedTaxIds([...assignedTaxIds, tr.id]);
                            } else {
                              setAssignedTaxIds(assignedTaxIds.filter((id) => id !== tr.id));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-medium text-slate-800">{tr.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-indigo-600 font-semibold">
                          {Number(tr.rate).toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-slate-400 block uppercase">
                          {tr.tax_scope}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPlanForTaxes(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={taxesSaving}
                onClick={handleSaveTaxes}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {taxesSaving ? "Saving..." : "Save Taxes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
