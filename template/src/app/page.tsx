import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sessionCookie } from "@/lib/backend";
export default async function Home() {
  redirect((await cookies()).has(sessionCookie) ? "/dashboard" : "/sign-in");
}
