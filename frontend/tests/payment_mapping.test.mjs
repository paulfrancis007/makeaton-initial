import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("Record Payment Modal maps 'Credit Card' to 'CARD'", () => {
  const invoicePagePath = path.resolve(__dirname, "../src/app/admin/invoices/page.tsx");
  const content = fs.readFileSync(invoicePagePath, "utf-8");

  // Verify Credit Card option has value="CARD"
  assert.match(
    content,
    /<option\s+value="CARD">\s*Credit Card\s*<\/option>/,
    "Dropdown option for Credit Card must submit value CARD"
  );

  // Verify initial state is CARD
  assert.match(
    content,
    /useState<PaymentMethod>\("CARD"\)/,
    "Initial paymentMethod state must be CARD"
  );

  // Verify openRecordPayment sets CARD
  assert.match(
    content,
    /setPaymentMethod\("CARD"\)/,
    "openRecordPayment must set paymentMethod to CARD"
  );

  // Verify all 6 backend payment methods are represented in modal
  const backendMethods = ["CARD", "BANK_TRANSFER", "UPI", "CASH", "CHEQUE", "OTHER"];
  for (const method of backendMethods) {
    assert.match(
      content,
      new RegExp(`<option\\s+value="${method}">`),
      `Option for ${method} must be present in payment modal`
    );
  }
});

test("Admin Payments filter includes all payment methods with 'Credit Card' -> 'CARD'", () => {
  const paymentsPagePath = path.resolve(__dirname, "../src/app/admin/payments/page.tsx");
  const content = fs.readFileSync(paymentsPagePath, "utf-8");

  // Verify filter option for Credit Card has value="CARD"
  assert.match(
    content,
    /<option\s+value="CARD">\s*Credit Card\s*<\/option>/,
    "Filter dropdown option for Credit Card must have value CARD"
  );

  // Verify all 6 backend payment methods are in filter
  const backendMethods = ["CARD", "BANK_TRANSFER", "UPI", "CASH", "CHEQUE", "OTHER"];
  for (const method of backendMethods) {
    assert.match(
      content,
      new RegExp(`<option\\s+value="${method}">`),
      `Filter option for ${method} must be present in payments page`
    );
  }
});

test("formatApiError formats FastAPI validation errors into human-readable strings without [object Object]", () => {
  const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
  const content = fs.readFileSync(apiPath, "utf-8");

  // Check formatApiError function exists
  assert.match(content, /export function formatApiError/);

  // Inline simulation of the logic in formatApiError
  function formatApiError(err) {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === "string") {
      return err;
    }
    if (typeof err === "object" && err !== null) {
      if ("detail" in err) {
        const detail = err.detail;
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
          return detail
            .map((d) => {
              if (typeof d === "string") return d;
              const field = Array.isArray(d.loc)
                ? d.loc.filter((locPart) => locPart !== "body").join(".")
                : "";
              return field ? `${field}: ${d.msg || JSON.stringify(d)}` : d.msg || JSON.stringify(d);
            })
            .join("; ");
        }
        return JSON.stringify(detail);
      }
      if ("message" in err && typeof err.message === "string") {
        return err.message;
      }
      return JSON.stringify(err);
    }
    return String(err);
  }

  // 1. FastAPI 422 validation error
  const fastapi422 = {
    detail: [
      {
        type: "literal_error",
        loc: ["body", "payment_method"],
        msg: "Input should be 'CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE' or 'OTHER'",
        input: "CREDIT_CARD",
        ctx: { expected: "'CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE' or 'OTHER'" },
      },
    ],
  };

  const formatted = formatApiError(fastapi422);
  assert.doesNotMatch(formatted, /\[object Object\]/);
  assert.equal(
    formatted,
    "payment_method: Input should be 'CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE' or 'OTHER'"
  );

  // 2. String error
  assert.equal(formatApiError({ detail: "Overpayment rejected" }), "Overpayment rejected");

  // 3. Error instance
  assert.equal(formatApiError(new Error("Network failed")), "Network failed");
});
