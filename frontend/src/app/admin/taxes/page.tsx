"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Globe,
} from "lucide-react";
import {
  catalogApi,
  TaxRule,
} from "@/lib/api";

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRule | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formRate, setFormRate] = useState("18.0000");
  const [formType, setFormType] = useState("PERCENTAGE");
  const [formIsCompound, setFormIsCompound] = useState(false);
  const [formCountry, setFormCountry] = useState("IN");
  const [formState, setFormState] = useState("");
  const [formScope, setFormScope] = useState<
    "STANDARD" | "INTRASTATE_CGST" | "INTRASTATE_SGST" | "INTERSTATE_IGST" | "VAT" | "EXEMPT"
  >("STANDARD");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTaxes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listTaxRules({
        search: searchTerm || undefined,
        tax_scope: scopeFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setTaxes(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tax rules");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, scopeFilter, statusFilter, page]);

  useEffect(() => {
    loadTaxes();
  }, [loadTaxes]);

  const openCreateModal = () => {
    setFormName("");
    setFormRate("18.0000");
    setFormType("PERCENTAGE");
    setFormIsCompound(false);
    setFormCountry("IN");
    setFormState("");
    setFormScope("STANDARD");
    setFormValidFrom("");
    setFormValidUntil("");
    setFormError(null);
    setEditingTax(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: TaxRule) => {
    setFormName(t.name);
    setFormRate(t.rate);
    setFormType(t.tax_type);
    setFormIsCompound(t.is_compound);
    setFormCountry(t.jurisdiction_country);
    setFormState(t.jurisdiction_state);
    setFormScope(t.tax_scope);
    setFormValidFrom(t.valid_from ? t.valid_from.substring(0, 16) : "");
    setFormValidUntil(t.valid_until ? t.valid_until.substring(0, 16) : "");
    setFormError(null);
    setEditingTax(t);
    setIsModalOpen(true);
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<TaxRule> = {
        name: formName,
        rate: formRate,
        tax_type: formType,
        is_compound: formIsCompound,
        jurisdiction_country: formCountry.toUpperCase(),
        jurisdiction_state: formState,
        tax_scope: formScope,
        valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : undefined,
        valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
      };

      if (editingTax) {
        await catalogApi.updateTaxRule(editingTax.id, payload);
      } else {
        await catalogApi.createTaxRule(payload);
      }
      setIsModalOpen(false);
      loadTaxes();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save tax rule");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateTax = async (t: TaxRule) => {
    if (!confirm(`Are you sure you want to deactivate tax rule "${t.name}"?`)) return;
    try {
      await catalogApi.deactivateTaxRule(t.id);
      loadTaxes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <Receipt className="h-6 w-6" />
            <h1 className="text-2xl font-bold text-slate-900">Tax Configuration</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Define statutory GST/VAT rates, jurisdiction boundaries, compound rules, and validity timelines with PostgreSQL GiST exclusion enforcement.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          New Tax Rule
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tax rule name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Scopes</option>
          <option value="STANDARD">STANDARD</option>
          <option value="INTRASTATE_CGST">INTRASTATE_CGST</option>
          <option value="INTRASTATE_SGST">INTRASTATE_SGST</option>
          <option value="INTERSTATE_IGST">INTERSTATE_IGST</option>
          <option value="VAT">VAT</option>
          <option value="EXEMPT">EXEMPT</option>
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

      {/* Tax Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading tax rules...</div>
        ) : taxes.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No tax rules found</h3>
            <p className="text-xs text-slate-500 mt-1">Configure your statutory GST/VAT rules above.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Tax Rule</th>
                <th className="px-6 py-3 text-left">Scope</th>
                <th className="px-6 py-3 text-left">Jurisdiction</th>
                <th className="px-6 py-3 text-right">Rate (%)</th>
                <th className="px-6 py-3 text-center">Compound</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {taxes.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/75 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-400 font-mono">
                      {t.valid_from ? new Date(t.valid_from).toLocaleDateString() : "Now"} →{" "}
                      {t.valid_until ? new Date(t.valid_until).toLocaleDateString() : "Indefinite"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {t.tax_scope}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700">
                      <Globe className="h-3.5 w-3.5 text-slate-400" />
                      <span>{t.jurisdiction_country}</span>
                      {t.jurisdiction_state && (
                        <span className="text-slate-500">/ {t.jurisdiction_state}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600">
                    {Number(t.rate).toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 text-center text-xs">
                    {t.is_compound ? (
                      <span className="text-purple-700 font-semibold">Yes</span>
                    ) : (
                      <span className="text-slate-400">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {t.is_active ? (
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
                      onClick={() => openEditModal(t)}
                      className="text-slate-400 hover:text-slate-700 p-1 transition"
                      title="Edit Tax Rule"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {t.is_active && (
                      <button
                        onClick={() => handleDeactivateTax(t)}
                        className="text-red-400 hover:text-red-600 p-1 transition"
                        title="Deactivate Tax Rule"
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

      {/* Tax Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingTax ? "Edit Tax Rule" : "Create Statutory Tax Rule"}
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

            <form onSubmit={handleSaveTax} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. GST Intra-State CGST 9%"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    max="100"
                    required
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tax Scope *
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="INTRASTATE_CGST">INTRASTATE_CGST</option>
                    <option value="INTRASTATE_SGST">INTRASTATE_SGST</option>
                    <option value="INTERSTATE_IGST">INTERSTATE_IGST</option>
                    <option value="VAT">VAT</option>
                    <option value="EXEMPT">EXEMPT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Country Code (2 letters) *
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    required
                    value={formCountry}
                    onChange={(e) => setFormCountry(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State / Jurisdiction (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Karnataka"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid From (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkCompound"
                  checked={formIsCompound}
                  onChange={(e) => setFormIsCompound(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="chkCompound" className="text-xs text-slate-700">
                  Compound Tax (applied on cumulative amount including previous taxes)
                </label>
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
                  {formSubmitting ? "Saving..." : editingTax ? "Update Tax Rule" : "Create Tax Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
