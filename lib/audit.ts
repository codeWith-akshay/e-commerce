/**
 * lib/audit.ts
 *
 * Thin wrapper around the AuditLog model.
 *
 * Usage — call from any server action after a sensitive mutation:
 *
 *   await writeAuditLog({
 *     performedById: userId,
 *     action:        "UPDATE",
 *     entity:        "Order",
 *     entityId:      order.id,
 *     oldValue:      { status: "PENDING" },
 *     newValue:      { status: "SHIPPED" },
 *     ipAddress,
 *   });
 *
 * All writes are fire-and-forget — audit failures must never break the primary
 * operation.  Use `await` only when strong consistency is required.
 */

import { AuditAction, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type { AuditAction };

export interface WriteAuditLogInput {
  performedById: string;
  action:        AuditAction;
  /** Model name, e.g. "Order", "Product", "User", "Coupon" */
  entity:        string;
  entityId:      string;
  oldValue?:     Record<string, unknown> | null;
  newValue?:     Record<string, unknown> | null;
  ipAddress?:    string | null;
  userAgent?:    string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// writeAuditLog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist a single audit log entry.
 * Returns `null` on error so the caller is never blocked by an audit failure.
 */
export async function writeAuditLog(
  input: WriteAuditLogInput
): Promise<{ id: string } | null> {
  try {
    return await prisma.auditLog.create({
      data: {
        performedById: input.performedById,
        action:        input.action,
        entity:        input.entity,
        entityId:      input.entityId,
        oldValue:      input.oldValue   != null ? (input.oldValue   as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValue:      input.newValue   != null ? (input.newValue   as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress:     input.ipAddress  ?? null,
        userAgent:     input.userAgent  ?? null,
      },
      select: { id: true },
    });
  } catch (err) {
    // Non-fatal — log the error but do not surface it to the caller
    console.error("[writeAuditLog] Failed to write audit entry:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getAuditLogs  — admin query with filters
// ─────────────────────────────────────────────────────────────────────────────

export type AuditLogEntry = {
  id:           string;
  action:       AuditAction;
  entity:       string;
  entityId:     string;
  oldValue:     unknown;
  newValue:     unknown;
  ipAddress:    string | null;
  createdAt:    Date;
  performedBy: { id: string; name: string; email: string };
};

export interface GetAuditLogsOptions {
  entity?:        string;
  entityId?:      string;
  performedById?: string;
  action?:        AuditAction;
  from?:          Date;
  to?:            Date;
  page?:          number;
  pageSize?:      number;
}

export async function getAuditLogs(
  options: GetAuditLogsOptions = {}
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { entity, entityId, performedById, action, from, to, page = 1, pageSize = 30 } = options;

  const where = {
    ...(entity        && { entity }),
    ...(entityId      && { entityId }),
    ...(performedById && { performedById }),
    ...(action        && { action }),
    ...((from || to)  && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to   && { lte: to }),
      },
    }),
  };

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      select:  {
        id:        true,
        action:    true,
        entity:    true,
        entityId:  true,
        oldValue:  true,
        newValue:  true,
        ipAddress: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}
