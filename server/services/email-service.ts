interface EmailConfig {
  from: string;
  replyTo?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const APP_NAME = process.env.APP_NAME || 'HolaHola';
const APP_URL = process.env.APP_URL || 'https://getholahola.com';
const FROM_EMAIL = process.env.FROM_EMAIL || `noreply@${APP_NAME.toLowerCase()}.app`;

export class EmailService {
  private apiKey: string | null;
  private provider: 'resend' | 'sendgrid' | 'console';
  
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || null;
    
    if (process.env.RESEND_API_KEY) {
      this.provider = 'resend';
    } else if (process.env.SENDGRID_API_KEY) {
      this.provider = 'sendgrid';
    } else {
      this.provider = 'console';
      console.log('[Email] No email provider configured. Emails will be logged to console.');
    }
  }
  
  private async sendViaResend(options: SendEmailOptions): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('[Email] Resend error:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[Email] Resend error:', error);
      return false;
    }
  }
  
  private async sendViaSendGrid(options: SendEmailOptions): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: FROM_EMAIL },
          subject: options.subject,
          content: [
            { type: 'text/html', value: options.html },
            ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          ],
        }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('[Email] SendGrid error:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('[Email] SendGrid error:', error);
      return false;
    }
  }
  
  private logToConsole(options: SendEmailOptions): boolean {
    console.log('\n========== EMAIL (Console Mode) ==========');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-------------------------------------------');
    console.log(options.text || options.html);
    console.log('===========================================\n');
    return true;
  }
  
  async send(options: SendEmailOptions): Promise<boolean> {
    switch (this.provider) {
      case 'resend':
        return this.sendViaResend(options);
      case 'sendgrid':
        return this.sendViaSendGrid(options);
      case 'console':
      default:
        return this.logToConsole(options);
    }
  }
  
  async sendInvitation(params: {
    to: string;
    firstName?: string;
    inviterName?: string;
    role: string;
    className?: string;
    token: string;
  }): Promise<boolean> {
    const completeUrl = `${APP_URL}/complete-registration?token=${params.token}`;
    const greeting = params.firstName ? `Hi ${params.firstName}` : 'Hi there';
    const roleText = params.role === 'teacher' ? 'teacher' : 'student';
    const classInfo = params.className ? ` for ${params.className}` : '';
    const inviterInfo = params.inviterName ? ` by ${params.inviterName}` : '';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to ${APP_NAME}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${APP_NAME}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Your AI Language Tutor</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">${greeting},</h2>
    
    <p>You've been invited${inviterInfo} to join ${APP_NAME} as a <strong>${roleText}</strong>${classInfo}.</p>
    
    <p>${APP_NAME} is an AI-powered language tutoring platform where you can practice speaking with personalized AI tutors who adapt to your learning style.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${completeUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Complete Your Registration</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">Or copy this link: <a href="${completeUrl}" style="color: #667eea;">${completeUrl}</a></p>
    
    <p style="color: #6b7280; font-size: 14px;">This invitation expires in 7 days.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      This is an automated message from ${APP_NAME}. Please do not reply to this email.
    </p>
  </div>
</body>
</html>`;

    const text = `${greeting},

You've been invited${inviterInfo} to join ${APP_NAME} as a ${roleText}${classInfo}.

Complete your registration here: ${completeUrl}

This invitation expires in 7 days.

---
This is an automated message from ${APP_NAME}. Please do not reply to this email.`;

    return this.send({
      to: params.to,
      subject: `You're invited to ${APP_NAME}`,
      html,
      text,
    });
  }
  
  async sendPasswordReset(params: {
    to: string;
    firstName?: string;
    token: string;
  }): Promise<boolean> {
    const resetUrl = `${APP_URL}/reset-password?token=${params.token}`;
    const greeting = params.firstName ? `Hi ${params.firstName}` : 'Hi there';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ${APP_NAME} Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${APP_NAME}</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Password Reset</p>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">${greeting},</h2>
    
    <p>We received a request to reset your password. Click the button below to choose a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">Or copy this link: <a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a></p>
    
    <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour for security.</p>
    
    <p style="color: #6b7280; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      This is an automated message from ${APP_NAME}. Please do not reply to this email.
    </p>
  </div>
</body>
</html>`;

    const text = `${greeting},

We received a request to reset your password.

Reset your password here: ${resetUrl}

This link expires in 1 hour for security.

If you didn't request this, you can safely ignore this email.

---
This is an automated message from ${APP_NAME}. Please do not reply to this email.`;

    return this.send({
      to: params.to,
      subject: `Reset your ${APP_NAME} password`,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
