import type { requireProfile } from "@/lib/auth";
import type { Establishment, Order } from "@/lib/database.types";

export type { Establishment, Order } from "@/lib/database.types";

type Supabase = Awaited<ReturnType<typeof requireProfile>>["supabase"];

export { isValidDate as isDate, isUuid } from "@/lib/domain";

export async function fetchEstablishments(supabase: Supabase): Promise<Establishment[]> {
  const records: Establishment[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("establishments").select("*").order("name").order("id").range(offset, offset + 999);
    if (error) throw new Error("Não foi possível carregar os estabelecimentos. Tente novamente.");
    records.push(...data);
    if (data.length < 1000) return records;
  }
}

export async function fetchDailyOrders(supabase: Supabase, deliveryDate: string): Promise<Order[]> {
  const records: Order[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("orders").select("*").eq("delivery_date", deliveryDate)
      .order("order_number", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error("Não foi possível carregar os pedidos do dia. Tente novamente.");
    records.push(...data);
    if (data.length < 1000) return records;
  }
}

export async function fetchOrderPage(supabase: Supabase, filters: { from?: string; to?: string; establishmentId?: string; page: number }) {
  let query = supabase.from("orders").select("*", { count: "exact" });
  if (filters.from) query = query.gte("delivery_date", filters.from);
  if (filters.to) query = query.lte("delivery_date", filters.to);
  if (filters.establishmentId) query = query.eq("establishment_id", filters.establishmentId);
  const { data, error, count } = await query.order("delivery_date", { ascending: false })
    .order("order_number", { ascending: false }).range((filters.page - 1) * 50, filters.page * 50 - 1);
  if (error) throw new Error("Não foi possível carregar os pedidos. Tente novamente.");
  return { orders: data as Order[], count: count ?? 0 };
}
