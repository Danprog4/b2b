export type BreadcrumbSource = {
  href: string;
  label: string;
};

export type BreadcrumbSources = Record<string, BreadcrumbSource>;

export type SearchParams = Record<string, string | string[] | undefined>;

function getStringParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return typeof value === "string" ? value : "";
}

export function getBreadcrumbSource<TSources extends BreadcrumbSources>(
  searchParams: SearchParams,
  sources: TSources,
  fallback: keyof TSources,
) {
  const source = getStringParam(searchParams, "from");

  if (source in sources) {
    return sources[source];
  }

  return sources[fallback];
}

export function withBreadcrumbSource(href: string, source: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(source)}`;
}
