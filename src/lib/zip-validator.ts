import AdmZip from "adm-zip";
import path from "path";
import mime from "mime-types";

// Security constants for uploaded static site ZIP archives
export const MAX_ZIP_BYTES = 25 * 1024 * 1024; // 25 MB max upload size
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MB max extracted size (blocks zip bombs)
export const MAX_FILE_COUNT = 250; // Max 250 files per site

// Block server-side scripts, executables, and sensitive config files
const BLOCKED_EXTENSIONS = new Set([
  ".php", ".phtml", ".phar", ".exe", ".sh", ".bash", ".zsh", ".bat", ".cmd",
  ".ps1", ".dll", ".so", ".dylib", ".bin", ".py", ".pyc", ".rb", ".pl",
  ".cgi", ".jsp", ".asp", ".aspx", ".jar", ".war", ".msi", ".com", ".scr",
  ".env", ".pem", ".key", ".sqlite", ".db"
]);

// Allow only safe static web asset extensions
const ALLOWED_EXTENSIONS = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".png", ".jpg",
  ".jpeg", ".gif", ".webp", ".ico", ".avif", ".woff", ".woff2", ".ttf",
  ".otf", ".txt", ".xml", ".webmanifest", ".map"
]);

export interface ExtractedSiteFile {
  relativePath: string;
  contentType: string;
  data: Buffer;
  size: number;
}

export interface ZipValidationResult {
  valid: boolean;
  error?: string;
  files?: ExtractedSiteFile[];
  totalBytes?: number;
}

export function validateAndExtractZip(buffer: Buffer): ZipValidationResult {
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    return { valid: false, error: "ZIP exceeds maximum size of 25 MB." };
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { valid: false, error: "Invalid or corrupted ZIP archive." };
  }

  const entries = zip.getEntries();
  const rawFiles: { rawName: string; data: Buffer }[] = [];
  let totalBytes = 0;

  for (const entry of entries) {
    const rawName = entry.entryName.replace(/\\/g, "/");

    // 1. Zip-Slip & Path Traversal Protection:
    // Reject any entry containing `..`, starting with `/`, containing null bytes, or drive letters.
    if (
      rawName.includes("\0") ||
      rawName.startsWith("/") ||
      rawName.includes("../") ||
      rawName.includes("/..") ||
      rawName === ".." ||
      /^[a-zA-Z]:/.test(rawName)
    ) {
      return {
        valid: false,
        error: `Security error: Path traversal detected in entry "${rawName}".`
      };
    }

    const normalized = path.posix.normalize(rawName);
    if (normalized.startsWith("..") || normalized.startsWith("/")) {
      return {
        valid: false,
        error: `Security error: Unsafe normalized path "${normalized}".`
      };
    }

    if (entry.isDirectory) {
      continue;
    }

    // Ignore macOS Finder metadata files
    if (normalized.startsWith("__MACOSX/") || normalized.endsWith(".DS_Store")) {
      continue;
    }

    if (rawFiles.length + 1 > MAX_FILE_COUNT) {
      return {
        valid: false,
        error: `ZIP contains too many files (maximum ${MAX_FILE_COUNT} allowed).`
      };
    }

    const ext = path.posix.extname(normalized).toLowerCase();
    const baseName = path.posix.basename(normalized).toLowerCase();

    if (BLOCKED_EXTENSIONS.has(ext) || baseName === ".env" || baseName.startsWith(".ht")) {
      return {
        valid: false,
        error: `Security error: Blocked server-side or executable file "${normalized}".`
      };
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Unsupported file type "${ext}" in "${normalized}". Static web files only.`
      };
    }

    // Check declared uncompressed size before decompressing into memory to block zip bombs early
    const declaredSize = entry.header?.size ?? 0;
    if (declaredSize < 0 || totalBytes + declaredSize > MAX_UNCOMPRESSED_BYTES) {
      return {
        valid: false,
        error: "Uncompressed site exceeds 50 MB limit."
      };
    }

    const data = entry.getData();
    totalBytes += data.byteLength;
    if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
      return {
        valid: false,
        error: "Uncompressed site exceeds 50 MB limit."
      };
    }

    rawFiles.push({ rawName: normalized, data });
  }

  if (rawFiles.length === 0) {
    return { valid: false, error: "ZIP archive is empty." };
  }

  // If the user zipped a single top-level folder (e.g., `dist/index.html`), strip that common prefix
  // so `index.html` sits cleanly at the root.
  let finalPaths = rawFiles.map((f) => f.rawName);
  const hasRootIndex = finalPaths.includes("index.html");
  if (!hasRootIndex) {
    const firstSegments = new Set(finalPaths.map((p) => p.split("/")[0]));
    if (firstSegments.size === 1) {
      const prefix = `${Array.from(firstSegments)[0]}/`;
      if (finalPaths.every((p) => p.startsWith(prefix))) {
        finalPaths = finalPaths.map((p) => p.slice(prefix.length));
      }
    }
  }

  if (!finalPaths.includes("index.html")) {
    return {
      valid: false,
      error: "ZIP must contain an index.html file at the root (or inside a single top-level folder)."
    };
  }

  const extractedFiles: ExtractedSiteFile[] = rawFiles.map((file, idx) => {
    const relPath = finalPaths[idx];
    const detectedMime = mime.lookup(relPath) || "application/octet-stream";
    return {
      relativePath: relPath,
      contentType: detectedMime,
      data: file.data,
      size: file.data.byteLength
    };
  });

  return {
    valid: true,
    files: extractedFiles,
    totalBytes
  };
}