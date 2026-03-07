// Supabase Edge Function: send-email
// Sends email via Gmail SMTP using nodemailer (Deno-compatible)
// Deploy: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, gmailUser, gmailAppPassword, fromName } = await req.json();

    if (!gmailUser || !gmailAppPassword || !to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build RFC 2822 email message
    const from = fromName ? `${fromName} <${gmailUser}>` : gmailUser;
    const boundary = `boundary_${crypto.randomUUID().replace(/-/g, '')}`;

    const rawMessage = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(html))),
      `--${boundary}--`,
    ].join('\r\n');

    // Send via Gmail API using OAuth2 App Password (Basic Auth over SMTP)
    // Since Deno doesn't have nodemailer, we use Gmail's REST API with app password
    // encoded as base64 for SMTP AUTH PLAIN
    const credentials = btoa(`${gmailUser}\0${gmailUser}\0${gmailAppPassword}`);

    // Use Gmail SMTP via fetch to smtp2go or similar — 
    // Actually, use the Gmail REST API (requires OAuth, not app password)
    // Best approach from edge functions: use smtp via TCP which Deno supports
    
    // Deno TCP SMTP approach
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const conn = await Deno.connectTls({
      hostname: 'smtp.gmail.com',
      port: 465,
    });

    const read = async () => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n ?? 0));
    };

    const write = async (cmd: string) => {
      await conn.write(encoder.encode(cmd + '\r\n'));
    };

    await read(); // 220 greeting
    await write('EHLO smtp.gmail.com');
    await read(); // 250 capabilities

    await write('AUTH LOGIN');
    await read(); // 334 Username

    await write(btoa(gmailUser));
    await read(); // 334 Password

    await write(btoa(gmailAppPassword));
    const authResp = await read();
    if (!authResp.startsWith('235')) {
      conn.close();
      return new Response(
        JSON.stringify({ error: 'Gmail authentication failed. Check your Gmail address and App Password.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await write(`MAIL FROM:<${gmailUser}>`);
    await read();

    await write(`RCPT TO:<${to}>`);
    await read();

    await write('DATA');
    await read();

    await write(rawMessage + '\r\n.');
    await read();

    await write('QUIT');
    conn.close();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Email send error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
