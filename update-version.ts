import fs from "fs";
import path from "path";

const manifestPath = path.resolve(__dirname, "src", "manifest.json");
const packagePath = path.resolve(__dirname, "package.json");

/**
 * Функция для инкремента версии в формате x.y.z
 */
function incrementVersion(): void {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

    const versionParts: number[] = manifest.version.split(".").map(Number);

    // Увеличиваем Patch-версию (последнее число)
    if (versionParts.length === 3) {
      versionParts[2]++;
    } else {
      // Если формат версии нестандартный, просто добавляем 1 к последнему элементу
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
