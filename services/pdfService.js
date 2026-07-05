const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

async function generateInvoice(order, items, user) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(TEMP_DIR, `invoice-${order.id}.pdf`);
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const pageW = doc.page.width - 80;
    let y = 40;

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(32).font('Helvetica-Bold').fillColor('#111').text('GYM', { continued: true });
    doc.font('Helvetica').fillColor('#888').text('SWORD');
    doc.fillColor('#111').fontSize(9).font('Helvetica')
      .text('Forge Your Legacy', 40, y + 38, { continued: true })
      .fillColor('#888')
      .text('  |  GST: 00ABCDE1234F1Z5', { continued: false });

    // Invoice title right side
    const invNum = order.order_number || `GS-${String(order.id).padStart(6, '0')}`;
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#111')
      .text('INVOICE', pageW + 10, y, { width: pageW - 10, align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#888')
      .text(`# ${invNum}`, pageW + 10, y + 22, { width: pageW - 10, align: 'right' })
      .text(`Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW + 10, y + 35, { width: pageW - 10, align: 'right' });

    y += 60;

    // ── Divider ─────────────────────────────────────────────
    doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#111').lineWidth(2).stroke();
    y += 20;

    // ── Billing & Shipping ──────────────────────────────────
    const addr = order.address || '';
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111').text('BILLED TO', 40, y);
    doc.fontSize(9).font('Helvetica').fillColor('#555');
    let by = y + 16;
    doc.text(user.name, 40, by);
    doc.text(user.email, 40, by + 14);
    if (addr) {
      const lines = addr.split('\n');
      lines.forEach((l, i) => doc.text(l, 40, by + 28 + i * 13));
    }

    if (order.shipping_address && order.shipping_address !== addr) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#111').text('SHIPPED TO', pageW / 2 + 40, y);
      doc.fontSize(9).font('Helvetica').fillColor('#555');
      const slines = order.shipping_address.split('\n');
      slines.forEach((l, i) => doc.text(l, pageW / 2 + 40, by + i * 13));
    }

    const addrBlockH = Math.max(
      60,
      (addr ? addr.split('\n').length * 13 + 28 : 40) + 14
    );
    y += addrBlockH;

    // ── Table Header ────────────────────────────────────────
    const colX = { item: 40, hsn: 220, qty: 300, price: 350, total: 420 };
    const colW = { item: 180, hsn: 80, qty: 50, price: 70, total: 70 };

    doc.rect(40, y, pageW, 22).fillColor('#111').fill();
    doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
    doc.text('ITEM', colX.item + 6, y + 6);
    doc.text('HSN/SKU', colX.hsn + 6, y + 6, { width: colW.hsn - 12 });
    doc.text('QTY', colX.qty, y + 6, { width: colW.qty, align: 'center' });
    doc.text('PRICE', colX.price, y + 6, { width: colW.price, align: 'right' });
    doc.text('TOTAL', colX.total, y + 6, { width: colW.total, align: 'right' });

    y += 28;

    // ── Table Rows ──────────────────────────────────────────
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    let rowNum = 0;
    for (const item of items) {
      const price = parseFloat(item.price) || 0;
      const qty = item.quantity || 1;
      const total = price * qty;

      if (rowNum % 2 === 1) {
        doc.rect(40, y - 4, pageW, item.name.length > 40 ? 32 : 22).fillColor('#f9f9f9').fill();
      }

      doc.fillColor('#333');
      doc.font('Helvetica-Bold').text(item.name || 'Product', colX.item + 6, y, { width: colW.item - 12 });
      doc.font('Helvetica').fillColor('#888').text('-', colX.hsn + 6, y, { width: colW.hsn - 12 });
      doc.fillColor('#333').text(String(qty), colX.qty, y, { width: colW.qty, align: 'center' });
      doc.text(`₹${price.toFixed(2)}`, colX.price, y, { width: colW.price, align: 'right' });
      doc.font('Helvetica-Bold').text(`₹${total.toFixed(2)}`, colX.total, y, { width: colW.total, align: 'right' });

      y += item.name.length > 40 ? 28 : 22;
      rowNum++;
    }

    // ── Totals ──────────────────────────────────────────────
    y += 10;
    const subtotal = items.reduce((s, i) => s + parseFloat(i.price) * (i.quantity || 1), 0);
    const discount = parseFloat(order.discount_amount) || 0;
    const shipping = parseFloat(order.shipping) || 0;
    const tax = parseFloat(order.tax) || 0;
    const total = parseFloat(order.total_amount) || 0;

    const tx = pageW - 180;
    const tColW = 80;

    doc.fontSize(9).font('Helvetica').fillColor('#555');
    const lines2 = [
      { label: 'Subtotal', value: subtotal },
      ...(discount > 0 ? [{ label: `Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}`, value: -discount, color: '#4ade80' }] : []),
      { label: 'Shipping', value: shipping === 0 ? 'FREE' : shipping },
      { label: 'Tax (GST 18%)', value: tax },
    ];

    for (const l of lines2) {
      doc.fillColor(l.color || '#555').text(l.label, tx, y, { width: tColW });
      const val = typeof l.value === 'string' ? l.value : `₹${Math.abs(l.value).toFixed(2)}`;
      doc.text(val, tx + tColW, y, { width: tColW, align: 'right' });
      y += 16;
    }

    // Grand Total
    doc.moveTo(tx, y).lineTo(doc.page.width - 40, y).strokeColor('#111').lineWidth(1).stroke();
    y += 8;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111');
    doc.text('TOTAL', tx, y, { width: tColW });
    doc.text(`₹${total.toFixed(2)}`, tx + tColW, y, { width: tColW, align: 'right' });
    y += 20;

    // Savings note
    if (discount > 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#4ade80')
        .text(`You saved ₹${discount.toFixed(2)} on this order`, tx, y, { width: tColW * 2, align: 'right' });
      y += 20;
    }

    // ── Payment Info ────────────────────────────────────────
    if (order.payment_method) {
      y += 10;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#111').text('PAYMENT', 40, y);
      doc.fontSize(9).font('Helvetica').fillColor('#555');
      y += 16;
      doc.text(`Method: ${order.payment_method}`, 40, y);
      if (order.razorpay_payment_id) doc.text(`Transaction ID: ${order.razorpay_payment_id}`, 40, y + 14);
      if (order.payment_status) doc.text(`Status: ${order.payment_status}`, 40, y + 28);
    }

    // ── Footer ──────────────────────────────────────────────
    const bottomY = doc.page.height - 70;
    doc.moveTo(40, bottomY - 10).lineTo(doc.page.width - 40, bottomY - 10).strokeColor('#e5e5e5').lineWidth(1).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#888');
    doc.text('Thank you for shopping with GymSword', 40, bottomY + 4, { align: 'center' });
    doc.text(`Invoice generated on ${new Date().toLocaleString('en-IN')}  |  For queries: support@gymsword.com`, 40, bottomY + 14, { align: 'center' });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = { generateInvoice };
