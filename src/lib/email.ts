import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// ---------------------------------------------------------------------------
// Transporter — created lazily per process (or serverless invocation)
// ---------------------------------------------------------------------------

function createTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || !Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP configuration is incomplete or invalid.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // port 587 uses explicit STARTTLS, not implicit TLS
    requireTLS: true, // abort connection if STARTTLS upgrade is unavailable
    auth: { user, pass },
    // Never log credentials, headers, or OTP codes
    logger: false,
    debug: false,
  });
}

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!_transporter) {
    _transporter = createTransporter();
  }
  return _transporter;
}

/**
 * Resets the cached transporter (for unit testing only).
 */
export function _resetTransporterForTest(): void {
  _transporter = null;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildOtpEmailHtml(otp: string): string {
  const safeOtp = otp.replace(/[^0-9]/g, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Khoj verification code</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#111827;padding:28px 40px;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Khoj
              </p>
              <p style="margin:4px 0 0;font-size:13px;color:#9ca3af;">
                Find it. Sell it. Reclaim it.
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;">
                Your verification code
              </h1>
              <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.6;">
                Use the code below to sign in to Khoj. It expires in
                <strong>5&nbsp;minutes</strong> and can only be used once.
              </p>
              <!-- OTP box -->
              <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">
                  Verification code
                </p>
                <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:12px;color:#111827;font-variant-numeric:tabular-nums;">
                  ${safeOtp}
                </p>
              </div>
              <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.6;">
                If you did not request this code, you can safely ignore this email.
                Someone may have entered your email by mistake.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Khoj &mdash; Community Marketplace &amp; Lost &amp; Found
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailText(otp: string): string {
  const safeOtp = otp.replace(/[^0-9]/g, "");
  return [
    "KHOJ — YOUR VERIFICATION CODE",
    "",
    `Code: ${safeOtp}`,
    "",
    "This code expires in 5 minutes and can only be used once.",
    "",
    "If you did not request this code, please ignore this email.",
    "",
    "— The Khoj Team",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a 6-digit OTP to the given email address.
 *
 * Security notes:
 * - `otp` and SMTP credentials are never logged or included in thrown errors.
 * - Rejects with a sanitized error message if delivery fails.
 */
export async function sendOtpEmail(
  email: string,
  otp: string
): Promise<void> {
  const fromAddress = process.env.EMAIL_FROM ?? process.env.SMTP_USER;
  if (!fromAddress) {
    throw new Error("Sender email address is not configured.");
  }

  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: `"Khoj" <${fromAddress}>`,
      to: email,
      subject: "Your Khoj verification code",
      text: buildOtpEmailText(otp),
      html: buildOtpEmailHtml(otp),
    });
  } catch {
    // Throw a sanitized error so upstream handlers/logs never leak SMTP credentials or OTP
    throw new Error("Failed to send verification email.");
  }
}

/**
 * Verifies SMTP connectivity without sending an email.
 * Intended for manual verification only — never called automatically.
 * Returns true on success, false on failure without exposing credentials.
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
