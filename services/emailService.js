const nodemailer = require('nodemailer');
const supabase = require('../config/db');
const { getEnv } = require('../config/env');

let transporter = null;

function createTransporter() {
  const smtpHost = getEnv('SMTP_HOST');
  const smtpUser = getEnv('SMTP_USER');
  const smtpPass = getEnv('SMTP_PASS');

  if (!smtpUser || !smtpPass) {
    console.warn('SMTP not configured — email sending disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    family: 4,
    tls: { rejectUnauthorized: false },
  });
  return transporter;
}

const FROM = getEnv('SMTP_FROM', 'noreply@gymsword.com');
const SITE_URL = getEnv('SITE_URL', 'http://localhost:3000');

async function logEmail(userId, type, recipient, subject, status, errorMessage = null) {
  try {
    await supabase.from('email_logs').insert({
      user_id: userId,
      email_type: type,
      recipient,
      subject,
      status,
      error_message: errorMessage,
    });
  } catch (e) {
    console.error('Failed to log email:', e.message);
  }
}

async function sendMail({ to, subject, html, userId, type, attachments }) {
  if (!transporter) createTransporter();
  if (!transporter) {
    await logEmail(userId, type, to, subject, 'failed', 'SMTP not configured');
    return;
  }

  for (const [port, secure] of [[587, false], [465, true]]) {
    try {
      const t = nodemailer.createTransport({
        host: getEnv('SMTP_HOST', 'smtp.gmail.com'),
        port,
        secure,
        auth: { user: getEnv('SMTP_USER'), pass: getEnv('SMTP_PASS') },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        family: 4,
        tls: { rejectUnauthorized: false },
      });

      const info = await t.sendMail({
        from: FROM,
        to,
        subject,
        html,
        attachments,
      });

      console.log(`Email (${type}) sent to ${to} via port ${port}:`, info.messageId);
      await logEmail(userId, type, to, subject, 'sent');
      return;
    } catch (err) {
      console.error(`Email (${type}) failed on port ${port}:`, err.message);
    }
  }

  await logEmail(userId, type, to, subject, 'failed', 'All ports exhausted');
}

const STYLES = {
  body: 'margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  container: 'background:#ffffff;max-width:600px;width:100%;margin:0 auto',
  header: 'padding:40px 40px 0',
  content: 'padding:0 40px',
  footer: 'padding:20px 40px 40px',
  h1: 'font-size:24px;font-weight:900;margin:0 0 8px;text-transform:uppercase;letter-spacing:-0.5px;color:#111',
  h2: 'font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#444;margin:0 0 12px',
  p: 'margin:0 0 16px;font-size:14px;color:#666;line-height:1.6',
  small: 'font-size:12px;color:#888;line-height:1.6',
  divider: 'border:none;border-top:1px solid #e5e5e5;margin:24px 0',
  thickDivider: 'border:none;border-top:2px solid #111;margin:24px 0',
  box: 'background:#f4f4f4;padding:24px;margin:0 0 20px',
  btn: 'display:inline-block;background:#111;color:#fff!important;text-decoration:none;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:14px 32px;border-radius:2px',
  tableHead: 'background:#111;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:1px;padding:10px 12px;text-align:left',
  tableCell: 'padding:12px;font-size:13px;color:#333;border-bottom:1px solid #e5e5e5',
};

function shell(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<style>
@media (prefers-color-scheme:dark){body,table,td{color:#e0e0e0!important}.container{background:#1a1a1a!important}.box{background:#2a2a2a!important}hr{border-color:#333!important}h1,h2,h3{color:#fff!important}p,td{color:#bbb!important}.btn{background:#fff!important;color:#111!important}a{color:#fff!important}}
</style>
</head>
<body style="${STYLES.body}">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" class="container" style="${STYLES.container}">
<tr><td style="${STYLES.header}">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#111;font-family:inherit;text-transform:uppercase">GYM<span style="color:#888">SWORD</span></td>
<td style="text-align:right;font-size:10px;color:#999">Forge Your Legacy</td>
</tr></table>
<hr style="${STYLES.thickDivider}">
</td></tr>
<tr><td style="${STYLES.content}">${body}</td></tr>
<tr><td style="${STYLES.footer}">
<hr style="${STYLES.divider}">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:13px;color:#555;line-height:1.8">
<strong style="color:#111">GymSword</strong> &mdash; Premium Gymwear<br>
<a href="${SITE_URL}" style="color:#111;text-decoration:none;font-weight:600">${SITE_URL}</a>
</td>
<td style="text-align:right;font-size:12px;color:#888">
<a href="${SITE_URL}/shop" style="color:#888;text-decoration:underline">Shop</a> &middot;
<a href="${SITE_URL}/contact" style="color:#888;text-decoration:underline">Contact</a>
</td>
</tr>
<tr><td colspan="2" style="padding-top:12px;font-size:12px;color:#999;line-height:1.6">
Need help? <a href="mailto:support@gymsword.com" style="color:#111;text-decoration:underline">support@gymsword.com</a><br>
&copy; ${new Date().getFullYear()} GymSword. All rights reserved.
</td></tr>
</table>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function minimalShell(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<style>
@media (prefers-color-scheme:dark){body{background:#1a1a1a!important}table{background:#1a1a1a!important}td{color:#e0e0e0!important}p{color:#bbb!important}div{background:#2a2a2a!important;border-color:#333!important}span{color:#fff!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff">
<tr><td style="padding:0 0 24px;border-bottom:1px solid #eee">
<span style="font-size:18px;font-weight:900;letter-spacing:-0.5px;color:#111">GymSword</span>
</td></tr>
<tr><td style="padding:24px 0">${body}</td></tr>
<tr><td style="padding:16px 0 0;border-top:1px solid #eee;font-size:11px;color:#999;line-height:1.6">
GymSword Team &mdash; <a href="mailto:support@gymsword.com" style="color:#777;text-decoration:underline">support@gymsword.com</a>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function verificationOTP(name, otp) {
  return minimalShell(`
    <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5">Hello ${name},</p>
    <div style="margin:0 0 20px">
      <span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">One-Time Password</span>
      <div style="font-size:36px;font-weight:900;color:#111;letter-spacing:5px">${otp}</div>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Use this OTP to complete your GymSword verification.</p>
    <div style="margin:0 0 20px;padding:14px 16px;background:#f8f8f8;border-radius:2px">
      <p style="margin:0 0 2px;font-size:13px;color:#777;line-height:1.5">This OTP will expire in <strong style="color:#555">10 minutes</strong>.</p>
      <p style="margin:0;font-size:13px;color:#777;line-height:1.5">Never share your OTP with anyone.</p>
    </div>
    <p style="margin:0;font-size:14px;color:#333">Regards,<br>GymSword Team</p>
  `);
}

function welcome(name) {
  return shell(`
    <h1 style="${STYLES.h1}">Welcome to GymSword</h1>
    <p style="${STYLES.p}">Hey ${name},</p>
    <p style="${STYLES.p}">Thank you for joining GymSword. You are now part of a community built on strength, discipline, and performance.</p>
    <div class="box" style="${STYLES.box}">
      <h3 style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;color:#111;letter-spacing:1px">Your Benefits</h3>
      <ul style="margin:0;padding:0 0 0 16px;font-size:13px;color:#555;line-height:2">
        <li>Earn rewards with every purchase</li>
        <li>Refer friends and get bonus coins</li>
        <li>Early access to new drops</li>
        <li>Exclusive member-only offers</li>
      </ul>
    </div>
    <table cellpadding="0" cellspacing="0"><tr><td><a href="${SITE_URL}/shop" class="btn" style="${STYLES.btn}">Start Shopping</a></td></tr></table>
    <p style="margin:20px 0 0;font-size:13px;color:#888;line-height:1.6">Forge your legacy.<br><strong>The GymSword Team</strong></p>
  `);
}

function forgotPasswordOTP(name, otp) {
  return minimalShell(`
    <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5">Hello ${name},</p>
    <div style="margin:0 0 20px">
      <span style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">One-Time Password</span>
      <div style="font-size:36px;font-weight:900;color:#111;letter-spacing:5px">${otp}</div>
    </div>
    <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6">Use this OTP to reset your GymSword password.</p>
    <div style="margin:0 0 20px;padding:14px 16px;background:#f8f8f8;border-radius:2px">
      <p style="margin:0 0 2px;font-size:13px;color:#777;line-height:1.5">This OTP will expire in <strong style="color:#555">10 minutes</strong>.</p>
      <p style="margin:0;font-size:13px;color:#777;line-height:1.5">If you didn't request this, please ignore this email.</p>
    </div>
    <p style="margin:0;font-size:14px;color:#333">Regards,<br>GymSword Team</p>
  `);
}

function loginNotification(name, time, device, browser, ip) {
  return minimalShell(`
    <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.5">Hello ${name},</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6">A new sign-in was detected on your GymSword account.</p>
    <div style="margin:0 0 20px;padding:14px 16px;background:#f8f8f8;border-radius:2px;font-size:13px;color:#555;line-height:1.8">
      <strong style="color:#333">Time:</strong> ${time}<br>
      <strong style="color:#333">Device:</strong> ${device || 'Unknown'}<br>
      <strong style="color:#333">Browser:</strong> ${browser || 'Unknown'}<br>
      <strong style="color:#333">IP Address:</strong> ${ip || 'Unknown'}
    </div>
    <p style="margin:0 0 16px;font-size:13px;color:#777;line-height:1.5">If this was you, ignore this alert. If not, please secure your account immediately.</p>
    <table cellpadding="0" cellspacing="0"><tr><td><a href="${SITE_URL}/account/settings" class="btn" style="display:inline-block;background:#111;color:#fff!important;text-decoration:none;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:12px 28px;border-radius:2px">Secure Account</a></td></tr></table>
    <p style="margin:16px 0 0;font-size:14px;color:#333">Regards,<br>GymSword Team</p>
  `);
}

function orderConfirmation(name, order, items) {
  const itemsHtml = items.map((i, idx) => `
    <tr${idx % 2 === 1 ? ' style="background:#f9f9f9"' : ''}>
      <td style="${STYLES.tableCell}">
        <table cellpadding="0" cellspacing="0"><tr>
          ${i.image_url ? `<td width="48" style="padding-right:10px"><img src="${i.image_url}" width="48" height="48" style="display:block;object-fit:cover;background:#f4f4f4;border-radius:2px" alt="${i.name}"></td>` : ''}
          <td><strong style="font-size:13px;color:#111">${i.name}</strong></td>
        </tr></table>
      </td>
      <td style="${STYLES.tableCell};text-align:center">${i.quantity}</td>
      <td style="${STYLES.tableCell};text-align:right;font-weight:700">₹${(i.price * i.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  return shell(`
    <h1 style="${STYLES.h1}">Order Confirmed</h1>
    <p style="${STYLES.p}">Hey ${name},</p>
    <p style="${STYLES.p}">Thank you for your order! Your order has been confirmed and is being processed.</p>

    <div class="box" style="${STYLES.box}">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#333;line-height:1.8">
        <tr><td style="color:#888;width:80px">Order ID</td><td style="font-weight:700">#${order.order_number || order.id}</td></tr>
        <tr><td style="color:#888">Date</td><td>${new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
        ${order.estimated_delivery ? `<tr><td style="color:#888">Est. Delivery</td><td>${new Date(order.estimated_delivery).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>` : ''}
      </table>
    </div>

    <h2 style="${STYLES.h2}">Order Summary</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">
      <thead><tr>
        <th style="${STYLES.tableHead}">Item</th>
        <th style="${STYLES.tableHead};text-align:center;width:40px">Qty</th>
        <th style="${STYLES.tableHead};text-align:right;width:80px">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <hr style="${STYLES.divider}">

    <table cellpadding="0" cellspacing="0"><tr><td><a href="${SITE_URL}/track-order/${order.id}" class="btn" style="${STYLES.btn}">Track My Order</a></td></tr></table>
    <p style="margin:12px 0 0;font-size:13px;color:#888">Need help? <a href="mailto:support@gymsword.com" style="color:#111;font-weight:600;text-decoration:underline">support@gymsword.com</a></p>
  `);
}

function shippingStatus(name, order, status, items) {
  const statusLabels = {
    pending: 'Order Placed', confirmed: 'Confirmed', processing: 'Packed',
    shipped: 'Shipped', out_for_delivery: 'Out For Delivery', delivered: 'Delivered',
    cancelled: 'Cancelled', returned: 'Returned',
  };
  const label = statusLabels[status] || status;

  return shell(`
    <h1 style="${STYLES.h1}">${label}</h1>
    <p style="${STYLES.p}">Hey ${name},</p>
    <p style="${STYLES.p}">Your order status has been updated to <strong>${label}</strong>.</p>

    <div class="box" style="${STYLES.box}">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#333;line-height:1.8">
        <tr><td style="color:#888;width:100px">Order ID</td><td style="font-weight:700">#${order.order_number || order.id}</td></tr>
        <tr><td style="color:#888">Status</td><td style="font-weight:700">${label}</td></tr>
        ${order.tracking_number ? `<tr><td style="color:#888">Tracking No.</td><td>${order.tracking_number}</td></tr>` : ''}
        ${order.estimated_delivery ? `<tr><td style="color:#888">Est. Delivery</td><td>${new Date(order.estimated_delivery).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>` : ''}
      </table>
    </div>

    <hr style="${STYLES.divider}">
    <table cellpadding="0" cellspacing="0"><tr><td><a href="${SITE_URL}/track-order/${order.id}" class="btn" style="${STYLES.btn}">Track My Order</a></td></tr></table>
  `);
}

async function sendVerificationOTP(user, otp) {
  await sendMail({ to: user.email, subject: 'GymSword Login OTP', html: verificationOTP(user.name, otp), userId: user.id, type: 'email_verification' });
}

async function sendWelcomeEmail(user) {
  await sendMail({ to: user.email, subject: 'Welcome to GymSword', html: welcome(user.name), userId: user.id, type: 'welcome' });
}

async function sendForgotPasswordOTP(user, otp) {
  await sendMail({ to: user.email, subject: 'GymSword Password Reset OTP', html: forgotPasswordOTP(user.name, otp), userId: user.id, type: 'forgot_password' });
}

async function sendLoginNotification(user, details) {
  await sendMail({ to: user.email, subject: 'New Login Detected - GymSword', html: loginNotification(user.name, details.time, details.device, details.browser, details.ip), userId: user.id, type: 'login_notification' });
}

async function sendLoginOTP(user, otp) {
  await sendMail({ to: user.email, subject: 'GymSword Login Verification Code', html: verificationOTP(user.name, otp), userId: user.id, type: 'login_otp' });
}

async function sendOrderConfirmation(user, order, items, invoicePath) {
  const attachments = invoicePath ? [{ filename: `invoice-${order.id}.pdf`, path: invoicePath }] : [];
  await sendMail({
    to: user.email,
    subject: `Order Confirmed - #${order.order_number || order.id}`,
    html: orderConfirmation(user.name, order, items),
    userId: user.id,
    type: 'order_confirmation',
    attachments,
  });
}

async function sendShippingStatus(user, order, status, items) {
  const statusLabels = {
    pending: 'Placed', confirmed: 'Confirmed', processing: 'Packed',
    shipped: 'Shipped', out_for_delivery: 'Out For Delivery', delivered: 'Delivered',
    cancelled: 'Cancelled', returned: 'Returned',
  };
  await sendMail({
    to: user.email,
    subject: `Order ${statusLabels[status] || status} - #${order.order_number || order.id}`,
    html: shippingStatus(user.name, order, status, items),
    userId: user.id,
    type: `shipping_${status}`,
  });
}

module.exports = {
  sendVerificationOTP,
  sendWelcomeEmail,
  sendForgotPasswordOTP,
  sendLoginNotification,
  sendLoginOTP,
  sendOrderConfirmation,
  sendShippingStatus,
};
