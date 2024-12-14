
function pascals_triangle(row: number, column: number) {
  // (row n, column k) is (row n, column (k - 1)) * (n + 1 - k) / k
  let acc = 1
  for (let cell=1; cell <= column; ++cell) {
    acc *= (row + 1 - cell) / cell
  }
  return acc
}

export async function main(ns: NS): Promise<void> {
  for (let r=0; r <= 7; ++r) {
    for (let c=0; c <= 7 && c <= r; ++c) {
      ns.tprint(`pascals_triangle(${r}, ${c}) = ${pascals_triangle(r, c)}`);
    }
  }
}