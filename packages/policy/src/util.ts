/** Solidity 0.8.26 uses checked arithmetic — `a - b` reverts on underflow. Mirrored here as a
 * throw so a parity fuzz test that keeps inputs ordered (nowTs after every `since`/`at` value)
 * never hits this path on either side; see README.md for why unordered-time inputs are out of
 * the parity fuzz's scope. */
export function sub64(a: bigint, b: bigint): bigint {
  if (a < b) throw new RangeError(`uint64 underflow: ${a} - ${b}`);
  return a - b;
}
