import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const signupSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { businessName, email, password } = parsed.data;

    // Check if email already taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create User + Business in one transaction
    await prisma.$transaction([
      prisma.user.create({ data: { email, passwordHash } }),
      prisma.business.create({ data: { name: businessName, ownerEmail: email } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[signup] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
