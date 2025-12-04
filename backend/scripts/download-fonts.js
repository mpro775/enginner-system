const https = require("https");
const fs = require("fs");
const path = require("path");

// Check both possible font directories
const FONTS_DIR_PRIMARY = path.join(__dirname, "..", "src", "assets", "fonts");
const FONTS_DIR_FALLBACK = path.join(__dirname, "..", "assets", "fonts");

// Cairo fonts (preferred - already added manually)
const CAIRO_FONTS = ["Cairo-Regular.ttf", "Cairo-Bold.ttf"];

// Amiri fonts (fallback download)
const AMIRI_FONTS = [
  {
    name: "Amiri-Regular.ttf",
    url: "https://github.com/amirisfonts/amiri/raw/main/Amiri-Regular.ttf",
  },
  {
    name: "Amiri-Bold.ttf",
    url: "https://github.com/amirisfonts/amiri/raw/main/Amiri-Bold.ttf",
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (urlStr) => {
      https
        .get(urlStr, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode}`));
            return;
          }

          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        })
        .on("error", (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    };

    request(url);
  });
}

function checkCairoFonts() {
  // Check primary directory (src/assets/fonts)
  const allExistPrimary = CAIRO_FONTS.every((font) =>
    fs.existsSync(path.join(FONTS_DIR_PRIMARY, font))
  );
  if (allExistPrimary) {
    return { found: true, dir: FONTS_DIR_PRIMARY };
  }

  // Check fallback directory (assets/fonts)
  const allExistFallback = CAIRO_FONTS.every((font) =>
    fs.existsSync(path.join(FONTS_DIR_FALLBACK, font))
  );
  if (allExistFallback) {
    return { found: true, dir: FONTS_DIR_FALLBACK };
  }

  return { found: false, dir: null };
}

async function main() {
  console.log("🔍 Checking for Arabic fonts...");

  // First, check if Cairo fonts already exist
  const cairoCheck = checkCairoFonts();
  if (cairoCheck.found) {
    console.log(`✅ Cairo Arabic fonts found at: ${cairoCheck.dir}`);
    console.log("⏭️  Skipping font download.");
    return;
  }

  console.log(
    "📥 Cairo fonts not found. Downloading Amiri fonts as fallback..."
  );

  // Use fallback directory for downloads
  const FONTS_DIR = FONTS_DIR_FALLBACK;

  // Create fonts directory if it doesn't exist
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
    console.log(`✅ Created directory: ${FONTS_DIR}`);
  }

  for (const font of AMIRI_FONTS) {
    const destPath = path.join(FONTS_DIR, font.name);

    if (fs.existsSync(destPath)) {
      console.log(`⏭️  Font already exists: ${font.name}`);
      continue;
    }

    try {
      console.log(`⬇️  Downloading ${font.name}...`);
      await downloadFile(font.url, destPath);
      console.log(`✅ Downloaded: ${font.name}`);
    } catch (error) {
      console.warn(`⚠️  Failed to download ${font.name}: ${error.message}`);
      console.warn("⚠️  PDF reports may not display Arabic text correctly.");
      // Don't exit with error - allow build to continue
    }
  }

  console.log("✅ Font setup complete!");
}

main().catch(console.error);
