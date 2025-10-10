import QuotationDetail from "@/components/quotations/quotation-detail"

export default function QuotationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <QuotationDetail id={params.id} />
}

