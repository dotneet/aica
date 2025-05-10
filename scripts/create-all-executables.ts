import { $ } from "bun";
import packageJson from "../package.json";

const version = packageJson.version;

await $`bun build --compile --outfile dist/aica-linux-x64-v${version} --target bun-linux-x64-baseline src/main.ts`;
await $`bun build --compile --outfile dist/aica-linux-arm64-v${version} --target bun-linux-arm64-baseline src/main.ts`;
await $`bun build --compile --outfile dist/aica-darwin-x64-v${version} --target bun-darwin-x64-baseline src/main.ts`;
await $`bun build --compile --outfile dist/aica-darwin-arm64-v${version} --target bun-darwin-arm64-baseline src/main.ts`;
