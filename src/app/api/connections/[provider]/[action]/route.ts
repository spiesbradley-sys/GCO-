import { NextResponse } from 'next/server';
import { requireTenantContext } from '@/lib/context';
import { recordAudit } from '@/lib/audit';

// OAuth connection flow scaffolding for QuickBooks, Xero, and Plaid.
//
// `start`    → build the provider's authorise URL and redirect the user into the
//              provider's OWN hosted consent screen.
// `callback` → exchange the returned code for provider tokens, then persist ONLY
//              the token reference + non-secret metadata on the Connection row.
//
// We NEVER receive or store the client's provider username/password — only the
// provider-issued OAuth tokens (and even those belong in a secrets vault, with
// just a reference on the row).
const PROVIDERS = new Set(['quickbooks', 'xero', 'plaid']);

export async function GET(
  _req: Request,
  { params }: { params: { provider: string; action: string } },
) {
  const { provider, action } = params;
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  const ctx = await requireTenantContext();

  if (action === 'start') {
    // TODO: construct the real authorise URL for `provider` using the client
    // id / redirect URI from env, with a signed `state` carrying ctx.orgId, then
    // `return NextResponse.redirect(authorizeUrl)`.
    return NextResponse.json({
      todo: `Build ${provider} OAuth start URL and redirect the user to the provider.`,
      note: 'Client authorises in the provider’s hosted flow. Store tokens only, never credentials.',
      orgId: ctx.orgId,
    });
  }

  if (action === 'callback') {
    // TODO: verify `state`, exchange `code` for tokens server-side, store a token
    // REFERENCE + metadata on the Connection, set status = 'connected'.
    await recordAudit({
      action: 'system_link_connected',
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      target: provider,
    });
    return NextResponse.redirect(new URL('/connections', process.env.AUTH_URL ?? 'http://localhost:3000'));
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 404 });
}
