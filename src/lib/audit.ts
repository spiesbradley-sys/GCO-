import 'server-only';
import type { AuditAction } from '@prisma/client';
import { prisma } from './prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Append-only audit log
//
// Call recordAudit() for every sensitive action: login, permission changes,
// payments, document access, and system links. This module only ever INSERTS.
// There is deliberately no update/delete helper — the audit trail is immutable.
// In production, back this with a DB trigger or a restricted DB role that denies
// UPDATE/DELETE on audit_log.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditInput = {
  action: AuditAction;
  orgId?: string | null;
  actorId?: string | null;
  target?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /**
   * Non-sensitive context only. NEVER put card/bank numbers, credentials,
   * document contents, or client identifiers that must not leave the app here.
   */
  metadata?: Record<string, unknown> | null;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        orgId: input.orgId ?? null,
        actorId: input.actorId ?? null,
        target: input.target ?? null,
        targetId: input.targetId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    // Auditing must never break the primary action, but failures must be visible.
    // TODO: route to your log aggregator / alerting.
    console.error('[audit] failed to record', input.action, err);
  }
}
