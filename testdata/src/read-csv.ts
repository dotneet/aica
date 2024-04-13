import fs from "fs";
export type CsvRecord = {
  id: string;
  name: string;
  age: number;
};

function readCsv(): CsvRecord[] {
  const csv = fs.readFileSync("data.csv", "utf8");
  const records = csv.split("\n").map((line) => {
    const [id, name, age] = line.split(",");
    return { id, name, age: parseInt(age, 10) };
  });
  return records;
}
