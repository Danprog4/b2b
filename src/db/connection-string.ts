function decodeRepeatedly(value: string) {
  let decoded = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);

      if (next === decoded) {
        break;
      }

      decoded = next;
    } catch {
      break;
    }
  }

  return decoded;
}

export function normalizePostgresConnectionString(value: string) {
  const match = value.match(/^(postgres(?:ql)?:\/\/)(.*)$/i);

  if (!match) {
    return value;
  }

  const [, protocol, remainder] = match;
  const separatorIndex = remainder.lastIndexOf("@");

  if (separatorIndex === -1) {
    return value;
  }

  const credentials = remainder.slice(0, separatorIndex);
  const server = remainder.slice(separatorIndex + 1);
  const passwordSeparatorIndex = credentials.indexOf(":");

  if (passwordSeparatorIndex === -1) {
    return value;
  }

  const username = credentials.slice(0, passwordSeparatorIndex);
  const password = credentials.slice(passwordSeparatorIndex + 1);

  return `${protocol}${encodeURIComponent(decodeRepeatedly(username))}:${encodeURIComponent(
    decodeRepeatedly(password),
  )}@${server}`;
}
