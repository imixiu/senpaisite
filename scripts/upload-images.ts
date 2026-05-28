import { put } from "@vercel/blob";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

interface ImageTask {
  key: string;
  sourceUrl: string;
  blobUrl?: string;
}

async function downloadAndUpload(sourceUrl: string, filename: string): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";

  const blob = await put(filename, buffer, {
    access: "public",
    contentType,
  });

  return blob.url;
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN is not set in .env.local");
    console.error("Get it from: Vercel Dashboard > Project > Storage > Blob > Tokens");
    process.exit(1);
  }

  const dataPath = path.join(__dirname, "seed-data.json");
  const data = JSON.parse(readFileSync(dataPath, "utf-8"));
  const siteName = data.site || "site";

  let updated = false;

  // Upload article cover images
  if (data.articles) {
    for (let i = 0; i < data.articles.length; i++) {
      const article = data.articles[i];
      if (article.img && article.img.includes("aliyuncs.com")) {
        console.log(`Uploading cover: ${article.short_title}...`);
        try {
          const blobUrl = await downloadAndUpload(
            article.img,
            `${siteName}/covers/${article.short_title}.png`
          );
          data.articles[i].img = blobUrl;
          updated = true;
          console.log(`  -> ${blobUrl}`);
        } catch (e: any) {
          console.error(`  Failed: ${e.message}`);
        }
      }
    }
  }

  // Upload author avatars
  if (data.authors) {
    for (let i = 0; i < data.authors.length; i++) {
      const author = data.authors[i];
      if (author.img && author.img.includes("aliyuncs.com")) {
        console.log(`Uploading avatar: ${author.slug}...`);
        try {
          const blobUrl = await downloadAndUpload(
            author.img,
            `${siteName}/avatars/${author.slug}.png`
          );
          data.authors[i].img = blobUrl;
          updated = true;
          console.log(`  -> ${blobUrl}`);
        } catch (e: any) {
          console.error(`  Failed: ${e.message}`);
        }
      }
    }
  }

  // Upload any inline images referenced in article bodies
  if (data.articles) {
    const ossUrlRegex = /https:\/\/dashscope-result[^"'\s)]+/g;
    for (let i = 0; i < data.articles.length; i++) {
      const article = data.articles[i];
      if (!article.body) continue;

      const matches = article.body.match(ossUrlRegex);
      if (!matches) continue;

      for (const ossUrl of matches) {
        console.log(`Uploading inline image for: ${article.short_title}...`);
        try {
          const imgId = `inline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const blobUrl = await downloadAndUpload(
            ossUrl,
            `${siteName}/inline/${article.short_title}/${imgId}.png`
          );
          data.articles[i].body = data.articles[i].body.replace(ossUrl, blobUrl);
          updated = true;
          console.log(`  -> ${blobUrl}`);
        } catch (e: any) {
          console.error(`  Failed: ${e.message}`);
        }
      }
    }
  }

  if (updated) {
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log("\nUpdated seed-data.json with Vercel Blob URLs.");
    console.log("Run `npm run seed` to write updated URLs to database.");
  } else {
    console.log("\nNo temporary URLs found to upload.");
  }
}

main().catch((e) => {
  console.error("Upload failed:", e);
  process.exit(1);
});
