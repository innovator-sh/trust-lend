/** Read contract events in small block ranges. Public RPCs limit the range of one log request. */
export const CHUNK = 5000;

export async function queryInChunks(contract, filter, from, to) {
  const out = [];
  for (let start = from; start <= to; start += CHUNK) {
    out.push(...await contract.queryFilter(filter, start, Math.min(start + CHUNK - 1, to)));
  }
  return out;
}

/** Block timestamps for a list of rows (one RPC call per distinct block). */
export async function addBlockTimes(provider, rows) {
  const times = {};
  for (const row of rows) {
    if (!(row.block in times)) times[row.block] = (await provider.getBlock(row.block))?.timestamp ?? null;
    row.time = times[row.block];
  }
  return rows;
}
