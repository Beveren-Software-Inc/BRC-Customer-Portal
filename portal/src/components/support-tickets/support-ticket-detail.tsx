"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Send, PaperclipIcon } from "lucide-react"
import { formatDate, getStatusColor } from "@/lib/utils"
import { Link, useParams } from "react-router-dom"

export default function SupportTicketDetail() {
  const { id } = useParams();
  const [newMessage, setNewMessage] = useState("")

  // Mock data for a single support ticket
  const ticketData = {
    id,
    date: "2023-03-17",
    subject: "Order delivery delay",
    description:
      "My order #SO-2023-001 was supposed to be delivered yesterday, but I haven't received it yet. Can you please check the status?",
    priority: "Medium",
    status: "In Progress",
    lastUpdate: "2023-03-19",
    category: "Delivery",
    assignedTo: "Sarah Johnson",
    customerName: "John Doe",
    customerEmail: "john.doe@example.com",
    relatedOrder: "SO-2023-001",
    messages: [
      {
        id: "MSG-001",
        date: "2023-03-17 14:30:00",
        sender: "John Doe",
        senderType: "customer",
        message:
          "My order #SO-2023-001 was supposed to be delivered yesterday, but I haven't received it yet. Can you please check the status?",
      },
      {
        id: "MSG-002",
        date: "2023-03-18 09:15:00",
        sender: "Sarah Johnson",
        senderType: "support",
        message:
          "Hello John, I'm sorry to hear about the delay. I've checked your order and it appears there was a delay at our shipping facility. The package is now in transit and should be delivered by tomorrow. I'll send you the updated tracking information shortly.",
      },
      {
        id: "MSG-003",
        date: "2023-03-18 09:20:00",
        sender: "Sarah Johnson",
        senderType: "support",
        message:
          "Here's the updated tracking information: TRK12345678. You can track your package on the carrier's website.",
      },
      {
        id: "MSG-004",
        date: "2023-03-19 10:45:00",
        sender: "John Doe",
        senderType: "customer",
        message: "Thank you for the update. I'll keep an eye on the tracking information.",
      },
    ],
  }

  // Function to get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "destructive"
      case "medium":
        return "warning"
      case "low":
        return "info"
      default:
        return "default"
    }
  }

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // In a real app, this would send the message to the server
      alert("Message sent: " + newMessage)
      setNewMessage("")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link to="/support-tickets">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">Support Ticket</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Close Ticket</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{ticketData.subject}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ticket #{ticketData.id} • Opened on {formatDate(ticketData.date)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={getStatusColor(ticketData.status)}>{ticketData.status}</Badge>
              <Badge variant={getPriorityColor(ticketData.priority)}>{ticketData.priority}</Badge>
              <Badge variant="outline">{ticketData.category}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{ticketData.description}</p>
            </div>
            <div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Customer</h3>
                  <p className="text-sm">{ticketData.customerName}</p>
                  <p className="text-sm text-muted-foreground">{ticketData.customerEmail}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-1">Assigned To</h3>
                  <p className="text-sm">{ticketData.assignedTo}</p>
                </div>
                {ticketData.relatedOrder && (
                  <div>
                    <h3 className="text-sm font-medium mb-1">Related Order</h3>
                    <Link
                      to={`/sales-orders/${ticketData.relatedOrder}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {ticketData.relatedOrder}
                    </Link>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium mb-1">Last Updated</h3>
                  <p className="text-sm">{formatDate(ticketData.lastUpdate)}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {ticketData.messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.senderType === "customer" ? "flex-row" : "flex-row-reverse"}`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={`/placeholder.svg?height=40&width=40`} alt={message.sender} />
                  <AvatarFallback>
                    {message.sender
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`flex flex-col max-w-[80%] ${
                    message.senderType === "customer" ? "items-start" : "items-end"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      message.senderType === "customer"
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "bg-blue-100 dark:bg-blue-900"
                    }`}
                  >
                    <p className="text-sm">{message.message}</p>
                  </div>
                  <div
                    className={`mt-1 flex items-center gap-2 text-xs text-muted-foreground ${
                      message.senderType === "customer" ? "justify-start" : "justify-end"
                    }`}
                  >
                    <span>{message.sender}</span>
                    <span>•</span>
                    <span>{message.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex w-full flex-col gap-2">
            <Textarea
              placeholder="Type your message here..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-between">
              <Button variant="outline" size="sm">
                <PaperclipIcon className="mr-2 h-4 w-4" />
                Attach File
              </Button>
              <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

