import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// Cache valid product responses at the CDN for 60 s, serve stale for 5 min.
// NOT_FOUND (404) responses are intentionally not cached.
const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

type RouteContext = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const { id } = await params;

  // Basic format guard — cuid() ids are never empty or whitespace
  if (!id?.trim()) {
    return NextResponse.json(
      { error: "Product ID is required." },
      { status: 400 }
    );
  }

  try {
    // Explicit select — never return schema fields added in the future
    // (cost price, internal notes, supplier id, etc.) to the public API.
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id:          true,
        title:       true,
        description: true,
        price:       true,
        stock:       true,
        category:    true,
        rating:      true,
        images:      true,
        createdAt:   true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: `Product with id "${id}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json(product, {
      status: 200,
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (err) {
    console.error(`[GET /api/products/${id}]`, err);

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: "Database query failed.",
          ...(process.env.NODE_ENV === "development" && {
            details: `Prisma ${err.code}: ${err.message}`,
          }),
        },
        { status: 500 }
      );
    }

    if (err instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database connection failed. Please try again later." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
