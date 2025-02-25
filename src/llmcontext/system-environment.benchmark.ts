import { join } from "node:path";
import { listFiles } from "./system-environment";

// Function for benchmarking
async function runBenchmark() {
  console.log("Running listFiles benchmark...");

  // Run listFiles in the current directory
  const cwd = process.cwd();

  // Measure execution time
  console.time("listFiles");
  const result = listFiles(cwd, 1000);
  console.timeEnd("listFiles");

  console.log(`Found ${result.files.length} files`);
  console.log(`Hit limit: ${result.didHitLimit}`);
}

// Run the benchmark
runBenchmark().catch(console.error);
