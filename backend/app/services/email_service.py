import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger("app.services.email")


def send_interview_email(
    *,
    to_email: str,
    candidate_name: str,
    job_title: str,
    department: str,
    interview_token: str,
    expires_at: datetime,
) -> bool:
    """
    Send interview invitation email via SMTP.
    Returns True on success, False on failure.
    """
    settings = get_settings()
    smtp_from_email = settings.smtp_from_email or settings.smtp_user

    if not settings.smtp_user or not settings.smtp_password:
        logger.error("[EMAIL] SMTP credentials missing. Check SMTP_USER and SMTP_PASSWORD.")
        return False
    if not smtp_from_email:
        logger.error("[EMAIL] SMTP sender missing. Check SMTP_FROM_EMAIL or SMTP_USER.")
        return False

    try:
        interview_link = f"{settings.frontend_url}/interview/{interview_token}"
        expires_str = expires_at.strftime("%b %d, %Y at %I:%M %p")

        html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:#111111;padding:18px 28px;">
              <span style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:3px;">Smart Hiring</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <p style="font-size:11px;font-weight:600;color:#aaaaaa;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px 0;">
                Interview Invitation
              </p>
              <h1 style="font-size:24px;font-weight:700;color:#111111;margin:0 0 20px 0;line-height:1.3;">
                You've been shortlisted!
              </h1>
              <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 8px 0;">
                Hi <strong style="color:#111111;">{candidate_name}</strong>,
              </p>
              <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 24px 0;">
                Congratulations! You have been shortlisted for
                <strong style="color:#111111;">{job_title}</strong>
                at
                <strong style="color:#111111;">{settings.company_name}</strong>.
                Please complete the online interview at your earliest convenience.
              </p>
              <table width="100%" style="background:#f8f8f8;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="font-size:10px;font-weight:600;color:#aaaaaa;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 14px 0;">
                      Interview Details
                    </p>
                    <table width="100%">
                      <tr>
                        <td width="50%" style="padding-bottom:10px;">
                          <div style="font-size:10px;color:#aaaaaa;margin-bottom:3px;">Position</div>
                          <div style="font-size:13px;font-weight:600;color:#111111;">{job_title}</div>
                        </td>
                        <td width="50%" style="padding-bottom:10px;">
                          <div style="font-size:10px;color:#aaaaaa;margin-bottom:3px;">Department</div>
                          <div style="font-size:13px;font-weight:600;color:#111111;">{department or 'General'}</div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%">
                          <div style="font-size:10px;color:#aaaaaa;margin-bottom:3px;">Questions</div>
                          <div style="font-size:13px;font-weight:600;color:#111111;">10 questions</div>
                        </td>
                        <td width="50%">
                          <div style="font-size:10px;color:#aaaaaa;margin-bottom:3px;">Link expires</div>
                          <div style="font-size:13px;font-weight:600;color:#111111;">{expires_str}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="{interview_link}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                      Start Interview &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="font-size:11px;font-weight:700;color:#92400e;margin:0 0 8px 0;">Before you begin</p>
                    <ul style="font-size:12.5px;color:#92400e;margin:0;padding-left:16px;line-height:1.8;">
                      <li>Ensure your camera and microphone are working</li>
                      <li>Use a stable internet connection</li>
                      <li>Find a quiet, well-lit environment</li>
                      <li>This link can only be used <strong>once</strong> — do not share it</li>
                      <li>Complete the interview in one session</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <p style="font-size:12px;color:#aaaaaa;line-height:1.6;margin:0 0 4px 0;">
                For issues contact:
                <span style="color:#111111;">{smtp_from_email}</span>
              </p>
              <p style="font-size:11px;color:#aaaaaa;line-height:1.6;margin:0 0 4px 0;">
                Add {smtp_from_email} to your contacts to ensure delivery.
              </p>
              <p style="font-size:11px;color:#cccccc;margin:0;">
                This is an automated message. Please do not reply.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f8f8;padding:14px 32px;border-top:1px solid #e5e7eb;">
              <table width="100%">
                <tr>
                  <td style="font-size:11px;color:#aaaaaa;">&copy; 2026 {settings.company_name}</td>
                  <td align="right" style="font-size:11px;color:#aaaaaa;">Sent via SMTP</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        plain = f"""
Interview Invitation - {settings.company_name}

Hi {candidate_name},

You have been shortlisted for {job_title} at {settings.company_name}.

Start your interview here:
{interview_link}

Link expires: {expires_str}

Important:
- This link can only be used once
- Camera and microphone required
- Complete in one session

For issues: {smtp_from_email}
Add {smtp_from_email} to your contacts to ensure delivery.
"""

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Interview Invitation - {job_title} | {settings.company_name}"
        msg['From'] = f"{settings.smtp_from_name} <{smtp_from_email}>"
        msg['To'] = to_email
        msg['Reply-To'] = smtp_from_email
        msg.attach(MIMEText(plain, 'plain'))
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(smtp_from_email, to_email, msg.as_string())

        logger.info(f"[EMAIL] Sent to {to_email} for {job_title}")
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "[EMAIL] SMTP auth failed. Check SMTP_USER and SMTP_PASSWORD. "
            "Use Gmail App Password, not account password."
        )
        return False
    except smtplib.SMTPException as exc:
        logger.error(f"[EMAIL] SMTP error: {exc}")
        return False
    except Exception as exc:
        logger.error(f"[EMAIL] Unexpected error: {exc}")
        return False
