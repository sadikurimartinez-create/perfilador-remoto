import { handleStreetCandidatesPost } from "@/lib/incidenceStreetCandidatesApiHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  return handleStreetCandidatesPost(req);
}