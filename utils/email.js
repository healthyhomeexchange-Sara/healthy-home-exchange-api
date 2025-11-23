import sgMail from '@sendgrid/mail';

let isSendGridReady = false;

export function initializeSendGrid() {
  if (isSendGridReady) return true;
  
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️  Email not configured (SENDGRID_API_KEY missing)');
    return false;
  }
  
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    isSendGridReady = true;
    console.log('✓ SendGrid configured');
    return true;
  } catch (err) {
    console.error('✗ SendGrid initialization failed:', err?.message || err);
    return false;
  }
}

export function isReady() {
  return isSendGridReady;
}

export async function sendExpiryEmail(listing) {
  if (!initializeSendGrid()) {
    console.warn('Email not configured, skipping email');
    return false;
  }
  
  const msg = {
    to: listing.email,
    from: process.env.SENDGRID_FROM_EMAIL || 'healthyhomeexchange@gmail.com',
    subject: 'Your listing is expiring soon',
    text: `Hello,\n\nYour listing "${listing.name}" will expire soon.\n\nBest regards,\nHealthy Home Exchange`,
    html: `<p>Hello,</p><p>Your listing <strong>"${listing.name}"</strong> will expire soon.</p><p>Best regards,<br>Healthy Home Exchange</p>`
  };
  
  try {
    await sgMail.send(msg);
    console.log('✓ Email sent to:', listing.email);
    return true;
  } catch (err) {
    console.error('✗ Email send error:', err?.message || err);
    return false;
  }
}
