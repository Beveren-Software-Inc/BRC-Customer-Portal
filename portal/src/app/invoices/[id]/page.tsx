import InvoiceDetail from "@/components/sales-invoices/invoice-detail"

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <InvoiceDetail id={params.id} />
}

