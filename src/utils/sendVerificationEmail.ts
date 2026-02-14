import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export async function sendVerificationEmail(
  configService: ConfigService,
  to: string,
  subject: string,
  html: string, // এখন parameter HTML
) {
  const smtpUser = configService.get<string>('SMTP_USER');
  // const smtpUser = process.env.SMTP_USER;
  const smtpPass = configService.get<string>('SMTP_PASS'); // const smtpPass = process.env.SMTP_PASS;
  const smtpHost = configService.get<string>('SMTP_HOST') ?? 'smtp.gmail.com';
  const smtpPort = Number(configService.get<string>('SMTP_PORT') ?? 587);
  const smtpFrom = configService.get<string>('SMTP_FROM') ?? smtpUser;

  if (!smtpUser || !smtpPass || !smtpFrom || Number.isNaN(smtpPort)) {
    return {
      success: false,
      skipped: true,
      error: 'SMTP configuration missing',
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: smtpFrom,
    to,
    subject,
    html, // এখানে text নয়, html ব্যবহার হবে
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, info };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Email error';
    return { success: false, error: message };
  }
}
