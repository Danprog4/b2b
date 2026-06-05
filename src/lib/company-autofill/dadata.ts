type DadataPartySuggestion = {
  data?: {
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    type?: "LEGAL" | "INDIVIDUAL" | string | null;
    name?: {
      full_with_opf?: string | null;
      short_with_opf?: string | null;
    } | null;
    fio?: {
      source?: string | null;
    } | null;
    management?: {
      name?: string | null;
    } | null;
    address?: {
      unrestricted_value?: string | null;
      value?: string | null;
    } | null;
    state?: {
      status?: string | null;
    } | null;
  } | null;
};

type DadataPartyResponse = {
  suggestions?: DadataPartySuggestion[];
};

export type CompanyAutofillResult = {
  type: "ooo" | "ip";
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  directorName: string;
  legalAddress: string;
  status: string | null;
};

function getCompanyType(type: string | null | undefined): "ooo" | "ip" {
  return type === "INDIVIDUAL" ? "ip" : "ooo";
}

function getRequestType(type: string | null) {
  if (type === "ooo") {
    return "LEGAL";
  }

  if (type === "ip") {
    return "INDIVIDUAL";
  }

  return undefined;
}

function getToken() {
  const provider = process.env.INN_PROVIDER?.trim().toLowerCase();

  if (provider && provider !== "dadata") {
    return undefined;
  }

  return (
    process.env.DADATA_API_KEY?.trim() ||
    process.env.DADATA_TOKEN?.trim() ||
    process.env.INN_API_KEY?.trim()
  );
}

export function isCompanyAutofillConfigured() {
  return Boolean(getToken());
}

export async function findCompanyByInn(
  inn: string,
  type: string | null,
): Promise<CompanyAutofillResult | null> {
  const token = getToken();

  if (!token) {
    throw new Error("dadata_not_configured");
  }

  const response = await fetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: inn,
        count: 1,
        type: getRequestType(type),
        status: ["ACTIVE"],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`dadata_request_failed:${response.status}`);
  }

  const payload = (await response.json()) as DadataPartyResponse;
  const party = payload.suggestions?.[0]?.data;

  if (!party?.inn) {
    return null;
  }

  return {
    type: getCompanyType(party.type),
    name:
      party.name?.short_with_opf ||
      party.name?.full_with_opf ||
      party.fio?.source ||
      "",
    inn: party.inn,
    kpp: party.kpp ?? "",
    ogrn: party.ogrn ?? "",
    directorName: party.management?.name ?? "",
    legalAddress:
      party.address?.unrestricted_value || party.address?.value || "",
    status: party.state?.status ?? null,
  };
}
