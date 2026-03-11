import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { count } from "drizzle-orm"

export const dynamic = "force-dynamic"

export default async function Home() {
  const [result] = await db.select({ count: count() }).from(user)
  if (result.count === 0) {
    redirect("/setup")
  }
  redirect("/dashboard")
}
