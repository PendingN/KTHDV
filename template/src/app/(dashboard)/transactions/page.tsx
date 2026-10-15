import { Transactions } from "@/components/finance/transactions"
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const draft = typeof query.expense === "string" ? { note: query.expense.slice(0, 500), amount: typeof query.amount === "string" ? query.amount : "", currency: typeof query.currency === "string" ? query.currency : "VND" } : undefined
  return <Transactions draft={draft} />
}
