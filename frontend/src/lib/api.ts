// Central API client for Brightloop Frontend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Customer {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string | null;
  tax_number: string | null;
  billing_address_line1: string;
  billing_address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  product_type: "SERVICE" | "SOFTWARE" | "ADDON";
  description: string | null;
  base_sales_price: string;
  cost_price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_adjustment: string;
  sku: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  billing_interval: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval_count: number;
  base_price: string;
  minimum_quantity: number;
  availability_start_date: string | null;
  availability_end_date: string | null;
  auto_renew: boolean;
  auto_close_on_expiry: boolean;
  allow_pause: boolean;
  allow_early_closure: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxRule {
  id: string;
  name: string;
  rate: string;
  tax_type: string;
  is_compound: boolean;
  jurisdiction_country: string;
  jurisdiction_state: string;
  tax_scope: "STANDARD" | "INTRASTATE_CGST" | "INTRASTATE_SGST" | "INTERSTATE_IGST" | "VAT" | "EXEMPT";
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountRule {
  id: string;
  code: string;
  name: string;
  discount_type: "PERCENTAGE" | "FIXED_AMOUNT";
  discount_value: string;
  scope: "ORDER" | "PRODUCT_SELECTION";
  application_frequency: "FIRST_INVOICE_ONLY" | "RECURRING_ALL_CYCLES" | "FINITE_CYCLES";
  max_cycles: number | null;
  minimum_purchase_amount: string;
  minimum_quantity: number;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  eligible_product_ids: string[];
}

export interface DiscountEvaluationRequest {
  code: string;
  order_subtotal: string;
  items?: { product_id: string; quantity: number; unit_price: string }[];
  cycle_number?: number;
}

export interface DiscountEvaluationResponse {
  is_eligible: boolean;
  rejection_reason: string | null;
  discount_code: string;
  discount_type: string | null;
  discount_value: string | null;
  discount_amount: string;
  qualifying_subtotal: string;
  rule_name: string | null;
  rule_id: string | null;
}

// -------------------------------------------------------------
// Quotation Interfaces
// -------------------------------------------------------------
export interface QuotationLineTax {
  id: string;
  quotation_line_id: string;
  tax_rule_id: string | null;
  tax_name_snapshot: string;
  tax_rate_snapshot: string;
  tax_amount: string;
}

export interface QuotationLine {
  id: string;
  quotation_id: string;
  line_type: "PLAN_FEE" | "PRODUCT";
  product_id: string | null;
  variant_id: string | null;
  description_snapshot: string;
  unit_price: string;
  quantity: number;
  tax_rate_snapshot: string;
  tax_amount: string;
  discount_amount: string;
  line_total: string;
  taxes: QuotationLineTax[];
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  template_id: string | null;
  plan_id: string;
  status: "DRAFT" | "SENT" | "CONFIRMED" | "EXPIRED" | "REJECTED";
  issue_date: string;
  expiry_date: string;
  plan_price_snapshot: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  rounding_adjustment: string;
  total_amount: string;
  currency: string;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface QuotationDetail extends Quotation {
  lines: QuotationLine[];
  plan_name?: string | null;
  customer_company_name?: string | null;
}

export interface QuotationTemplateLine {
  id: string;
  template_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price_override: string | null;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description: string | null;
  plan_id: string;
  validity_duration_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  lines: QuotationTemplateLine[];
}

// -------------------------------------------------------------
// Subscription Interfaces
// -------------------------------------------------------------
export interface SubscriptionLineTax {
  id: string;
  subscription_line_id: string;
  tax_rule_id: string | null;
  tax_name_snapshot: string;
  tax_rate_snapshot: string;
  tax_amount: string;
}

export interface SubscriptionLine {
  id: string;
  subscription_id: string;
  line_type: "PLAN_FEE" | "PRODUCT";
  product_id: string | null;
  variant_id: string | null;
  description_snapshot: string;
  unit_price_snapshot: string;
  quantity: number;
  tax_rate_snapshot: string;
  line_total: string;
  taxes: SubscriptionLineTax[];
}

export interface SubscriptionPauseHistory {
  id: string;
  subscription_id: string;
  paused_at: string;
  resumed_at: string | null;
  pause_reason: string | null;
  days_extended: number;
  initiated_by_user_id: string;
}

export interface Subscription {
  id: string;
  subscription_number: string;
  customer_id: string;
  quotation_id: string | null;
  plan_id: string;
  status: "DRAFT" | "QUOTATION" | "CONFIRMED" | "ACTIVE" | "PAUSED" | "EXPIRED" | "CLOSED";
  start_date: string;
  expiry_date: string | null;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string;
  billing_anchor_day: number;
  billing_interval_snapshot: string;
  interval_count_snapshot: number;
  allow_pause_snapshot: boolean;
  allow_early_closure_snapshot: boolean;
  auto_renew_snapshot: boolean;
  auto_close_snapshot: boolean;
  plan_name_snapshot: string;
  plan_price_snapshot: string;
  recurring_subtotal: string;
  recurring_discount: string;
  recurring_tax: string;
  recurring_total_amount: string;
  currency: string;
  payment_terms_days: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionDetail extends Subscription {
  lines: SubscriptionLine[];
  pause_history: SubscriptionPauseHistory[];
  customer_company_name?: string | null;
}

export function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("brightloop_token") || "";
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("brightloop_token", token);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "An unexpected error occurred.";
    try {
      const errorJson = await response.json();
      if (typeof errorJson === "string") {
        errorDetail = errorJson;
      } else if (Array.isArray(errorJson?.detail)) {
        // FastAPI / Pydantic validation error list
        errorDetail = errorJson.detail
          .map((d: any) => {
            if (typeof d === "string") return d;
            const field = Array.isArray(d.loc)
              ? d.loc.filter((locPart: any) => locPart !== "body").join(".")
              : "";
            return field ? `${field}: ${d.msg || JSON.stringify(d)}` : d.msg || JSON.stringify(d);
          })
          .join("; ");
      } else if (typeof errorJson?.detail === "string") {
        errorDetail = errorJson.detail;
      } else if (typeof errorJson?.detail === "object" && errorJson.detail !== null) {
        errorDetail = JSON.stringify(errorJson.detail);
      } else if (typeof errorJson?.message === "string") {
        errorDetail = errorJson.message;
      } else {
        errorDetail = JSON.stringify(errorJson);
      }
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export function formatApiError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "object" && err !== null) {
    if ("detail" in err) {
      const detail = (err as any).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((d: any) => {
            if (typeof d === "string") return d;
            const field = Array.isArray(d.loc)
              ? d.loc.filter((locPart: any) => locPart !== "body").join(".")
              : "";
            return field ? `${field}: ${d.msg || JSON.stringify(d)}` : d.msg || JSON.stringify(d);
          })
          .join("; ");
      }
      return JSON.stringify(detail);
    }
    if ("message" in err && typeof (err as any).message === "string") {
      return (err as any).message;
    }
    return JSON.stringify(err);
  }
  return String(err);
}

// -------------------------------------------------------------
// Customer API
// -------------------------------------------------------------
export const customerApi = {
  listCustomers: (params?: { search?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Customer>>(`/customers/?${query.toString()}`);
  },
  getCustomer: (id: string) => request<Customer>(`/customers/${id}`),
};

// -------------------------------------------------------------
// Catalog API
// -------------------------------------------------------------
export const catalogApi = {
  // Products
  listProducts: (params?: { search?: string; product_type?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.product_type) query.append("product_type", params.product_type);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Product>>(`/products/?${query.toString()}`);
  },
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  createProduct: (data: Partial<Product>) =>
    request<Product>("/products/", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateProduct: (id: string) =>
    request<Product>(`/products/${id}`, { method: "DELETE" }),
  getProductTaxes: (id: string) => request<TaxRule[]>(`/products/${id}/taxes`),
  setProductTaxes: (id: string, tax_rule_ids: string[]) =>
    request<TaxRule[]>(`/products/${id}/taxes`, { method: "PUT", body: JSON.stringify({ tax_rule_ids }) }),

  // Variants
  listVariants: (productId: string, is_active?: boolean) => {
    const query = is_active !== undefined ? `?is_active=${is_active}` : "";
    return request<ProductVariant[]>(`/products/${productId}/variants${query}`);
  },
  createVariant: (productId: string, data: Partial<ProductVariant>) =>
    request<ProductVariant>(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  updateVariant: (productId: string, variantId: string, data: Partial<ProductVariant>) =>
    request<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateVariant: (productId: string, variantId: string) =>
    request<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "DELETE" }),

  // Plans
  listPlans: (params?: { search?: string; billing_interval?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.billing_interval) query.append("billing_interval", params.billing_interval);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Plan>>(`/plans/?${query.toString()}`);
  },
  getPlan: (id: string) => request<Plan>(`/plans/${id}`),
  createPlan: (data: Partial<Plan>) =>
    request<Plan>("/plans/", { method: "POST", body: JSON.stringify(data) }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivatePlan: (id: string) =>
    request<Plan>(`/plans/${id}`, { method: "DELETE" }),
  getPlanTaxes: (id: string) => request<TaxRule[]>(`/plans/${id}/taxes`),
  setPlanTaxes: (id: string, tax_rule_ids: string[]) =>
    request<TaxRule[]>(`/plans/${id}/taxes`, { method: "PUT", body: JSON.stringify({ tax_rule_ids }) }),

  // Taxes
  listTaxRules: (params?: { search?: string; tax_scope?: string; jurisdiction_country?: string; jurisdiction_state?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.tax_scope) query.append("tax_scope", params.tax_scope);
    if (params?.jurisdiction_country) query.append("jurisdiction_country", params.jurisdiction_country);
    if (params?.jurisdiction_state) query.append("jurisdiction_state", params.jurisdiction_state);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<TaxRule>>(`/taxes/?${query.toString()}`);
  },
  getTaxRule: (id: string) => request<TaxRule>(`/taxes/${id}`),
  createTaxRule: (data: Partial<TaxRule>) =>
    request<TaxRule>("/taxes/", { method: "POST", body: JSON.stringify(data) }),
  updateTaxRule: (id: string, data: Partial<TaxRule>) =>
    request<TaxRule>(`/taxes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateTaxRule: (id: string) =>
    request<TaxRule>(`/taxes/${id}`, { method: "DELETE" }),

  // Discounts
  listDiscountRules: (params?: { search?: string; discount_type?: string; scope?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.discount_type) query.append("discount_type", params.discount_type);
    if (params?.scope) query.append("scope", params.scope);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<DiscountRule>>(`/discounts/?${query.toString()}`);
  },
  getDiscountRule: (id: string) => request<DiscountRule>(`/discounts/${id}`),
  createDiscountRule: (data: Partial<DiscountRule>) =>
    request<DiscountRule>("/discounts/", { method: "POST", body: JSON.stringify(data) }),
  updateDiscountRule: (id: string, data: Partial<DiscountRule>) =>
    request<DiscountRule>(`/discounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deactivateDiscountRule: (id: string) =>
    request<DiscountRule>(`/discounts/${id}`, { method: "DELETE" }),
  evaluateDiscount: (data: DiscountEvaluationRequest) =>
    request<DiscountEvaluationResponse>("/discounts/evaluate", { method: "POST", body: JSON.stringify(data) }),
};

// -------------------------------------------------------------
// Quotation API
// -------------------------------------------------------------
export const quotationApi = {
  listTemplates: (params?: { search?: string; is_active?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<QuotationTemplate>>(`/quotations/templates?${query.toString()}`);
  },
  getTemplate: (id: string) => request<QuotationTemplate>(`/quotations/templates/${id}`),
  createTemplate: (data: any) =>
    request<QuotationTemplate>("/quotations/templates", { method: "POST", body: JSON.stringify(data) }),

  listQuotations: (params?: { customer_id?: string; status?: string; search?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.customer_id) query.append("customer_id", params.customer_id);
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Quotation>>(`/quotations/?${query.toString()}`);
  },
  getQuotation: (id: string) => request<QuotationDetail>(`/quotations/${id}`),
  createQuotation: (data: any) =>
    request<Quotation>("/quotations/", { method: "POST", body: JSON.stringify(data) }),
  updateQuotation: (id: string, data: any) =>
    request<QuotationDetail>(`/quotations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string, rejection_reason?: string) =>
    request<Quotation>(`/quotations/${id}/status`, { method: "POST", body: JSON.stringify({ status, rejection_reason }) }),
};

// -------------------------------------------------------------
// Subscription API
// -------------------------------------------------------------
export const subscriptionApi = {
  convertFromQuotation: (quotationId: string, data?: { start_date?: string; payment_terms_days?: number }) =>
    request<Subscription>(`/subscriptions/from-quotation/${quotationId}`, { method: "POST", body: JSON.stringify(data || {}) }),
  listSubscriptions: (params?: { customer_id?: string; status?: string; search?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.customer_id) query.append("customer_id", params.customer_id);
    if (params?.status) query.append("status", params.status);
    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", String(params.page));
    if (params?.page_size) query.append("page_size", String(params.page_size));
    return request<PaginatedResult<Subscription>>(`/subscriptions/?${query.toString()}`);
  },
  getSubscription: (id: string) => request<SubscriptionDetail>(`/subscriptions/${id}`),
  activate: (id: string) =>
    request<Subscription>(`/subscriptions/${id}/activate`, { method: "POST" }),
  pause: (id: string, reason?: string) =>
    request<Subscription>(`/subscriptions/${id}/pause`, { method: "POST", body: JSON.stringify({ reason }) }),
  resume: (id: string) =>
    request<Subscription>(`/subscriptions/${id}/resume`, { method: "POST" }),
  close: (id: string, reason?: string) =>
    request<Subscription>(`/subscriptions/${id}/close`, { method: "POST", body: JSON.stringify({ reason }) }),
};


// -------------------------------------------------------------
// User & Auth Types & API
// -------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  is_active: boolean;
}

export interface InvoiceLineTax {
  id: string;
  invoice_line_id: string;
  tax_rule_id: string | null;
  tax_name_snapshot: string;
  tax_rate_snapshot: string;
  tax_amount: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  line_type: "PLAN_FEE" | "PRODUCT";
  product_id: string | null;
  product_name?: string | null;
  variant_id: string | null;
  plan_name?: string | null;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  tax_amount: string;
  discount_amount: string;
  line_total: string;
  total_amount?: string;
  taxes: InvoiceLineTax[];
}

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "UPI" | "CARD" | "CHEQUE" | "OTHER";

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  customer_id: string;
  customer_name?: string | null;
  invoice_number?: string | null;
  amount: string;
  payment_method: PaymentMethod;
  status: "SUCCESS" | "VOIDED";
  payment_date: string;
  reference_number?: string | null;
  notes?: string | null;
  voided_at?: string | null;
  voided_by_user_id?: string | null;
  void_reason?: string | null;
  recorded_by_user_id: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  subscription_id: string;
  customer_id: string;
  customer_name?: string | null;
  subscription_number?: string | null;
  status: "DRAFT" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  issue_date: string;
  due_date: string;
  billing_period_start: string;
  billing_period_end: string;
  period_start?: string;
  period_end?: string;
  subtotal_amount: string;
  discount_amount: string;
  tax_amount: string;
  rounding_adjustment: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  currency: string;
  notes?: string | null;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDetail extends Invoice {
  lines: InvoiceLine[];
  payments: Payment[];
}

export interface AdminDashboardData {
  period?: {
    start_date: string;
    end_date: string;
  };
  overview?: Record<string, any>;
  metrics: {
    total_customers: number;
    active_customers: number;
    total_subscriptions: number;
    active_subscriptions: number;
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    overdue_amount: number;
    invoices_count: number;
    overdue_invoices_count: number;
    subscriptions_due_for_billing?: number;
    total_invoiced_amount?: number;
    total_payments_collected?: number;
    outstanding_balance?: number;
    payments_in_selected_range?: number;
  };
  recent_invoices: Array<{
    id: string;
    invoice_number: string;
    customer_name?: string | null;
    total_amount: number;
    balance_due: number;
    status: string;
    issue_date: string;
    due_date?: string;
  }>;
  recent_payments: Array<{
    id: string;
    payment_number: string;
    payment_date: string;
    payment_method: string;
    amount: number;
    status: string;
    invoice_number?: string | null;
  }>;
}

export interface CustomerDashboardData {
  customer: {
    id: string;
    company_name: string;
  };
  metrics: {
    active_subscriptions: number;
    total_subscriptions: number;
    outstanding_balance: number;
    total_paid: number;
    unpaid_invoices_count: number;
  };
  subscriptions: Array<{
    id: string;
    subscription_number: string;
    start_date: string;
    next_billing_date?: string | null;
    status: string;
  }>;
  recent_invoices: Array<{
    id: string;
    invoice_number: string;
    due_date: string;
    total_amount: number;
    status: string;
  }>;
  recent_payments: Array<{
    id: string;
    payment_number: string;
    payment_date: string;
    payment_method: string;
    amount: number;
    status: string;
  }>;
}

export interface AuditLog {
  id: string;
  actor_user_id?: string | null;
  action: string;
  entity_name: string;
  entity_id?: string | null;
  ip_address?: string | null;
  details: Record<string, any>;
  created_at: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    return request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  getCurrentUser: async (): Promise<User> => {
    return request<User>("/auth/me");
  },
};

export const invoiceApi = {
  listInvoices: (params?: {
    customer_id?: string;
    subscription_id?: string;
    status?: string;
    overdue_only?: boolean;
    is_overdue?: boolean;
    search?: string;
    page?: number;
    size?: number;
    page_size?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.customer_id) query.append("customer_id", params.customer_id);
    if (params?.subscription_id) query.append("subscription_id", params.subscription_id);
    if (params?.status) query.append("status", params.status);
    if (params?.overdue_only || params?.is_overdue) query.append("overdue_only", "true");
    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", String(params.page));
    const s = params?.size || params?.page_size;
    if (s) query.append("size", String(s));
    return request<PaginatedResult<Invoice>>(`/invoices/?${query.toString()}`);
  },
  getInvoice: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
  createFromSubscription: (subscriptionId: string, billingDate?: string) => {
    const query = billingDate ? `?billing_date=${billingDate}` : "";
    return request<InvoiceDetail>(`/invoices/from-subscription/${subscriptionId}${query}`, { method: "POST" });
  },
  runBilling: (dataOrDate?: string | { billing_date?: string; run_date?: string; batch_size?: number }, batchSize?: number) => {
    let billingDate: string | null = null;
    let bSize = 100;
    if (typeof dataOrDate === "string") {
      billingDate = dataOrDate;
      if (batchSize) bSize = batchSize;
    } else if (dataOrDate && typeof dataOrDate === "object") {
      billingDate = dataOrDate.billing_date || dataOrDate.run_date || null;
      if (dataOrDate.batch_size) bSize = dataOrDate.batch_size;
    }
    return request<any>("/invoices/run-billing", {
      method: "POST",
      body: JSON.stringify({ billing_date: billingDate, batch_size: bSize }),
    });
  },
  cancel: (id: string, reason?: string) => {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    return request<Invoice>(`/invoices/${id}/cancel${query}`, { method: "POST" });
  },
  cancelInvoice: (id: string, reason?: string) => {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
    return request<Invoice>(`/invoices/${id}/cancel${query}`, { method: "POST" });
  },
  getPdfUrl: (id: string) => `${API_BASE_URL}/invoices/${id}/pdf`,
  downloadPdf: async (id: string): Promise<Blob> => {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/invoices/${id}/pdf`, { headers });
    if (!res.ok) throw new Error("Failed to download PDF invoice");
    return res.blob();
  },
  sendEmail: (id: string, recipientEmail?: string) => {
    const query = recipientEmail ? `?recipient_email=${encodeURIComponent(recipientEmail)}` : "";
    return request<{ sent?: boolean; status?: string; recipient?: string; message?: string }>(
      `/invoices/${id}/send-email${query}`,
      { method: "POST" }
    );
  },
};

export const paymentApi = {
  listPayments: (params?: { invoice_id?: string; customer_id?: string; status?: string; payment_method?: PaymentMethod | string; method?: PaymentMethod | string; page?: number; size?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.invoice_id) query.append("invoice_id", params.invoice_id);
    if (params?.customer_id) query.append("customer_id", params.customer_id);
    if (params?.status) query.append("status", params.status);
    const m = params?.payment_method || params?.method;
    if (m) query.append("payment_method", m);
    if (params?.page) query.append("page", String(params.page));
    const s = params?.size || params?.page_size;
    if (s) query.append("size", String(s));
    return request<PaginatedResult<Payment>>(`/payments/?${query.toString()}`);
  },
  getPayment: (id: string) => request<Payment>(`/payments/${id}`),
  recordPayment: (data: { invoice_id: string; amount: number | string; payment_method: PaymentMethod | string; reference_number?: string; notes?: string }) => {
    return request<Payment>("/payments/", { method: "POST", body: JSON.stringify(data) });
  },
  createPayment: (data: { invoice_id: string; amount: number | string; payment_method: PaymentMethod | string; reference_number?: string; notes?: string }) => {
    return request<Payment>("/payments/", { method: "POST", body: JSON.stringify(data) });
  },
  voidPayment: (id: string, void_reason: string) => {
    return request<Payment>(`/payments/${id}/void`, { method: "POST", body: JSON.stringify({ void_reason }) });
  },
};

export const dashboardApi = {
  getAdminDashboard: (startDate?: string, endDate?: string) => {
    const query = new URLSearchParams();
    if (startDate) query.append("start_date", startDate);
    if (endDate) query.append("end_date", endDate);
    return request<any>(`/dashboard/admin?${query.toString()}`);
  },
  getStaffDashboard: () => request<any>("/dashboard/staff"),
  getCustomerDashboard: () => request<any>("/dashboard/customer"),
};

export const auditApi = {
  listAuditLogs: (params?: { action?: string; entity_name?: string; page?: number; size?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.append("action", params.action);
    if (params?.entity_name) query.append("entity_name", params.entity_name);
    if (params?.page) query.append("page", String(params.page));
    const s = params?.size || params?.page_size;
    if (s) query.append("size", String(s));
    return request<PaginatedResult<AuditLog>>(`/audit/?${query.toString()}`);
  },
  listLogs: (params?: { action?: string; entity_name?: string; page?: number; size?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params?.action) query.append("action", params.action);
    if (params?.entity_name) query.append("entity_name", params.entity_name);
    if (params?.page) query.append("page", String(params.page));
    const s = params?.size || params?.page_size;
    if (s) query.append("size", String(s));
    return request<PaginatedResult<AuditLog>>(`/audit/?${query.toString()}`);
  },
};
