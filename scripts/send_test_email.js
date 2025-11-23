import dotenv from 'dotenv';
dotenv.config();

import { getTransporter } from '../utils/email.js';

async function main(){
  const t = getTransporter();
  if (!t) { console.error('Transporter not configured (EMAIL_USER/EMAIL_PASS missing)'); process.exit(1); }
  try {
    const res = await t.sendMail({ from: process.env.EMAIL_USER, to: process.env.EMAIL_USER, subject: 'HHEx test', text: 'Test from healthy-home-exchange-api-new' });
    console.log('sendMail success:', res && res.response);
  } catch (err) { console.error('sendMail error:', err?.message || err); process.exit(1); }
}

main();
