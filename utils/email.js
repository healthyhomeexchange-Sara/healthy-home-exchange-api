import nodemailer from 'nodemailer';

let transporter = null;
let isTransporterReady = false;

export function getTransporter() {
  if (transporter) return transporter;
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email not configured (EMAIL_USER/EMAIL_PASS missing)');
    return null;
  }
  
  transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { 
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASS 
    } 
  });
  
  // Verify transporter asynchronously
  transporter.verify()
    .then(() => {
      isTransporterReady = true;
      console.log('✓ Email transporter verified');
    })
    .catch(err => {
      isTransporterReady = false;
      console.error('✗ Email verification failed:', err?.message || err);
    });
  
  return transporter;
}

export function isReady() {
  return isTransporterReady && Boolean(transporter);
}

export async function sendExpiryEmail(listing) {
  const t = getTransporter();
  if (!t || !isTransporterReady) {
    console.warn('Email transporter not ready, skipping email');
    return false;
  }
  
  try {
    const info = await t.sendMail({ 
      from: process.env.EMAIL_USER, 
      to: listing.email, 
      subject: 'Your listing is expiring soon', 
      text: `Hello,\n\nYour listing "${listing.name}" will expire soon.\n\nBest regards,\nHealthy Home Exchange` 
    });
    
    console.log('✓ Email sent:', info?.messageId);
    return true;
  } catch (err) {
    console.error('✗ Email send error:', err?.message || err);
    return false;
  }
}
