import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.resolve(__dirname, "src", "manifest.json");
const packagePath = path.resolve(__dirname, "package.json");

function incrementVersion() {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    const versionParts = manifest.version.split(".").map(Number);

    if (versionParts.length === 3) {
      versionParts[2]++;
    } else {
      versionParts[versionParts.length - 1]++;
    }

    manifest.version = versionParts.join(".");
    pkg.version = manifest.version;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    console.log(`✅ Version updated to: ${manifest.version}`);
  } catch (error) {
    console.error("❌ Error updating manifest version:", error);
    process.exit(1);
  }
}

incrementVersion();
