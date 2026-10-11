import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/constants/routes";
import { errFieldErrors, errMessage } from "@/api/axiosClient";
import { useAuthForm } from "@/hooks/useAuthForm";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { AuthSplit } from "@/pages/AuthSplit";
import { PasswordInput } from "@/ui/password-input";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { RegisterPayload, UserRole } from "@/types/api";

export default function Register() {
  useDocumentTitle("Đăng ký · TROSV");
  const { register } = useAuth();
  const navigate = useNavigate();
  const role: UserRole = "student";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [pickedRole, setPickedRole] = useState<"student" | "landlord">(role);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");

  async function submit(): Promise<void> {
    setFieldErrors({});
    setFormError("");
    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: ["Mật khẩu nhập lại chưa khớp."] });
      throw new Error("Mật khẩu chưa khớp");
    }
    const payload: RegisterPayload = {
      name: name.trim(),
      email: email.trim(),
      password,
      password_confirmation: passwordConfirmation,
      role: pickedRole,
    };
    await register(payload);
    void navigate(ROUTES.HOME, { replace: true });
  }

  const form = useAuthForm({
    submit,
    onError: (err) => {
      setFieldErrors(errFieldErrors(err));
      setFormError(errMessage(err, "Đăng ký không thành công. Bạn thử lại nhé."));
    },
  });

  /* Vietnamese inline validation messages mapped from 422 errors per field. */
  const err = (field: string): string | undefined => fieldErrors[field]?.[0];

  return (
    <AuthSplit artSrc="/art/house-and-tree.svg" title="Tạo tài khoản" artTestId="register-art">
      <form onSubmit={(e) => { void form.handleSubmit(e); }} className="flex flex-col gap-4">
        {formError ? (
          <p role="alert" className="rounded-xl bg-clay-tint p-3 text-sm text-ink">
            {formError}
          </p>
        ) : null}
        <fieldset className="flex gap-2" aria-label="Chọn vai trò">
          {(
            [
              { value: "student", label: "Tôi tìm phòng" },
              { value: "landlord", label: "Tôi cho thuê" },
            ] as const
          ).map((r, i) => (
            <label
              key={r.value}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-clay",
                i === 0 ? "wobble-b" : "wobble-c",
                pickedRole === r.value
                  ? "border-ink bg-ink font-bold text-white"
                  : "border-line-strong bg-white text-ink hover:bg-ivory"
              )}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={pickedRole === r.value}
                onChange={() => { setPickedRole(r.value); }}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <Field id="name" label="Tên" error={err("name")} required>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => { setName(e.target.value); }}
            invalid={!!err("name")}
          />
        </Field>
        <Field id="email" label="Email" error={err("email")} required>
          <Input
            id="email"
            className="wobble-b"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); }}
            invalid={!!err("email")}
          />
        </Field>
        <Field
          id="password"
          label="Mật khẩu"
          error={err("password")}
          required
        >
          <PasswordInput
            id="password"
            className="wobble-c"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); }}
            invalid={!!err("password")}
          />
        </Field>
        <PasswordChecklist password={password} confirmation={passwordConfirmation} />
        <Field id="password_confirmation" label="Nhập lại mật khẩu" error={err("password_confirmation")} required>
          <PasswordInput
            id="password_confirmation"
            className="wobble-d"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(e) => { setPasswordConfirmation(e.target.value); }}
            invalid={!!err("password_confirmation")}
          />
        </Field>
        <Button type="submit" variant="clay" loading={form.busy} className="mt-2 w-full">
          Tạo tài khoản
        </Button>
        <p className="text-center text-sm text-muted">
          Đã có tài khoản?{" "}
          <Link to={ROUTES.LOGIN} className="font-medium text-ink underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthSplit>
  );
}

/* Live password checklist (Zillow lists "Your password must contain:").
   Purely client-side guidance; the server still validates on submit. */
function PasswordChecklist({
  password,
  confirmation,
}: {
  password: string;
  confirmation: string;
}) {
  const checks = [
    { ok: password.length >= 8, label: "Tối thiểu 8 ký tự" },
    {
      ok: password !== "" && password === confirmation,
      label: "Hai mật khẩu khớp nhau",
    },
  ];
  return (
    <ul className="flex flex-col gap-1" aria-live="polite">
      {checks.map((c) => (
        <li
          key={c.label}
          className={cn(
            "flex items-center gap-2 text-xs",
            c.ok ? "font-medium text-ink" : "text-muted"
          )}
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-full border",
              c.ok ? "border-olive bg-olive text-black" : "border-line-strong text-transparent"
            )}
            aria-hidden
          >
            <Check className="size-3" />
          </span>
          {c.label}
        </li>
      ))}
    </ul>
  );
}
