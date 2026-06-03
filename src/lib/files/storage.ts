import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type StorageWriteOptions = {
  contentType?: string;
};

type S3StorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

let s3Client: S3Client | null = null;

function getEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

function getS3StorageConfig(): S3StorageConfig | null {
  const endpoint = getEnvValue("S3_ENDPOINT");
  const bucket = getEnvValue("S3_BUCKET");
  const accessKeyId = getEnvValue("S3_ACCESS_KEY_ID");
  const secretAccessKey = getEnvValue("S3_SECRET_ACCESS_KEY");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: getEnvValue("S3_REGION") ?? "auto",
  };
}

function requireS3StorageConfig() {
  const config = getS3StorageConfig();

  if (!config) {
    throw new Error(
      "S3 storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  return config;
}

function getS3Client(config: S3StorageConfig) {
  s3Client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return s3Client;
}

export function isS3StorageEnabled() {
  return getS3StorageConfig() !== null;
}

export function getPublicStorageUrl(storageKey: string) {
  const publicUrl = getEnvValue("S3_PUBLIC_URL");

  if (!publicUrl) {
    return null;
  }

  let storagePrefix = "";
  const endpoint = getEnvValue("S3_ENDPOINT");

  if (endpoint) {
    try {
      storagePrefix = new URL(endpoint).pathname.replace(/^\/+|\/+$/g, "");
    } catch {
      storagePrefix = "";
    }
  }

  try {
    const publicPath = new URL(publicUrl).pathname.replace(/^\/+|\/+$/g, "");
    if (storagePrefix && publicPath.endsWith(storagePrefix)) {
      storagePrefix = "";
    }
  } catch {
    storagePrefix = "";
  }

  const key = [storagePrefix, storageKey.replace(/^\/+/, "")]
    .filter(Boolean)
    .join("/");

  return `${publicUrl.replace(/\/+$/, "")}/${key}`;
}

export async function writeStorageFile(
  storageKey: string,
  bytes: Uint8Array,
  options: StorageWriteOptions = {},
) {
  const config = requireS3StorageConfig();
  await getS3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: Buffer.from(bytes),
      ContentType: options.contentType ?? "application/octet-stream",
    }),
  );

  return {
    sizeBytes: bytes.byteLength,
    storageProvider: "s3" as const,
  };
}

async function bodyToBuffer(body: unknown) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  const transformable = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };

  if (typeof transformable.transformToByteArray === "function") {
    return Buffer.from(await transformable.transformToByteArray());
  }

  if (typeof transformable.arrayBuffer === "function") {
    return Buffer.from(await transformable.arrayBuffer());
  }

  const chunks: Uint8Array[] = [];

  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function isS3NotFoundError(error: unknown) {
  const name = (error as { name?: string })?.name;
  const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;

  return name === "NoSuchKey" || name === "NotFound" || statusCode === 404;
}

export function isStorageFileNotFoundError(error: unknown) {
  return isS3NotFoundError(error);
}

export async function readStorageFile(storageKey: string) {
  const config = requireS3StorageConfig();
  const response = await getS3Client(config).send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );

  return bodyToBuffer(response.Body);
}
