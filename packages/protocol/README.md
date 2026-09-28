EIP-712 message types, signing and verification for Bellstate's attestation protocol (PRD §6).

Domain, struct type strings and enum orderings are pinned exactly to §6.2 and the ERC-8392
appendices so digests match `packages/contracts`' `BellstateHub` byte-for-byte. `build.ts`
converts `packages/engine`'s derived states (string enums) into the numeric structs signers sign.

## Not specified in the PRD

- `sourceMarketStatus`'s enum ordering isn't given in any appendix (it's a Bellstate extension
  field, §3.7, not part of ERC-8392). `enums.ts` assumes `UNKNOWN = 0, OPEN = 1, CLOSED = 2`,
  following the convention every other Bellstate enum uses — flag if the team has a different
  onchain ordering in mind.
- `PrimaryUpdate` has one `primaryReason` field for two legs (issuance/redemption) that can each
  carry a different reason. `build.ts` takes the issuance leg's reason unless it's `NONE`, in
  which case it falls back to the redemption leg's. Worth confirming against the team's intent
  since the PRD's struct doesn't disambiguate.
