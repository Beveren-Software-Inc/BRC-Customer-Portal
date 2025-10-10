import DeliveryNoteDetail from "@/components/delivery-notes/delivery-note-detail"

export default function DeliveryNoteDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <DeliveryNoteDetail id={params.id} />
}

