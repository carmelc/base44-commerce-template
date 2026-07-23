# Images & downloadable files

- **Catalog images** — the admin `MediaUploader` uses `base44.integrations.Core.UploadFile({ file })` → public URL, stored in `product.images[]` / `variation.image`.
- **Downloadable products** — store files as the download's `file_url`. For private files, upload with `Core.UploadPrivateFile` (stores a `file_uri`, not an `http` URL). `commerce/storefront-account` `get-download` detects non-`http` URIs and returns a short-lived signed URL via `Core.CreateFileSignedUrl` (1-hour expiry), decrementing `downloads_remaining` and enforcing `access_expires`.
