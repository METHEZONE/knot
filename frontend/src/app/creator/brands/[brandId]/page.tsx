import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ brandId: string }> }) {
  await params;
  redirect("/creator/result");
}
