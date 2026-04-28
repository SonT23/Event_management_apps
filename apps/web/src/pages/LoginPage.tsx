import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { formatApiError } from '@/lib/formatApiError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginPage() {
  const { login, user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app/dashboard'

  if (loading) {
    return <div className="text-muted-foreground p-6 text-sm">Đang tải…</div>
  }
  if (user) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (e) {
      setErr(formatApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
          <CardDescription>
            Dùng email và mật khẩu tài khoản Media Club.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="em">Email</Label>
              <Input
                id="em"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Mật khẩu</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {err && (
              <p className="text-destructive text-sm" role="alert">
                {err}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Chưa có tài khoản?{' '}
              <Link className="text-primary font-medium" to="/register">
                Đăng ký
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
