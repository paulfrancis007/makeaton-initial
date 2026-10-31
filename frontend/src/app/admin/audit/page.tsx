"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  User,
  Database,
  FileCode,
} from "lucide-react";
import { auditApi, AuditLog } from "@/lib/api";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.listLogs({
        action: actionFilter || undefined,
        entity_name: entityFilter || undefined,
        page,
        page_size: 15,
      });
      setLogs(res.items);
      setTotalPages(res.pages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-indigo-600" />
            System Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable security log recording financial transactions, billing runs, authorizations and administrative actions.
          </p>
        </div>
        <button
          onClick={() => loadLogs()}
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh logs"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Actions</option>
          <option value="PAYMENT_RECORDED">PAYMENT_RECORDED</option>
          <option value="PAYMENT_VOIDED">PAYMENT_VOIDED</option>
          <option value="INVOICE_GENERATED">INVOICE_GENERATED</option>
          <option value="INVOICE_CANCELLED">INVOICE_CANCELLED</option>
          <option value="INVOICE_EMAIL_SENT">INVOICE_EMAIL_SENT</option>
          <option value="BATCH_BILLING_RUN">BATCH_BILLING_RUN</option>
          <option value="SUBSCRIPTION_ACTIVATED">SUBSCRIPTION_ACTIVATED</option>
        </select>
        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Entities</option>
          <option value="invoice">invoice</option>
          <option value="payment">payment</option>
          <option value="subscription">subscription</option>
          <option value="quotation">quotation</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
            Loading audit records...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 text-sm">{error}</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center">
            <ShieldAlert className="h-10 w-10 text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-base">No audit events found</p>
            <p className="text-xs text-slate-400 mt-1">
              Events will be appended automatically as system operations take place.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {log.entity_name}
                          {log.entity_id && (
                            <span className="block text-[10px] text-slate-400">
                              {log.entity_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {log.actor_user_id ? log.actor_user_id.slice(0, 8) + "..." : "SYSTEM"}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {log.ip_address || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() =>
                              setExpandedLogId(isExpanded ? null : log.id)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 text-[11px]"
                          >
                            <FileCode className="h-3 w-3" />
                            {isExpanded ? "Hide" : "Payload"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="p-4 border-b border-slate-200">
                            <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono overflow-x-auto max-h-60">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
    </div>
  );
}
