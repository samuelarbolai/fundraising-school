const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export function getEmailRedirectUrl() {
  if (typeof window === "undefined") {
    return SITE_URL;
  }

  const { origin, pathname, search, hash } = window.location;
  const current = `${origin}${pathname}${search}${hash}`;

  if (!SITE_URL || SITE_URL.includes("localhost")) {
    return current;
  }

  return `${SITE_URL}${pathname}${search}${hash}`;
}
