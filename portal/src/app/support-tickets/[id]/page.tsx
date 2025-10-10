import SupportTicketDetail from "@/components/support-tickets/support-ticket-detail"

export default function SupportTicketDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <SupportTicketDetail id={params.id} />
}

