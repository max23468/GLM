import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const bindingPath = "excel-vba/vba-source-binding.json";
const sourceDirectory = "excel-vba/src";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function verifyVbaSourceBinding(workbookPath) {
  const binding = JSON.parse(readFileSync(bindingPath, "utf8"));
  const sourcePaths = readdirSync(sourceDirectory)
    .filter((name) => /\.(bas|cls|frm)$/i.test(name))
    .map((name) => `${sourceDirectory}/${name}`)
    .sort();
  const boundPaths = Object.keys(binding.modules ?? {}).sort();
  if (JSON.stringify(sourcePaths) !== JSON.stringify(boundPaths)) {
    throw new Error("Binding VBA non allineato all'inventario dei moduli sorgente");
  }
  for (const sourcePath of sourcePaths) {
    if (sha256(readFileSync(sourcePath)) !== binding.modules[sourcePath]) {
      throw new Error(`Sorgente VBA non coerente con il binding revisionato: ${sourcePath}`);
    }
  }
  const vbaProject = execFileSync("unzip", ["-p", workbookPath, "xl/vbaProject.bin"]);
  if (sha256(vbaProject) !== binding.vbaProjectSha256) {
    throw new Error("Progetto VBA incorporato non coerente con il binding revisionato");
  }
}
