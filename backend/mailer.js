const crypto = require('crypto');

const nodemailer = require('nodemailer');

const { getRuntimeSettings } = require('./runtime-settings');

const isProduction = process.env.NODE_ENV === 'production';
const FALLBACK_STORE_NAME = 'Asteria Luxury House';
const SMTP_CONNECTION_TIMEOUT_MS = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000);
const SMTP_GREETING_TIMEOUT_MS = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 10000);
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 15000);
const MAIL_SEND_TIMEOUT_MS = Number(process.env.MAIL_SEND_TIMEOUT_MS || 15000);

let cachedMailer = null;
let cachedMailerKey = '';
let currentMailMode = isProduction ? 'disabled' : 'preview';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const extractEmailAddress = (value) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '';
  }

  const match = normalized.match(/<([^>]+)>/);
  return (match ? match[1] : normalized).trim();
};

const buildMailbox = (displayName, value) => {
  const emailAddress = extractEmailAddress(value);
  return emailAddress ? `${displayName} <${emailAddress}>` : '';
};

const resolveMailMode = (settings) => {
  const hasSmtpConfig = Boolean(
    settings?.email?.smtpHost &&
      settings?.email?.smtpPort &&
      settings?.email?.smtpUser &&
      settings?.email?.smtpPass,
  );

  if (hasSmtpConfig) {
    return 'smtp';
  }

  return isProduction ? 'disabled' : 'preview';
};

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const getMailMode = async () => {
  const settings = await getRuntimeSettings();
  return resolveMailMode(settings);
};

const getPublicSiteUrl = async () => {
  const settings = await getRuntimeSettings();
  return settings.email.appBaseUrl;
};

const getBrandContext = (settings) => {
  const storeName = String(settings?.brand?.storeName || FALLBACK_STORE_NAME).trim() || FALLBACK_STORE_NAME;
  const supportEmail = extractEmailAddress(
    settings?.brand?.supportEmail || settings?.email?.supportEmail || '',
  );
  const senderEmail = extractEmailAddress(
    settings?.email?.smtpFromEmail || settings?.email?.smtpUser || supportEmail || '',
  );

  return {
    senderEmail,
    storeName,
    supportEmail,
  };
};

const buildBrandedSubject = (subject, settings) => {
  const { storeName } = getBrandContext(settings);
  return String(subject || '').startsWith(`${storeName} | `)
    ? String(subject || '')
    : `${storeName} | ${subject}`;
};

const buildBrandedHtml = ({ bodyHtml, settings }) => {
  const { storeName, supportEmail } = getBrandContext(settings);
  const supportMarkup = supportEmail
    ? `
        <p style="margin:8px 0 0;">
          Need help? Reply to
          <a href="mailto:${escapeHtml(supportEmail)}" style="color:#7b0c63;text-decoration:none;">
            ${escapeHtml(supportEmail)}
          </a>
        </p>
      `
    : '';

  return `
    <div style="margin:0;padding:24px;background:#f6f1f5;font-family:Arial,sans-serif;color:#201713;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(17,10,18,0.08);">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#4e0543 0%,#7b0c63 100%);color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.78;">
            Client services
          </p>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">
            ${escapeHtml(storeName)}
          </h1>
        </div>
        <div style="padding:28px;">${bodyHtml}</div>
        <div style="padding:18px 28px;border-top:1px solid #eee7ef;background:#fcfafc;color:#6f6470;font-size:13px;line-height:1.6;">
          <p style="margin:0;">Sent by ${escapeHtml(storeName)}</p>
          ${supportMarkup}
        </div>
      </div>
    </div>
  `;
};

const buildBrandedText = ({ settings, subject, text }) => {
  const { storeName, supportEmail } = getBrandContext(settings);
  let output = `${storeName}\n${subject}\n\n${String(text || '').trim()}`;

  if (supportEmail) {
    output += `\n\nSupport: ${supportEmail}`;
  }

  return output.trim();
};

const buildMailerKey = (settings, mode) =>
  crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        from: settings.email.smtpFromEmail,
        host: settings.email.smtpHost,
        mode,
        port: settings.email.smtpPort,
        secure: settings.email.smtpSecure,
        supportEmail: settings.email.supportEmail,
        user: settings.email.smtpUser,
      }),
    )
    .digest('hex');

const createPreviewMailer = async () => {
  const testAccount = await nodemailer.createTestAccount();

  return {
    mode: 'preview',
    transporter: nodemailer.createTransport({
      auth: {
        pass: testAccount.pass,
        user: testAccount.user,
      },
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      dnsTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    }),
  };
};

const createMailer = async (settings) => {
  const resolvedMode = resolveMailMode(settings);

  if (resolvedMode === 'smtp') {
    currentMailMode = 'smtp';
    return {
      mode: 'smtp',
      transporter: nodemailer.createTransport({
        auth: {
          pass: settings.email.smtpPass,
          user: settings.email.smtpUser,
        },
        connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        dnsTimeout: SMTP_CONNECTION_TIMEOUT_MS,
        greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
        host: settings.email.smtpHost,
        port: Number(settings.email.smtpPort),
        secure:
          Boolean(settings.email.smtpSecure) || Number(settings.email.smtpPort) === 465,
        socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
      }),
    };
  }

  if (resolvedMode === 'disabled') {
    currentMailMode = 'disabled';
    return {
      initError: 'Email delivery is not configured in production.',
      mode: 'disabled',
      transporter: null,
    };
  }

  try {
    const previewMailer = await createPreviewMailer();
    currentMailMode = previewMailer.mode;
    return previewMailer;
  } catch (error) {
    currentMailMode = 'disabled';
    console.warn('Preview email setup failed. Email delivery is disabled.', error);

    return {
      initError: error.message || 'Preview email setup failed.',
      mode: 'disabled',
      transporter: null,
    };
  }
};

const getMailer = async (settings) => {
  const mode = await getMailMode();
  const key = buildMailerKey(settings, mode);

  if (cachedMailer && cachedMailerKey === key) {
    return cachedMailer;
  }

  cachedMailer = await createMailer(settings);
  cachedMailerKey = key;
  return cachedMailer;
};

const formatMoney = (value, settings) =>
  new Intl.NumberFormat(settings.payments.locale || 'en-NG', {
    currency: settings.payments.currency || 'NGN',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0));

const sendMail = async ({ html, subject, text, to }) => {
  const settings = await getRuntimeSettings();
  const mailer = await getMailer(settings);
  const { senderEmail, storeName, supportEmail } = getBrandContext(settings);
  const brandedSubject = buildBrandedSubject(subject, settings);
  const mailFrom =
    buildMailbox(storeName, senderEmail || supportEmail) ||
    `${FALLBACK_STORE_NAME} <no-reply@asterialuxury.test>`;
  const replyTo = supportEmail ? buildMailbox(`${storeName} Support`, supportEmail) : undefined;
  const brandedHtml = buildBrandedHtml({ bodyHtml: html, settings });
  const brandedText = buildBrandedText({ settings, subject: brandedSubject, text });

  if (!mailer.transporter) {
    console.log(`Mail not sent because email delivery is disabled. Subject: ${subject} To: ${to}`);
    return {
      delivered: false,
      error: mailer.initError || 'Email delivery is disabled.',
      mode: mailer.mode,
      previewUrl: null,
    };
  }

  try {
    const info = await withTimeout(
      mailer.transporter.sendMail({
        from: mailFrom,
        html: brandedHtml,
        replyTo,
        subject: brandedSubject,
        text: brandedText,
        to,
      }),
      MAIL_SEND_TIMEOUT_MS,
      'Mail delivery timed out.',
    );

    const previewUrl = mailer.mode === 'preview' ? nodemailer.getTestMessageUrl(info) : null;

    if (previewUrl) {
      console.log(`Preview email for ${to}: ${previewUrl}`);
    }

    return {
      delivered: true,
      messageId: info.messageId,
      mode: mailer.mode,
      previewUrl,
    };
  } catch (error) {
    console.error(`Mail delivery failed for ${to}:`, error);

    return {
      delivered: false,
      error: error.message || 'Mail delivery failed.',
      mode: mailer.mode,
      previewUrl: null,
    };
  }
};

const sendVerificationEmail = async ({ email, fullName, token }) => {
  const publicSiteUrl = await getPublicSiteUrl();
  const verificationUrl = `${publicSiteUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const delivery = await sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>Verify your email</h2>
        <p>Hello ${fullName},</p>
        <p>Confirm your account to unlock account updates and order tracking.</p>
        <p>
          <a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;background:#1f1713;color:#ffffff;text-decoration:none;border-radius:999px;">
            Verify email
          </a>
        </p>
        <p>If the button does not work, open this link:</p>
        <p>${verificationUrl}</p>
      </div>
    `,
    subject: 'Verify your account',
    text: `Verify your account by opening ${verificationUrl}`,
    to: email,
  });

  return {
    delivery,
    verificationUrl,
  };
};

const sendPasswordResetEmail = async ({ email, fullName, token }) => {
  const publicSiteUrl = await getPublicSiteUrl();
  const resetUrl = `${publicSiteUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const delivery = await sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>Reset your password</h2>
        <p>Hello ${fullName},</p>
        <p>We received a request to reset the password for your Asteria account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#1f1713;color:#ffffff;text-decoration:none;border-radius:999px;">
            Create a new password
          </a>
        </p>
        <p>This link expires soon for your security. If you did not request this change, you can ignore this email.</p>
        <p>If the button does not work, open this link:</p>
        <p>${resetUrl}</p>
      </div>
    `,
    subject: 'Reset your password',
    text: `Reset your password by opening ${resetUrl}`,
    to: email,
  });

  return {
    delivery,
    resetUrl,
  };
};

const sendOrderConfirmationEmail = async ({ items, order }) => {
  const settings = await getRuntimeSettings();

  return sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>Your order ${order.orderNumber} is confirmed</h2>
        <p>Hello ${order.customerName},</p>
        <p>We have received your order for ${items.length} item(s).</p>
        <p>
          Payment method:
          <strong>${order.paymentMethod === 'paystack' ? 'Paystack' : 'Bank transfer'}</strong>
        </p>
        <ul>
          ${items
            .map(
              (item) =>
                `<li>${item.quantity} x ${item.name} - ${formatMoney(item.lineTotal, settings)}</li>`,
            )
            .join('')}
        </ul>
        <p>Total: <strong>${formatMoney(order.total, settings)}</strong></p>
        <p>Shipping to: ${order.shippingAddress}, ${order.shippingCity}, ${order.shippingCountry}</p>
      </div>
    `,
    subject: `Order confirmation ${order.orderNumber}`,
    text: `Your order ${order.orderNumber} is confirmed. Total: ${formatMoney(order.total, settings)}`,
    to: order.customerEmail,
  });
};

const sendBankTransferSubmissionEmail = async ({ order }) => {
  const settings = await getRuntimeSettings();

  return sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>We received your bank transfer proof</h2>
        <p>Hello ${order.customerName},</p>
        <p>Your order <strong>${order.orderNumber}</strong> is now awaiting payment review.</p>
        <p>Our team will confirm the transfer and update your order status as soon as possible.</p>
        <p>Total submitted: <strong>${formatMoney(order.total, settings)}</strong></p>
      </div>
    `,
    subject: `Bank transfer received for ${order.orderNumber}`,
    text: `We received your bank transfer proof for ${order.orderNumber}. Our team will review it shortly.`,
    to: order.customerEmail,
  });
};

const sendBankTransferNotificationEmail = async ({ items, order, proofUrl }) => {
  const settings = await getRuntimeSettings();
  const supportEmail = settings.brand.supportEmail || settings.email.supportEmail;

  if (!supportEmail) {
    return {
      delivered: false,
      mode: 'disabled',
      previewUrl: null,
    };
  }

  return sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>New bank transfer proof submitted</h2>
        <p><strong>Order:</strong> ${order.orderNumber}</p>
        <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
        <p><strong>Total:</strong> ${formatMoney(order.total, settings)}</p>
        <p><strong>Proof file:</strong> <a href="${proofUrl}">${proofUrl}</a></p>
        <ul>
          ${items
            .map(
              (item) =>
                `<li>${item.quantity} x ${item.name} - ${formatMoney(item.lineTotal, settings)}</li>`,
            )
            .join('')}
        </ul>
      </div>
    `,
    subject: `Bank transfer proof: ${order.orderNumber}`,
    text: `A new bank transfer proof was submitted for ${order.orderNumber}. Proof: ${proofUrl}`,
    to: supportEmail,
  });
};

const sendNewsletterConfirmationEmail = async ({ email, fullName }) =>
  sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>You are subscribed</h2>
        <p>${fullName || 'Hello'},</p>
        <p>You will now receive product updates, launches, and store news.</p>
      </div>
    `,
    subject: 'You are subscribed to updates',
    text: 'You are now subscribed to store updates.',
    to: email,
  });

const sendContactAcknowledgementEmail = async ({ email, fullName, subject }) =>
  sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>We received your message</h2>
        <p>Hello ${fullName},</p>
        <p>Thanks for contacting us about "${subject}".</p>
        <p>Our team will reply as soon as possible.</p>
      </div>
    `,
    subject: 'We received your message',
    text: `We received your message about "${subject}".`,
    to: email,
  });

const sendContactNotificationEmail = async ({ email, fullName, message, subject }) => {
  const settings = await getRuntimeSettings();
  const supportEmail = settings.brand.supportEmail || settings.email.supportEmail;

  if (!supportEmail) {
    return {
      delivered: false,
      mode: 'disabled',
      previewUrl: null,
    };
  }

  return sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>New contact request</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      </div>
    `,
    subject: `New contact message: ${subject}`,
    text: `New contact message from ${fullName} (${email})\n\n${message}`,
    to: supportEmail,
  });
};

const sendManualCustomerEmail = async ({ email, message, subject }) =>
  sendMail({
    html: `
      <div style="font-family: Arial, sans-serif; color: #201713; line-height: 1.6;">
        <h2>${subject}</h2>
        <p>${String(message || '').replace(/\n/g, '<br />')}</p>
      </div>
    `,
    subject,
    text: message,
    to: email,
  });

module.exports = {
  getMailMode,
  getPublicSiteUrl,
  sendBankTransferNotificationEmail,
  sendBankTransferSubmissionEmail,
  sendContactAcknowledgementEmail,
  sendContactNotificationEmail,
  sendManualCustomerEmail,
  sendNewsletterConfirmationEmail,
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
};
