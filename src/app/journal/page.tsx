import { redirect } from "next/navigation";

export default async function JournalPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const params = new URLSearchParams();

  // Always set tab=journal
  params.set("tab", "journal");

  for (const [key, value] of Object.entries(resolvedParams)) {
    if (key !== "tab" && typeof value === "string") {
      params.set(key, value);
    }
  }

  redirect(`/?${params.toString()}`);
}
