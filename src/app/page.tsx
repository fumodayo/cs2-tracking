import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/portfolio");
  } else {
    redirect("/inventory-scanner");
  }
}
