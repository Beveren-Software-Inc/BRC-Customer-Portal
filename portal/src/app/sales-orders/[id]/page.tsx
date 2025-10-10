import SalesOrderDetail from "@/components/sales-orders/sales-order-detail"

export default function SalesOrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <SalesOrderDetail id={params.id} />
}

