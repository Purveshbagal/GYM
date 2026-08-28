import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import { signToken } from "@/lib/auth";

// Bootstraps the first owner account, or lets an existing owner add staff.
// In production, gate this behind an existing-owner check once you have one.
export async function POST(req: NextRequest) {
  await connectDB();
  const { name, username, password, role } = await req.json();
  if (!name || !username || !password) {
    return NextResponse.json({ error: "name, username, password required" }, { status: 400 });
  }

  const existing = await Admin.findOne({ username });
  if (existing) return NextResponse.json({ error: "Username already registered" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const adminCount = await Admin.countDocuments();
  const admin = await Admin.create({
    name,
    username,
    passwordHash,
    role: adminCount === 0 ? "owner" : role === "owner" ? "staff" : role || "staff",
  });

  const token = signToken({ id: admin._id.toString(), username: admin.username, role: admin.role });
  return NextResponse.json({
    token,
    user: { id: admin._id, name: admin.name, username: admin.username, role: admin.role },
  });
}
