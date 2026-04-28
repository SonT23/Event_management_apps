import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="p-4 md:p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{description}</p>
        </CardContent>
      </Card>
    </div>
  )
}
