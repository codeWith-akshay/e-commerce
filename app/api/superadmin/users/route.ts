import { NextRequest, NextResponse } from "next/server";
import { Role as PrismaRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSessionRole } from "@/lib/session";
import type { IUser, PaginatedUsersResponse, Role } from "@/types/user";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/superadmin/users
//
// Query params:
//   page   – page number          (default: 1)
//   limit  – items per page       (default: 10)
//   search – filter by email      (case-insensitive, optional)
//   role   – filter by role       (USER | ADMIN | SUPERADMIN, optional)
//
// Access: SUPERADMIN only
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Auth guard ────────────────────────────────────────────────────────
    const sessionRole = await getSessionRole();

    if (!sessionRole) {
      return NextResponse.json(
        { error: "Unauthorized: no active session." },
        { status: 401 },
      );
    }

    if (sessionRole !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden: SUPERADMIN access required." },
        { status: 403 },
      );
    }

    // ── 2. Parse & validate query params ────────────────────────────────────
    const { searchParams } = req.nextUrl;

    // Cap limit to prevent URL-crafted over-fetching (e.g. ?limit=99999)
    const MAX_LIMIT = 50;
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));
    const search = searchParams.get("search")?.trim() ?? "";
    const roleParam = searchParams.get("role")?.toUpperCase() as Role | null;

    const validRoles: Role[] = ["USER", "ADMIN", "SUPERADMIN"];
    const roleFilter: PrismaRole | undefined =
      roleParam && validRoles.includes(roleParam)
        ? (roleParam as PrismaRole)
        : undefined;

    const skip = (page - 1) * limit;

    // ── 3. Build shared Prisma where clause ──────────────────────────────────
    const where = {
      ...(search && {
        email: { contains: search, mode: "insensitive" as const },
      }),
      ...(roleFilter && { role: roleFilter }),
    };

    // ── 4. Parallel fetch: users + total count ───────────────────────────────
    const [rawUsers, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id:        true,
          name:      true,
          email:     true,
          role:      true,
          createdAt: true,
          updatedAt: true,
          // password intentionally excluded
        },
      }),
      prisma.user.count({ where }),
    ]);

    // ── 5. Map to IUser (casting Prisma Role to our Role type) ───────────────
    const users: IUser[] = rawUsers.map((u) => ({
      id:        u.id,
      name:      u.name,
      email:     u.email,
      role:      u.role as Role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    // ── 6. Build paginated response ───────────────────────────────────────────
    const response: PaginatedUsersResponse = {
      users,
      currentPage: page,
      totalPages:  Math.ceil(totalUsers / limit),
      totalUsers,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET /api/superadmin/users]", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 },
    );
  }
}
