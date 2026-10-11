import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import api from "@/api/axiosClient";
import { errFieldErrors, errMessage } from "@/api/axiosClient";
import { getSchools } from "@/api/listingApi";
import type { School } from "@/types/api";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Input, Textarea } from "@/ui/input";
import { Avatar } from "@/ui/avatar";
import { toast } from "@/ui/toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useEffect } from "react";

const SLEEP_OPTIONS = [
  { value: "early", label: "Ngủ sớm" },
  { value: "normal", label: "Bình thường" },
  { value: "late", label: "Ngủ muộn" },
] as const;

const PERSONALITY_OPTIONS = [
  { value: "introvert", label: "Hướng nội" },
  { value: "ambivert", label: "Trung tính" },
  { value: "extrovert", label: "Hướng ngoại" },
] as const;

interface ProfileFormState {
  name: string;
  phone: string;
  bio: string;
  school_id: string;
  budget_min: string;
  budget_max: string;
  sleep_schedule: string;
  cleanliness: string;
  smoking: boolean;
  personality: string;
  interests: string;
}

export default function Profile() {
  useDocumentTitle("Hồ sơ · TROSV");
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");

  // Render-phase reset (same idiom as useConversationData): seed the
  // form when the user first loads or switches account, without a
  // synchronous setState inside an effect. Edits are kept while the id
  // matches, so saving (refreshUser) never wipes a dirty form.
  const [lastUserId, setLastUserId] = useState<number | null>(null);
  if (user && (form === null || lastUserId !== user.id)) {
    setLastUserId(user.id);
    setForm({
      name: user.name,
      phone: user.phone ?? "",
      bio: user.bio ?? "",
      school_id: user.school_id != null ? String(user.school_id) : "",
      budget_min: user.budget_min != null ? String(user.budget_min) : "",
      budget_max: user.budget_max != null ? String(user.budget_max) : "",
      sleep_schedule: user.sleep_schedule ?? "",
      cleanliness: user.cleanliness != null ? String(user.cleanliness) : "",
      smoking: user.smoking === true,
      personality: user.personality ?? "",
      interests: user.interests ?? "",
    });
  }

  useEffect(() => {
    getSchools().then(setSchools).catch(() => {});
  }, []);

  if (!user || !form) return null;
  const isStudent = user.role === "student";
  /* The null check above has narrowed `form` for all code that follows,
     but TS loses it inside callbacks; capture a non-null alias. */
  const formValue = form;

  function set<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]): void {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setFormError("");
    const payload: Record<string, unknown> = {
      name: formValue.name.trim(),
      phone: formValue.phone.trim() || undefined,
      bio: formValue.bio.trim() || undefined,
    };
    if (isStudent) {
      if (formValue.school_id) payload["school_id"] = Number(formValue.school_id);
      if (formValue.budget_min) payload["budget_min"] = Number(formValue.budget_min);
      if (formValue.budget_max) payload["budget_max"] = Number(formValue.budget_max);
      if (formValue.sleep_schedule) payload["sleep_schedule"] = formValue.sleep_schedule;
      if (formValue.cleanliness) payload["cleanliness"] = Number(formValue.cleanliness);
      payload["smoking"] = formValue.smoking;
      if (formValue.personality) payload["personality"] = formValue.personality;
      if (formValue.interests.trim()) payload["interests"] = formValue.interests.trim();
    }
    try {
      await api.put("/profile", payload);
      await refreshUser();
      toast("Đã lưu hồ sơ.");
    } catch (err) {
      setFieldErrors(errFieldErrors(err));
      setFormError(errMessage(err, "Không lưu được hồ sơ. Bạn thử lại nhé."));
    } finally {
      setBusy(false);
    }
  }

  const err = (field: string): string | undefined => fieldErrors[field]?.[0];

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={user.name} size={56} />
        <div>
          <h1 className="text-3xl">{isStudent ? "Hồ sơ của bạn" : "Hồ sơ chủ nhà"}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </div>

      <form onSubmit={(e) => { void save(e); }} className="flex flex-col gap-4">
        {formError ? (
          <p role="alert" className="rounded-xl bg-clay-tint p-3 text-sm text-ink">
            {formError}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="p-name" label="Tên" error={err("name")}>
            <Input id="p-name" value={formValue.name} onChange={(e) => { set("name", e.target.value); }} />
          </Field>
          <Field id="p-phone" label="Số điện thoại" error={err("phone")}>
            <Input
              id="p-phone"
              type="tel"
              value={formValue.phone}
              onChange={(e) => { set("phone", e.target.value); }}
              placeholder="0901234567"
            />
          </Field>
        </div>
        <Field id="p-bio" label="Giới thiệu" hint="Một vài dòng để người khác hiểu về bạn" error={err("bio")}>
          <Textarea
            id="p-bio"
            value={formValue.bio}
            onChange={(e) => { set("bio", e.target.value); }}
            rows={4}
          />
        </Field>

        {isStudent ? (
          <div className="flex flex-col gap-4 rounded-3xl border border-line bg-ivory p-6">
            <h2 className="text-xl font-semibold">Sinh hoạt</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-school" label="Trường" error={err("school_id")}>
                <select
                  id="p-school"
                  value={formValue.school_id}
                  onChange={(e) => { set("school_id", e.target.value); }}
                  className="h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-base"
                >
                  <option value="">Chưa chọn</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="p-personality" label="Tính cách" error={err("personality")}>
                <select
                  id="p-personality"
                  value={formValue.personality}
                  onChange={(e) => { set("personality", e.target.value); }}
                  className="h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-base"
                >
                  <option value="">Chưa chọn</option>
                  {PERSONALITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="p-budget-min" label="Ngân sách tối thiểu" error={err("budget_min")}>
                <Input
                  id="p-budget-min"
                  type="number"
                  min={0}
                  value={formValue.budget_min}
                  onChange={(e) => { set("budget_min", e.target.value); }}
                  placeholder="1.500.000"
                />
              </Field>
              <Field id="p-budget-max" label="Ngân sách tối đa" error={err("budget_max")}>
                <Input
                  id="p-budget-max"
                  type="number"
                  min={0}
                  value={formValue.budget_max}
                  onChange={(e) => { set("budget_max", e.target.value); }}
                  placeholder="3.000.000"
                />
              </Field>
              <Field id="p-sleep" label="Giờ ngủ" error={err("sleep_schedule")}>
                <select
                  id="p-sleep"
                  value={formValue.sleep_schedule}
                  onChange={(e) => { set("sleep_schedule", e.target.value); }}
                  className="h-12 w-full rounded-xl border border-line-strong bg-white px-4 text-base"
                >
                  <option value="">Chưa chọn</option>
                  {SLEEP_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                id="p-cleanliness"
                label="Độ sạch sẽ (1–5)"
                error={err("cleanliness")}
              >
                <Input
                  id="p-cleanliness"
                  type="number"
                  min={1}
                  max={5}
                  value={formValue.cleanliness}
                  onChange={(e) => { set("cleanliness", e.target.value); }}
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={formValue.smoking}
                onChange={(e) => { set("smoking", e.target.checked); }}
                className="size-4 rounded"
              />
              Tôi hút thuốc
            </label>
            <Field
              id="p-interests"
              label="Sở thích"
              hint="Ngăn cách bằng dấu phẩy, ví dụ: music,gym"
              error={err("interests")}
            >
              <Input
                id="p-interests"
                value={formValue.interests}
                onChange={(e) => { set("interests", e.target.value); }}
                placeholder="music, gym, đọc sách"
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={user.looking_for_roommate === true}
                onChange={() => {
                  /* looking_for_roommate toggles via same /profile PUT */
                  toast("Dùng mục Sở thích và hồ sơ để bật/tắt tìm bạn cùng phòng.");
                }}
                className="size-4"
                disabled
              />
              Tìm bạn cùng phòng (bật qua trợ lý AI)
            </label>
          </div>
        ) : null}

        <Button type="submit" variant="clay" loading={busy} className="mt-2 w-full sm:w-auto">
          Lưu thay đổi
        </Button>
      </form>
    </div>
  );
}
