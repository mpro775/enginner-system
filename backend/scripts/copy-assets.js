const fs = require("fs");
const path = require("path");

// Copy from src/assets to dist/assets
const srcDir = path.join(__dirname, "..", "src", "assets");
const destDir = path.join(__dirname, "..", "dist", "assets");

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(srcDir)) {
  console.log("📋 Copying assets to dist folder...");
  copyRecursiveSync(srcDir, destDir);
  console.log("✅ Assets copied successfully!");
} else {
  console.log("⚠️  No assets folder found, skipping copy.");
}
