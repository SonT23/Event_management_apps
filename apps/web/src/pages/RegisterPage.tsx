import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { apiJson } from '@/lib/api'
import { formatApiError } from '@/lib/formatApiError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Dept = { id: number; code: string; name: string }

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Dept[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState<string>('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let ok = true
    ;(async () => {
      try {
        const rows = await apiJson<Dept[]>('/org/departments')
        if (ok) {
          setDepartments(rows)
        }
      } catch {
        // bỏ qua: đăng ký vẫn có thể không cần ban
      }
    })()
    return () => {
      ok = false
    }
  }, [])

  if (loading) {
    return <div className="text-muted-foreground p-6 text-sm">Đang tải…</div>
  }
  if (user) {
    return <Navigate to="/app/dashboard" replace />
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        email,
        password,
        fullName,
      }
      if (primaryDepartmentId) {
        body.primaryDepartmentId = Number(primaryDepartmentId)
      }
      await register(body)
      navigate('/app/dashboard', { replace: true })
    } catch (e) {
      setErr(formatApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-muted/30 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tạo tài khoản</CardTitle>
          <CardDescription>
            Điền thông tin để tạo tài khoản và hồ sơ hội viên.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fn">Họ tên</Label>
              <Input
                id="fn"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={1}
              />
            </div>
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
              <Label htmlFor="pw">Mật khẩu (tối thiểu 8 ký tự)</Label>
              <Input
                id="pw"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {departments.length > 0 && (
              <div className="space-y-1.5">
                <Label>Ban chính (gợi ý khi gán vai trò hội viên)</Label>
                <Select
                  value={primaryDepartmentId}
                  onValueChange={setPrimaryDepartmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn ban (tùy chọn)" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {err && (
              <p className="text-destructive text-sm" role="alert">
                {err}
              </p>
            )}
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? 'Đang tạo…' : 'Đăng ký'}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Đã có tài khoản?{' '}
              <Link className="text-primary font-medium" to="/login">
                Đăng nhập
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
