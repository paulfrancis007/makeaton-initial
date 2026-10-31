"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Layers,
  Receipt,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import {
  catalogApi,
  Product,
  ProductVariant,
  TaxRule,
} from "@/lib/api";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);
  const [selectedProductForTaxes, setSelectedProductForTaxes] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"SERVICE" | "SOFTWARE" | "ADDON">("SERVICE");
  const [formDesc, setFormDesc] = useState("");
  const [formBasePrice, setFormBasePrice] = useState("0.0000");
  const [formCostPrice, setFormCostPrice] = useState("0.0000");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variantPriceAdj, setVariantPriceAdj] = useState("0.0000");
  const [variantSku, setVariantSku] = useState("");
  const [variantError, setVariantError] = useState<string | null>(null);

  // Taxes state
  const [allTaxRules, setAllTaxRules] = useState<TaxRule[]>([]);
  const [assignedTaxIds, setAssignedTaxIds] = useState<string[]>([]);
  const [taxesLoading, setTaxesLoading] = useState(false);
  const [taxesSaving, setTaxesSaving] = useState(false);

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.listProducts({
        search: searchTerm || undefined,
        product_type: productTypeFilter || undefined,
        is_active: statusFilter === "" ? undefined : statusFilter === "true",
        page,
        page_size: 10,
      });
      setProducts(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, productTypeFilter, statusFilter, page]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load variants for selected product
  const loadVariants = useCallback(async (productId: string) => {
    setVariantsLoading(true);
    setVariantError(null);
    try {
      const res = await catalogApi.listVariants(productId);
      setVariants(res);
    } catch (err: unknown) {
      setVariantError(err instanceof Error ? err.message : "Failed to load variants");
    } finally {
      setVariantsLoading(false);
    }
  }, []);

  // Load taxes for selected product
  const loadTaxesForProduct = useCallback(async (productId: string) => {
    setTaxesLoading(true);
    try {
      const [taxRulesRes, assignedTaxes] = await Promise.all([
        catalogApi.listTaxRules({ is_active: true, page_size: 100 }),
        catalogApi.getProductTaxes(productId),
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
    setFormType("SERVICE");
    setFormDesc("");
    setFormBasePrice("0.0000");
    setFormCostPrice("0.0000");
    setFormError(null);
    setEditingProduct(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (p: Product) => {
    setFormName(p.name);
    setFormType(p.product_type);
    setFormDesc(p.description || "");
    setFormBasePrice(p.base_sales_price);
    setFormCostPrice(p.cost_price);
    setFormError(null);
    setEditingProduct(p);
    setIsCreateOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingProduct) {
        await catalogApi.updateProduct(editingProduct.id, {
          name: formName,
          product_type: formType,
          description: formDesc || null,
          base_sales_price: formBasePrice,
          cost_price: formCostPrice,
        });
      } else {
        await catalogApi.createProduct({
          name: formName,
          product_type: formType,
          description: formDesc || undefined,
          base_sales_price: formBasePrice,
          cost_price: formCostPrice,
        });
      }
      setIsCreateOpen(false);
      loadProducts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeactivateProduct = async (p: Product) => {
    if (!confirm(`Are you sure you want to deactivate product "${p.name}"?`)) return;
    try {
      await catalogApi.deactivateProduct(p.id);
      loadProducts();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForVariants) return;
    setVariantError(null);
    try {
      await catalogApi.createVariant(selectedProductForVariants.id, {
        name: variantName,
        price_adjustment: variantPriceAdj,
        sku: variantSku ? variantSku.trim() : undefined,
      });
      setVariantName("");
      setVariantPriceAdj("0.0000");
      setVariantSku("");
      loadVariants(selectedProductForVariants.id);
    } catch (err: unknown) {
      setVariantError(err instanceof Error ? err.message : "Failed to add variant");
    }
  };

  const handleDeactivateVariant = async (variantId: string) => {
    if (!selectedProductForVariants) return;
    try {
      await catalogApi.deactivateVariant(selectedProductForVariants.id, variantId);
      loadVariants(selectedProductForVariants.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to deactivate variant");
    }
  };

  const handleSaveTaxes = async () => {
    if (!selectedProductForTaxes) return;
    setTaxesSaving(true);
    try {
      await catalogApi.setProductTaxes(selectedProductForTaxes.id, assignedTaxIds);
      setSelectedProductForTaxes(null);
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
            <Package className="h-6 w-6" />
            <h1 className="text-2xl font-bold text-slate-900">Product Catalogue</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage billable goods, services, software packages, variants, and tax classifications.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          New Product
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={productTypeFilter}
          onChange={(e) => {
            setProductTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="SERVICE">Service</option>
          <option value="SOFTWARE">Software</option>
          <option value="ADDON">Addon</option>
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

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading product catalogue...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No products found</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or create a new product.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-3 text-left">Product Name</th>
                <th className="px-6 py-3 text-left">Type</th>
                <th className="px-6 py-3 text-right">Base Sales Price</th>
                <th className="px-6 py-3 text-right">Cost Price</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/75 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-slate-500 line-clamp-1">{p.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {p.product_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                    ₹{Number(p.base_sales_price).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-500">
                    ₹{Number(p.cost_price).toFixed(2)}
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
                        setSelectedProductForVariants(p);
                        loadVariants(p.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                      title="Manage Product Variants"
                    >
                      <Layers className="h-3.5 w-3.5 text-indigo-600" /> Variants
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProductForTaxes(p);
                        loadTaxesForProduct(p.id);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                      title="Assign Tax Rules"
                    >
                      <Receipt className="h-3.5 w-3.5 text-emerald-600" /> Taxes
                    </button>
                    <button
                      onClick={() => openEditModal(p)}
                      className="text-slate-400 hover:text-slate-700 p-1 transition"
                      title="Edit Product"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {p.is_active && (
                      <button
                        onClick={() => handleDeactivateProduct(p)}
                        className="text-red-400 hover:text-red-600 p-1 transition"
                        title="Deactivate Product"
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

      {/* Create / Edit Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? "Edit Product" : "Create New Product"}
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dedicated Cloud VM"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Type *
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "SERVICE" | "SOFTWARE" | "ADDON")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="SERVICE">SERVICE</option>
                  <option value="SOFTWARE">SOFTWARE</option>
                  <option value="ADDON">ADDON</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief summary of product features..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Base Sales Price (₹) *
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
                    Cost Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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
                  {formSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Variants Drawer / Modal */}
      {selectedProductForVariants && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Variants: {selectedProductForVariants.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Base Price: ₹{Number(selectedProductForVariants.base_sales_price).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setSelectedProductForVariants(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {variantError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {variantError}
              </div>
            )}

            {/* Existing Variants Table */}
            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
              {variantsLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading variants...</div>
              ) : variants.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No variants defined yet. Use the form below to add one.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-medium">
                    <tr>
                      <th className="px-3 py-2 text-left">Variant</th>
                      <th className="px-3 py-2 text-left">SKU</th>
                      <th className="px-3 py-2 text-right">Adjustment</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variants.map((v) => (
                      <tr key={v.id}>
                        <td className="px-3 py-2 font-medium text-slate-800">{v.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{v.sku || "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {Number(v.price_adjustment) >= 0 ? "+" : ""}
                          ₹{Number(v.price_adjustment).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {v.is_active ? (
                            <span className="text-emerald-600 font-semibold">Active</span>
                          ) : (
                            <span className="text-slate-400">Inactive</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {v.is_active && (
                            <button
                              onClick={() => handleDeactivateVariant(v.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Deactivate"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add Variant Form */}
            <form onSubmit={handleAddVariant} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Add New Variant
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Variant Name *"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Unique SKU (optional)"
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-mono focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="Price Adj (₹)"
                  value={variantPriceAdj}
                  onChange={(e) => setVariantPriceAdj(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium"
                >
                  Add Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tax Assignment Modal */}
      {selectedProductForTaxes && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Assign Taxes
                </h2>
                <p className="text-xs text-slate-500">
                  Product: {selectedProductForTaxes.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedProductForTaxes(null)}
                className="text-slate-400 hover:text-slate-600"
              >
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
                onClick={() => setSelectedProductForTaxes(null)}
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
