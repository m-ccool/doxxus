// Receives the contact form and the package builder, stores the submission in Postgres,
// then emails you a notification and the visitor a receipt through Resend.
//
// Secrets (Edge Function secrets, never committed): RESEND_API_KEY, MAIL_FROM, NOTIFY_TO, IP_SALT.
// Supabase injects SUPABASE_URL and the service key itself.
// Same contract as the old PHP endpoint: urlencoded fields in, the literal text "success" out.

const ALLOWED_ORIGINS = ['https://doxxus.us', 'https://www.doxxus.us', 'http://localhost:8777'];
const TYPES = ['website', 'software', 'repair', 'other'];
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_PER_IP = 5;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? '';
const NOTIFY_TO = Deno.env.get('NOTIFY_TO') ?? 'dev@doxxus.us';
const IP_SALT = Deno.env.get('IP_SALT') ?? '';

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  };
}

function reply(status: number, body: string, origin: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin) } });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function field(form: FormData, name: string, max: number): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(IP_SALT + ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function sendMail(payload: Record<string, unknown>): Promise<boolean> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.includes(origin)) return new Response('error', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(405, 'error', origin);
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(500, 'error', origin);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return reply(400, 'error', origin);
  }

  // A hidden field that only bots fill in: pretend it worked and store nothing.
  if (field(form, 'hp', 200)) return reply(200, 'success', origin);

  const kind = field(form, 'kind', 20) === 'package' ? 'package' : 'contact';
  const type = field(form, 'type', 20);
  const name = field(form, 'user', 50);
  const email = field(form, 'email', 254).toLowerCase();
  const phone = field(form, 'phone', 20);
  const message = field(form, 'websummary', 500);

  const valid =
    TYPES.includes(type) &&
    name.length >= 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    /^[0-9+().\-\s]{10,20}$/.test(phone) &&
    message.length >= 10;
  if (!valid) return reply(400, 'error', origin);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipHash = await hashIp(ip);

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const recent = await db(`submissions?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}`, {
    headers: { Prefer: 'count=exact', Range: '0-0' },
  });
  const total = Number((recent.headers.get('content-range') ?? '').split('/')[1] ?? 0);
  if (!recent.ok || total >= RATE_LIMIT_PER_IP) return reply(429, 'error', origin);

  const inserted = await db('submissions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ kind, name, email, phone, type, message, ip_hash: ipHash }),
  });
  if (!inserted.ok) return reply(500, 'error', origin);
  const [row] = await inserted.json();

  // The message is safely stored from here on, so a mail problem never loses it.
  let status = 'stored';
  if (RESEND_API_KEY && MAIL_FROM) {
    const label = kind === 'package' ? 'Package request' : 'Contact message';
    const safe = { name: escapeHtml(name), email: escapeHtml(email), phone: escapeHtml(phone), message: escapeHtml(message).replace(/\n/g, '<br>') };
    try {
      const [notified, receipted] = await Promise.all([
        sendMail({
          from: MAIL_FROM,
          to: [NOTIFY_TO],
          reply_to: email,
          subject: `[doxxus.us] ${label} from ${name}`,
          html: `<p><strong>${label}</strong> (${escapeHtml(type)})</p><p>${safe.name}<br>${safe.email}<br>${safe.phone}</p><p>${safe.message}</p>`,
        }),
        sendMail({
          from: MAIL_FROM,
          to: [email],
          reply_to: NOTIFY_TO,
          subject: 'I received your message',
          html: `<p>Hi ${safe.name},</p><p>Thanks for reaching out. I received your ${kind === 'package' ? 'package request' : 'message'} and will reply to this email address.</p><p>Here is what you sent:</p><blockquote>${safe.message}</blockquote><p>B McCool<br>doxxus.us</p>`,
        }),
      ]);
      status = notified && receipted ? 'notified' : 'email_failed';
    } catch {
      status = 'email_failed';
    }
  }
  await db(`submissions?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

  return reply(200, 'success', origin);
});
