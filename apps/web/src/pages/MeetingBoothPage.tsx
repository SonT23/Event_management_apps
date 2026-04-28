import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DOM_ID = 'meeting-booth-qr'

function resultLabel(r: string) {
  if (r === 'on_time') {
    return 'Đúng giờ'
  }
  if (r === 'late') {
    return 'Trễ'
  }
  if (r === 'out_of_window') {
    return 'Ngoài khung giờ'
  }
  return r
}

export function MeetingBoothPage() {
  const { eventId = '', meetingId = '' } = useParams()
  const { user } = useAuth()
  const canScan = !!user
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [lastOk, setLastOk] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [manual, setManual] = useState('')
  const scanner = useRef<Html5Qrcode | null>(null)

  const stop = useCallback(async () => {
    const s = scanner.current
    if (s) {
      try {
        await s.stop()
      } catch {
        // ignore
      }
      s.clear()
      scanner.current = null
    }
    setRunning(false)
  }, [])

  const submitToken = useCallback(
    async (raw: string) => {
      if (!canScan || !eventId || !meetingId) {
        return
      }
      const qrToken = raw.trim()
      if (!qrToken) {
        return
      }
      setMessage(null)
      try {
        const j = (await apiJson<{
          result: string
          minutesAfterStart: number | null
          scannedAt: string
        }>(`/events/${eventId}/meetings/${meetingId}/attendance/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qrToken,
            note: note.trim() || undefined,
          }),
        }))!
        setLastOk(
          `${resultLabel(j.result)} — ${new Date(j.scannedAt).toLocaleString('vi-VN')}`,
        )
      } catch (e) {
        setMessage(formatApiError(e))
        setLastOk(null)
      }
    },
    [canScan, eventId, meetingId, note],
  )

  const start = useCallback(async () => {
    if (!canScan || !eventId) {
      return
    }
    setMessage(null)
    await stop()
    const s = new Html5Qrcode(DOM_ID, { verbose: false })
    scanner.current = s
    await s.start(
      { facingMode: 'environment' },
      { fps: 8, qrbox: { width: 240, height: 240 } },
      (decoded) => {
        void submitToken(decoded)
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      () => {},
    )
    setRunning(true)
  }, [canScan, eventId, stop, submitToken])

  useEffect(() => {
    return () => {
      void stop()
    }
  }, [stop])

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">Điểm danh buổi họp</h2>
        <p className="text-muted-foreground text-sm">
          Sự kiện: <code className="text-xs">{eventId}</code> · Buổi:{' '}
          <code className="text-xs">{meetingId}</code> — dùng cùng mã QR đăng ký
          sự kiện.
        </p>
      </div>
      <div
        className="bg-muted relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg border"
        id={DOM_ID}
      />
      <div className="flex flex-wrap gap-2">
        {!running ? (
          <Button type="button" onClick={start}>
            Bật camera
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={stop}>
            Tắt camera
          </Button>
        )}
      </div>
      {lastOk && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {lastOk}
        </p>
      )}
      {message && (
        <p className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ghi chú (tùy chọn)</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú lúc quét"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nhập tay mã thô</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="mm">Mã (hex từ QR)</Label>
            <Input
              id="mm"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void submitToken(manual)
              setManual('')
            }}
          >
            Gửi mã
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
