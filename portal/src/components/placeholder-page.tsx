import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface PlaceholderPageProps {
  title: string
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>This page is under construction</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-muted-foreground">
            This feature is currently being developed and will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
