import { SubmitButton } from "@/components/ui/submit-button";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

type SellerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  seller?: {
    id: string;
    name: string;
    inn: string;
    kpp: string | null;
    ogrn: string | null;
    legalAddress: string | null;
    bankDetails: Record<string, string> | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    commissionRate: string;
    status: "active" | "inactive";
  };
  sellerAccount?: {
    email: string;
  } | null;
  submitText: string;
};

function getBankDetailsText(bankDetails?: Record<string, string> | null) {
  return bankDetails?.raw ?? "";
}

export function SellerForm({
  action,
  seller,
  sellerAccount,
  submitText,
}: SellerFormProps) {
  const defaultSellerUserEmail = sellerAccount?.email ?? seller?.email ?? "";

  return (
    <form action={action} className="grid gap-5">
      {seller ? <input name="sellerId" type="hidden" value={seller.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Название продавца
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.name ?? ""}
            name="name"
            placeholder="ООО Поставщик"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          ИНН
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.inn ?? ""}
            inputMode="numeric"
            maxLength={12}
            minLength={10}
            name="inn"
            pattern="[0-9]{10}|[0-9]{12}"
            placeholder="7702000001"
            required
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          КПП
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.kpp ?? ""}
            inputMode="numeric"
            maxLength={9}
            name="kpp"
            pattern="[0-9]{9}"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          ОГРН
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.ogrn ?? ""}
            inputMode="numeric"
            maxLength={15}
            name="ogrn"
            pattern="[0-9]{13}|[0-9]{15}"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Комиссия, %
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.commissionRate ?? "5.00"}
            inputMode="numeric"
            max="100"
            min="0"
            name="commissionRate"
            required
            step="1"
            type="number"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Юридический адрес
        <textarea
          className="min-h-24 rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
          defaultValue={seller?.legalAddress ?? ""}
          name="legalAddress"
        />
      </label>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Банковские реквизиты
        <textarea
          className="min-h-28 rounded-lg border border-slate-200 px-4 py-3 font-normal text-slate-950"
          defaultValue={getBankDetailsText(seller?.bankDetails)}
          name="bankDetails"
          placeholder="Расчетный счет, банк, БИК, корр. счет"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Контактное лицо
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.contactName ?? ""}
            name="contactName"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Email
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.email ?? ""}
            name="email"
            type="email"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Телефон
          <input
            className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
            defaultValue={seller?.phone ?? ""}
            name="phone"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Статус
        <select
          className="h-12 rounded-lg border border-slate-200 px-4 font-normal text-slate-950"
          defaultValue={seller?.status ?? "active"}
          name="status"
        >
          <option value="active">Активен</option>
          <option value="inactive">Неактивен</option>
        </select>
      </label>

      <section className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-950">
            Доступ продавца
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {sellerAccount
              ? "Аккаунт продавца уже создан."
              : "Заполните email и пароль, чтобы создать аккаунт продавца."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Email для входа
            <input
              autoComplete="username"
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 font-normal text-slate-950"
              defaultValue={defaultSellerUserEmail}
              name="sellerUserEmail"
              placeholder="seller@example.com"
              type="email"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            {sellerAccount ? "Новый пароль" : "Пароль"}
            <input
              autoComplete="new-password"
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 font-normal text-slate-950"
              minLength={PASSWORD_MIN_LENGTH}
              name="sellerPassword"
              placeholder={sellerAccount ? "Оставьте пустым без изменений" : ""}
              type="password"
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton
          className="h-12 rounded-lg bg-[#1157ff] px-5 text-sm font-bold text-white transition hover:bg-[#0b49e0]"
          pendingText="Сохраняем"
        >
          {submitText}
        </SubmitButton>
      </div>
    </form>
  );
}
