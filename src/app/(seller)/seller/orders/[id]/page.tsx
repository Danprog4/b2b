import { and, eq, sql } from "drizzle-orm";
import { Building2, Package, ReceiptText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { db } from "@/db";
import {
  buyerCompanies,
  files,
  orderItems,
  orders,
  products,
  sellers,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getPublicFileUrl } from "@/lib/files/urls";
import { getSellerBreadcrumbSource } from "@/lib/seller/breadcrumbs";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type SellerOrderPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SellerOrderPage({
  params,
  searchParams,
}: SellerOrderPageProps) {
  const user = await requireUser(["seller"]);
  const { id } = await params;
  const search = (await searchParams) ?? {};
  const breadcrumbSource = getSellerBreadcrumbSource(search, "orders");

  if (!user.sellerId) {
    notFound();
  }

  const [seller] = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      inn: sellers.inn,
    })
    .from(sellers)
    .where(eq(sellers.id, user.sellerId))
    .limit(1);

  if (!seller) {
    notFound();
  }

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      comment: orders.comment,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      buyerCompanyName: buyerCompanies.name,
      buyerCompanyInn: buyerCompanies.inn,
    })
    .from(orders)
    .innerJoin(buyerCompanies, eq(buyerCompanies.id, orders.buyerCompanyId))
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.id, id), eq(orderItems.sellerId, seller.id)))
    .groupBy(orders.id, buyerCompanies.id)
    .limit(1);

  if (!order) {
    notFound();
  }

  const [items, summary] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        productName: orderItems.productNameSnapshot,
        sku: orderItems.skuSnapshot,
        unit: orderItems.unitSnapshot,
        quantity: orderItems.quantity,
        priceWithVat: orderItems.priceWithVat,
        vatRate: orderItems.vatRate,
        vatAmount: orderItems.vatAmount,
        lineTotal: orderItems.lineTotal,
        mainImageFileId: files.id,
        mainImageStorageKey: files.storageKey,
        mainImageIsActive: files.isActive,
      })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .leftJoin(files, eq(files.id, products.mainImageFileId))
      .where(and(eq(orderItems.orderId, order.id), eq(orderItems.sellerId, seller.id)))
      .orderBy(orderItems.createdAt),
    db
      .select({
        itemCount: sql<number>`count(${orderItems.id})`,
        sellerAmount: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        vatAmount: sql<string>`coalesce(sum(${orderItems.vatAmount}), 0)`,
      })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, order.id), eq(orderItems.sellerId, seller.id)))
      .then(([row]) => row),
  ]);

  const sellerAmount = Number(summary?.sellerAmount ?? 0);

  return (
    <main className="min-h-screen bg-[#f4f6fb] px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap gap-2 text-sm font-bold text-slate-500">
          <Link className="text-[#1157ff]" href="/">
            Главная
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href="/seller">
            Кабинет продавца
          </Link>
          <span>/</span>
          <Link className="text-[#1157ff]" href={breadcrumbSource.href}>
            {breadcrumbSource.label}
          </Link>
          <span>/</span>
          <span>{order.number}</span>
        </div>

        <Link
          className="inline-flex text-sm font-bold text-[#1157ff] transition hover:text-[#0b49e0]"
          href={breadcrumbSource.href}
        >
          ← {breadcrumbSource.label}
        </Link>

        <section className="mt-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <ReceiptText className="text-[#1157ff]" size={28} />
                <h1 className="text-3xl font-black text-slate-950">
                  {order.number}
                </h1>
              </div>
              <p className="mt-2 text-slate-500">
                {formatDateTime(order.createdAt)} · обновлен{" "}
                {formatDateTime(order.updatedAt)}
              </p>
            </div>
            <OrderStatusBadge
              status={order.status}
              className="rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {order.comment ? (
            <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              <span className="font-bold">Комментарий покупателя: </span>
              {order.comment}
            </div>
          ) : null}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="self-start overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const imageUrl = item.mainImageIsActive
                  ? getPublicFileUrl({
                      id: item.mainImageFileId,
                      storageKey: item.mainImageStorageKey,
                    })
                  : null;

                return (
                  <article
                    className="grid items-start gap-4 p-5 md:grid-cols-[80px_1fr_auto]"
                    key={item.id}
                  >
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                      {imageUrl ? (
                        <img
                          alt={item.productName}
                          className="h-full w-full object-cover"
                          src={imageUrl}
                        />
                      ) : (
                        <Package className="text-slate-300" size={30} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-950">
                        {item.productName}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.sku} · {item.unit}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        НДС {Number(item.vatRate)}%:{" "}
                        {formatCurrency(item.vatAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black">
                        {formatCurrency(item.lineTotal)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">
                        {Number(item.quantity)} ×{" "}
                        {formatCurrency(item.priceWithVat)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="grid gap-5 self-start">
            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="text-xl font-black text-slate-950">Итого</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Позиции продавца</span>
                  <span className="font-black">{summary?.itemCount ?? 0}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Сумма с НДС</span>
                  <span className="font-black">{formatCurrency(sellerAmount)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">НДС в сумме</span>
                  <span className="font-bold">
                    {formatCurrency(summary?.vatAmount ?? "0")}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-3 border-t border-slate-100 pt-4 text-base">
                  <span className="font-black text-slate-950">К выплате</span>
                  <span className="font-black text-slate-950">
                    {formatCurrency(sellerAmount)}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <ReceiptText className="text-[#1157ff]" size={20} />
                Продавец
              </h2>
              <p className="mt-3 text-sm font-black text-slate-950">
                {seller.name}
              </p>
              <p className="mt-2 text-sm text-slate-500">ИНН {seller.inn}</p>
            </section>

            <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
                <Building2 className="text-[#1157ff]" size={20} />
                Покупатель
              </h2>
              <p className="mt-3 text-sm font-black text-slate-950">
                {order.buyerCompanyName}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                ИНН {order.buyerCompanyInn}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
