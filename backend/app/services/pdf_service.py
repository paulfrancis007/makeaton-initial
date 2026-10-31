import datetime
from decimal import Decimal
import io
from typing import Optional

from app.models.billing import Invoice
from app.models.governance import CompanySetting


def _escape_pdf_text(text: str) -> str:
    """Escape parentheses and backslashes for PDF literal text strings."""
    if not text:
        return ""
    text = str(text)
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def generate_invoice_pdf(invoice: Invoice, company: Optional[CompanySetting] = None) -> bytes:
    """
    Generate a valid, fully standalone PDF-1.4 document for an invoice.
    Uses exact database financial snapshots without altering or recalculating amounts.
    Requires no external dependencies.
    """
    company_name = company.company_name if company else "Brightloop Technologies Pvt Ltd"
    tax_reg = company.tax_registration_number if company else "GSTIN: 29AABCB1234F1Z5"
    company_email = company.contact_email if company and company.contact_email else "billing@brightloop.io"
    company_phone = company.contact_phone if company and company.contact_phone else "+91 80 4000 1234"
    currency = invoice.currency or "INR"

    cust = invoice.customer
    customer_name = cust.company_name if cust else "Valued Customer"
    customer_email = cust.contact_email if cust else "N/A"
    customer_addr = f"{cust.billing_address_line1}, {cust.city}, {cust.state} {cust.postal_code}, {cust.country}" if cust else "N/A"

    # Assemble stream lines
    stream_ops = []

    # Background header banner: dark slate / indigo box
    # rect at x=40, y=710, w=532, h=70
    stream_ops.append("q 0.12 0.16 0.24 rg 40 710 532 70 re f Q")

    # Header text
    stream_ops.append("BT /F1 18 Tf 1 1 1 rg 55 750 Td (" + _escape_pdf_text(company_name) + ") Tj ET")
    stream_ops.append("BT /F2 9 Tf 0.8 0.85 0.95 rg 55 734 Td (" + _escape_pdf_text(f"{tax_reg}  |  {company_email}  |  {company_phone}") + ") Tj ET")

    # Invoice Title & Number
    stream_ops.append("BT /F1 16 Tf 0.1 0.1 0.1 rg 55 675 Td (TAX INVOICE) Tj ET")
    stream_ops.append("BT /F2 10 Tf 0.3 0.3 0.3 rg 55 658 Td (Invoice Number: " + _escape_pdf_text(invoice.invoice_number) + ") Tj ET")
    stream_ops.append("BT /F2 9 Tf 0.3 0.3 0.3 rg 55 644 Td (Status: " + _escape_pdf_text(invoice.status) + ") Tj ET")

    # Dates block (right column)
    stream_ops.append("BT /F2 9 Tf 0.2 0.2 0.2 rg 350 675 Td (Issue Date: " + _escape_pdf_text(str(invoice.issue_date)) + ") Tj ET")
    stream_ops.append("BT /F2 9 Tf 0.2 0.2 0.2 rg 350 660 Td (Due Date: " + _escape_pdf_text(str(invoice.due_date)) + ") Tj ET")
    stream_ops.append("BT /F2 9 Tf 0.2 0.2 0.2 rg 350 645 Td (Billing Period: " + _escape_pdf_text(f"{invoice.billing_period_start} to {invoice.billing_period_end}") + ") Tj ET")

    # Divider line
    stream_ops.append("q 0.8 0.8 0.8 RG 1 w 40 630 m 572 630 l S Q")

    # Billed To block
    stream_ops.append("BT /F1 10 Tf 0.15 0.2 0.3 rg 55 612 Td (BILLED TO:) Tj ET")
    stream_ops.append("BT /F1 11 Tf 0.1 0.1 0.1 rg 55 597 Td (" + _escape_pdf_text(customer_name) + ") Tj ET")
    stream_ops.append("BT /F2 9 Tf 0.3 0.3 0.3 rg 55 583 Td (" + _escape_pdf_text(customer_email) + ") Tj ET")
    stream_ops.append("BT /F2 8 Tf 0.35 0.35 0.35 rg 55 570 Td (" + _escape_pdf_text(customer_addr) + ") Tj ET")

    # Table Header Banner
    stream_ops.append("q 0.94 0.95 0.97 rg 40 540 532 20 re f Q")
    stream_ops.append("q 0.7 0.72 0.76 RG 0.5 w 40 540 532 20 re S Q")
    stream_ops.append("BT /F1 8 Tf 0.2 0.25 0.35 rg 50 546 Td (DESCRIPTION) Tj ET")
    stream_ops.append("BT /F1 8 Tf 0.2 0.25 0.35 rg 310 546 Td (QTY) Tj ET")
    stream_ops.append("BT /F1 8 Tf 0.2 0.25 0.35 rg 360 546 Td (UNIT PRICE) Tj ET")
    stream_ops.append("BT /F1 8 Tf 0.2 0.25 0.35 rg 440 546 Td (TAX) Tj ET")
    stream_ops.append("BT /F1 8 Tf 0.2 0.25 0.35 rg 510 546 Td (TOTAL) Tj ET")

    # Line Items
    y = 520
    for idx, line in enumerate(invoice.lines):
        desc = line.description[:40]
        qty_str = str(line.quantity)
        uprice_str = f"{Decimal(str(line.unit_price)):.2f}"
        tax_str = f"{Decimal(str(line.tax_amount)):.2f}"
        total_str = f"{Decimal(str(line.line_total)):.2f}"

        # Alternate row background
        if idx % 2 == 1:
            stream_ops.append(f"q 0.98 0.98 0.99 rg 40 {y-4} 532 16 re f Q")

        stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 50 {y} Td ({_escape_pdf_text(desc)}) Tj ET")
        stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 315 {y} Td ({_escape_pdf_text(qty_str)}) Tj ET")
        stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 360 {y} Td ({_escape_pdf_text(uprice_str)}) Tj ET")
        stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 440 {y} Td ({_escape_pdf_text(tax_str)}) Tj ET")
        stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 510 {y} Td ({_escape_pdf_text(total_str)}) Tj ET")

        y -= 16
        if y < 220:
            break

    # Bottom Divider
    stream_ops.append(f"q 0.8 0.8 0.8 RG 1 w 40 {y} m 572 {y} l S Q")
    y -= 18

    # Summary Totals Block (Right aligned box)
    subtotal_str = f"{currency} {invoice.subtotal_amount:.2f}"
    discount_str = f"{currency} {invoice.discount_amount:.2f}"
    tax_str = f"{currency} {invoice.tax_amount:.2f}"
    rounding_str = f"{currency} {invoice.rounding_adjustment:.2f}"
    total_str = f"{currency} {invoice.total_amount:.2f}"
    paid_str = f"{currency} {invoice.amount_paid:.2f}"
    balance_str = f"{currency} {invoice.balance_due:.2f}"

    totals_y = y - 5
    stream_ops.append(f"BT /F2 8 Tf 0.4 0.4 0.4 rg 360 {totals_y} Td (Subtotal:) Tj ET")
    stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 480 {totals_y} Td ({_escape_pdf_text(subtotal_str)}) Tj ET")
    totals_y -= 14

    stream_ops.append(f"BT /F2 8 Tf 0.4 0.4 0.4 rg 360 {totals_y} Td (Discount:) Tj ET")
    stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 480 {totals_y} Td ({_escape_pdf_text(discount_str)}) Tj ET")
    totals_y -= 14

    stream_ops.append(f"BT /F2 8 Tf 0.4 0.4 0.4 rg 360 {totals_y} Td (Taxes:) Tj ET")
    stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 480 {totals_y} Td ({_escape_pdf_text(tax_str)}) Tj ET")
    totals_y -= 14

    stream_ops.append(f"BT /F2 8 Tf 0.4 0.4 0.4 rg 360 {totals_y} Td (Rounding Adjustment:) Tj ET")
    stream_ops.append(f"BT /F2 8 Tf 0.1 0.1 0.1 rg 480 {totals_y} Td ({_escape_pdf_text(rounding_str)}) Tj ET")
    totals_y -= 14

    # Total Amount Banner
    stream_ops.append(f"q 0.9 0.94 1 rg 350 {totals_y-3} 222 18 re f Q")
    stream_ops.append(f"BT /F1 9 Tf 0.1 0.2 0.5 rg 360 {totals_y+1} Td (TOTAL AMOUNT:) Tj ET")
    stream_ops.append(f"BT /F1 9 Tf 0.1 0.2 0.5 rg 480 {totals_y+1} Td ({_escape_pdf_text(total_str)}) Tj ET")
    totals_y -= 16

    stream_ops.append(f"BT /F2 8 Tf 0.1 0.6 0.2 rg 360 {totals_y} Td (Amount Paid:) Tj ET")
    stream_ops.append(f"BT /F2 8 Tf 0.1 0.6 0.2 rg 480 {totals_y} Td ({_escape_pdf_text(paid_str)}) Tj ET")
    totals_y -= 14

    stream_ops.append(f"q 0.99 0.92 0.92 rg 350 {totals_y-3} 222 18 re f Q")
    stream_ops.append(f"BT /F1 9 Tf 0.7 0.1 0.1 rg 360 {totals_y+1} Td (BALANCE DUE:) Tj ET")
    stream_ops.append(f"BT /F1 9 Tf 0.7 0.1 0.1 rg 480 {totals_y+1} Td ({_escape_pdf_text(balance_str)}) Tj ET")

    # Payment details / Notes on bottom left
    notes_y = y - 10
    stream_ops.append(f"BT /F1 8 Tf 0.2 0.2 0.2 rg 50 {notes_y} Td (PAYMENT INSTRUCTIONS & TERMS:) Tj ET")
    notes_y -= 12
    stream_ops.append(f"BT /F2 8 Tf 0.4 0.4 0.4 rg 50 {notes_y} Td (Please pay within the due date via Bank Transfer or UPI.) Tj ET")
    notes_y -= 12
    stream_ops.append(f"BT /F2 8 Tf 0.4 0.4 0.4 rg 50 {notes_y} Td (Currency: {currency} | Electronic generated invoice.) Tj ET")

    # Footer note
    stream_ops.append("q 0.9 0.9 0.9 RG 0.5 w 40 50 m 572 50 l S Q")
    stream_ops.append("BT /F2 7 Tf 0.5 0.5 0.5 rg 200 40 Td (Brightloop Subscription Management Platform - Verified Snapshot Document) Tj ET")

    content_stream = "\n".join(stream_ops).encode("latin1")

    # Build PDF Objects
    objects = []
    # 1: Catalog
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    # 2: Pages
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    # 3: Page
    objects.append(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> "
        b"/Contents 6 0 R >>"
    )
    # 4: Font F1 (Helvetica Bold)
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    # 5: Font F2 (Helvetica Regular)
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    # 6: Stream
    stream_header = f"<< /Length {len(content_stream)} >>\nstream\n".encode("ascii")
    stream_footer = b"\nendstream"
    objects.append(stream_header + content_stream + stream_footer)

    # Calculate xref
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = []
    for idx, obj in enumerate(objects):
        offsets.append(out.tell())
        out.write(f"{idx+1} 0 obj\n".encode("ascii"))
        out.write(obj)
        out.write(b"\nendobj\n")

    xref_offset = out.tell()
    out.write(b"xref\n")
    out.write(f"0 {len(objects) + 1}\n".encode("ascii"))
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode("ascii"))

    out.write(b"trailer\n")
    out.write(f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("ascii"))
    out.write(b"startxref\n")
    out.write(f"{xref_offset}\n".encode("ascii"))
    out.write(b"%%EOF\n")

    return out.getvalue()
