import { describe, it, expect, beforeEach, vi } from "vitest";

interface Token {
  productId: bigint;
  owner: string;
  mintedAt: bigint;
}

interface Event {
  tokenId: bigint;
  eventType: string;
  initiator: string;
  timestamp: bigint;
}

interface Product {
  serialNumber: string;
  metadata: string;
  manufacturer: string;
  isRegistered: boolean;
  registeredAt: bigint;
}

const mockProductRegistry = {
  getProduct: vi.fn((productId: bigint) => {
    if (productId === 0n) {
      return { value: { serialNumber: "SERIAL123", metadata: "Brand:Rolex,Model:Submariner", manufacturer: "ST2CY5...", isRegistered: true, registeredAt: 100n } };
    }
    return { error: 104 };
  }),
};

const mockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  tokenIdCounter: 0n,
  registryContract: "ST2CY5...",
  tokens: new Map<bigint, Token>(),
  tokenToProductId: new Map<bigint, bigint>(),
  productToTokenId: new Map<bigint, bigint>(),
  events: new Map<bigint, Event>(),
  eventCounter: 0n,

  isAdmin(caller: string): boolean {
    return caller === this.admin;
  },

  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 200 };
    this.paused = pause;
    return { value: pause };
  },

  setRegistryContract(caller: string, registry: string): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 200 };
    if (registry === "SP000000000000000000002Q6VF78") return { error: 204 };
    this.registryContract = registry;
    return { value: true };
  },

  mintNft(caller: string, recipient: string, productId: bigint): { value: bigint } | { error: number } {
    if (this.paused) return { error: 203 };
    if (!this.isAdmin(caller)) return { error: 200 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 204 };
    if (!mockProductRegistry.getProduct(productId).value) return { error: 201 };
    if (this.productToTokenId.has(productId)) return { error: 206 };
    const tokenId = this.tokenIdCounter;
    this.tokens.set(tokenId, { productId, owner: recipient, mintedAt: BigInt(100) });
    this.tokenToProductId.set(tokenId, productId);
    this.productToTokenId.set(productId, tokenId);
    this.events.set(this.eventCounter, { tokenId, eventType: "NFT_MINTED", initiator: caller, timestamp: BigInt(100) });
    this.eventCounter++;
    this.tokenIdCounter++;
    return { value: tokenId };
  },

  transferNft(caller: string, tokenId: bigint, recipient: string): { value: boolean } | { error: number } {
    if (this.paused) return { error: 203 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 204 };
    const token = this.tokens.get(tokenId);
    if (!token) return { error: 202 };
    if (caller !== token.owner) return { error: 200 };
    this.tokens.set(tokenId, { ...token, owner: recipient });
    this.events.set(this.eventCounter, { tokenId, eventType: "NFT_TRANSFERRED", initiator: caller, timestamp: BigInt(100) });
    this.eventCounter++;
    return { value: true };
  },

  burnNft(caller: string, tokenId: bigint): { value: boolean } | { error: number } {
    if (this.paused) return { error: 203 };
    if (!this.isAdmin(caller)) return { error: 200 };
    const token = this.tokens.get(tokenId);
    if (!token) return { error: 202 };
    this.tokens.delete(tokenId);
    this.tokenToProductId.delete(tokenId);
    this.productToTokenId.delete(token.productId);
    this.events.set(this.eventCounter, { tokenId, eventType: "NFT_BURNED", initiator: caller, timestamp: BigInt(100) });
    this.eventCounter++;
    return { value: true };
  },

  getToken(tokenId: bigint): { value: Token } | { error: number } {
    const token = this.tokens.get(tokenId);
    if (!token) return { error: 202 };
    return { value: token };
  },
};

describe("LuxVerify OwnershipNFT", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.tokenIdCounter = 0n;
    mockContract.registryContract = "ST2CY5...";
    mockContract.tokens = new Map();
    mockContract.tokenToProductId = new Map();
    mockContract.productToTokenId = new Map();
    mockContract.events = new Map();
    mockContract.eventCounter = 0n;
    vi.resetAllMocks();
  });

  it("should allow admin to set registry contract", () => {
    const result = mockContract.setRegistryContract(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.registryContract).toBe("ST3NB...");
  });

  it("should prevent non-admin from setting registry contract", () => {
    const result = mockContract.setRegistryContract("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 200 });
  });

  it("should mint NFT for registered product", () => {
    const result = mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    expect(result).toEqual({ value: 0n });
    expect(mockContract.tokens.get(0n)).toEqual({ productId: 0n, owner: "ST3NB...", mintedAt: 100n });
    expect(mockContract.tokenToProductId.get(0n)).toBe(0n);
    expect(mockContract.productToTokenId.get(0n)).toBe(0n);
    expect(mockContract.events.get(0n)).toEqual({
      tokenId: 0n,
      eventType: "NFT_MINTED",
      initiator: mockContract.admin,
      timestamp: 100n,
    });
  });

  it("should prevent minting for unregistered product", () => {
    mockProductRegistry.getProduct.mockImplementation(() => ({ error: 104 }));
    const result = mockContract.mintNft(mockContract.admin, "ST3NB...", 1n);
    expect(result).toEqual({ error: 201 });
  });

  it("should prevent duplicate NFT minting for same product", () => {
    mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    const result = mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    expect(result).toEqual({ error: 206 });
  });

  it("should allow owner to transfer NFT", () => {
    mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    const result = mockContract.transferNft("ST3NB...", 0n, "ST4RE...");
    expect(result).toEqual({ value: true });
    expect(mockContract.tokens.get(0n)?.owner).toBe("ST4RE...");
    expect(mockContract.events.get(1n)).toEqual({
      tokenId: 0n,
      eventType: "NFT_TRANSFERRED",
      initiator: "ST3NB...",
      timestamp: 100n,
    });
  });

  it("should prevent non-owner from transferring NFT", () => {
    mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    const result = mockContract.transferNft("ST4RE...", 0n, "ST5ST...");
    expect(result).toEqual({ error: 200 });
  });

  it("should allow admin to burn NFT", () => {
    mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    const result = mockContract.burnNft(mockContract.admin, 0n);
    expect(result).toEqual({ value: true });
    expect(mockContract.tokens.has(0n)).toBe(false);
    expect(mockContract.tokenToProductId.has(0n)).toBe(false);
    expect(mockContract.productToTokenId.has(0n)).toBe(false);
    expect(mockContract.events.get(1n)).toEqual({
      tokenId: 0n,
      eventType: "NFT_BURNED",
      initiator: mockContract.admin,
      timestamp: 100n,
    });
  });

  it("should prevent non-admin from burning NFT", () => {
    mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    const result = mockContract.burnNft("ST3NB...", 0n);
    expect(result).toEqual({ error: 200 });
  });

  it("should not allow actions when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.mintNft(mockContract.admin, "ST3NB...", 0n);
    expect(result).toEqual({ error: 203 });
  });
});