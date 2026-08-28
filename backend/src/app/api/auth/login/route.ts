import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
import { signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await connectDB();
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "username and password required" }, { status: 400 });
  }

  const admin = await Admin.findOne({ username });
  if (!admin) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  const token = signToken({ id: admin._id.toString(), username: admin.username, role: admin.role });
  return NextResponse.json({
    token,
    user: { id: admin._id, name: admin.name, username: admin.username, role: admin.role },
  });
}
