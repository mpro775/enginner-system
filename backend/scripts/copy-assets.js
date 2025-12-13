const fs = require("fs");
const path = require("path");

// Copy from src/assets to dist/assets
const srcAssetsDir = path.join(__dirname, "..", "src", "assets");
const destAssetsDir = path.join(__dirname, "..", "dist", "assets");

// Copy templates to dist/modules/reports/templates
const srcTemplatesDir = path.join(__dirname, "..", "src", "modules", "reports", "templates");
const destTemplatesDir = path.join(__dirname, "..", "dist", "modules", "reports", "templates");

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

console.log("📋 Copying assets and templates to dist folder...");

// Copy assets
if (fs.existsSync(srcAssetsDir)) {
  copyRecursiveSync(srcAssetsDir, destAssetsDir);
  console.log("✅ Assets copied successfully!");
} else {
  console.log("⚠️  No assets folder found, skipping assets copy.");
}

// Copy templates
if (fs.existsSync(srcTemplatesDir)) {
  copyRecursiveSync(srcTemplatesDir, destTemplatesDir);
  console.log("✅ Templates copied successfully!");
} else {
  console.log("⚠️  No templates folder found, skipping templates copy.");
}
