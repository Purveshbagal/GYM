import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getAgentAuth } from "@/lib/agentAuth";
import DeviceJob from "@/models/DeviceJob";

/**
 * Agent polls this on an interval. A device only ever sees its own jobs
 * (scoped by the authenticated agentId), never another gym's queue.
 * Returned jobs are flipped to PROCESSING so a slow/duplicate poll doesn't
 * hand the same job to two overlapping runs.
 */
export async function GET(req: NextRequest) {
  await connectDB();
  const agent = await getAgentAuth(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await DeviceJob.find({ agentId: agent.agentId, status: "PENDING" })
    .sort({ createdAt: 1 })
    .limit(10);

  const ids = jobs.map((j) => j._id);
  if (ids.length) {
    await DeviceJob.updateMany({ _id: { $in: ids } }, { $set: { status: "PROCESSING" }, $inc: { attempts: 1 } });
  }

  return NextResponse.json({
    success: true,
    data: jobs.map((j) => ({
      jobId: String(j._id),
      type: j.type,
      payload: j.payload ?? null,
    })),
  });
}
