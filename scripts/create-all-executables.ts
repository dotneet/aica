import { $ } from "bun";
import packageJson from "../package.json";

const version = packageJson.version;

await $`bun build --compile --outfile dist/aica-v${version}-linux-x64 --target bun-linux-x64-baseline src/main.ts`;
await $`bun build --compile --outfile dist/aica-v${version}-linux-arm64 --target bun-linux-arm64-baseline src/main.ts`;
await $`bun build --compile --outfile dist/aica-v${version}-darwin-x64 --target bun-darwin-x64-baseline src/main.ts`;
await $`bun build --compile --outfile dist/aica-v${version}-darwin-arm64 --target bun-darwin-arm64-baseline src/main.ts`;
