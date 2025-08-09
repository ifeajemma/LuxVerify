import { describe, it, expect, beforeEach } from "vitest";

interface Product {
  serialNumber: string;
  metadata: string;
  manufacturer: string;
  isRegistered: boolean;
  registeredAt: bigint;
}

interface Event {
  productId: bigint;
  eventType: string;
  initiator: string;
  timestamp: bigint;
}

const mockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  productIdCounter: 0n,
  manufacturers: new Map<string, boolean>(),
  products: new Map<bigint, Product>(),
  serialToProductId: new Map<string, bigint>(),
  events: new Map<bigint, Event>(),
  eventCounter: 0n,
  MAX_SERIAL_LENGTH: 50,
  MAX_METADATA_LENGTH: 256,

  isAdmin(caller: string): boolean {
    return caller === this.admin;
  },

  isManufacturer(caller: string): boolean {
    return this.manufacturers.get(caller) || false;
  },

  validateSerial(serial: string): boolean {
    return serial.length > 0 && serial.length <= this.MAX_SERIAL_LENGTH;
  },

  validateMetadata(metadata: string): boolean {
    return metadata.length > 0 && metadata.length <= this.MAX_METADATA_LENGTH;
  },

  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  addManufacturer(caller: string, manufacturer: string): { value: boolean } | { error: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (manufacturer === "SP000000000000000000002Q6VF78") return { error: 106 };
    this.manufacturers.set(manufacturer, true);
    return { value: true };
  },

  registerProduct(caller: string, serialNumber: string, metadata: string): { value: bigint } | { error: number } {
    if (this.paused) return { error: 105 };
    if (!this.isManufacturer(caller)) return { error: 100 };
    if (!this.validateSerial(serialNumber)) return { error: 102 };
    if (!this.validateMetadata(metadata)) return { error: 103 };
    if (this.serialToProductId.has(serialNumber)) return { error: 101 };
    const productId = this.productIdCounter;
    this.products.set(productId, {
      serialNumber,
      metadata,
      manufacturer: caller,
      isRegistered: true,
      registeredAt: BigInt(100),
    });
    this.serialToProductId.set(serialNumber, productId);
    this.events.set(this.eventCounter, {
      productId,
      eventType: "PRODUCT_REGISTERED",
      initiator: caller,
      timestamp: BigInt(100),
    });
    this.eventCounter++;
    this.productIdCounter++;
    return { value: productId };
  },

  updateProductMetadata(caller: string, productId: bigint, newMetadata: string): { value: boolean } | { error: number } {
    if (this.paused) return { error: 105 };
    const product = this.products.get(productId);
    if (!product) return { error: 104 };
    if (!this.isAdmin(caller) && caller !== product.manufacturer) return { error: 100 };
    if (!this.validateMetadata(newMetadata)) return { error: 103 };
    this.products.set(productId, { ...product, metadata: newMetadata });
    this.events.set(this.eventCounter, {
      productId,
      eventType: "METADATA_UPDATED",
      initiator: caller,
      timestamp: BigInt(100),
    });
    this.eventCounter++;
    return { value: true };
  },

  deactivateProduct(caller: string, productId: bigint): { value: boolean } | { error: number } {
    if (this.paused) return { error: 105 };
    if (!this.isAdmin(caller)) return { error: 100 };
    const product = this.products.get(productId);
    if (!product) return { error: 104 };
    this.products.set(productId, { ...product, isRegistered: false });
    this.events.set(this.eventCounter, {
      productId,
      eventType: "PRODUCT_DEACTIVATED",
      initiator: caller,
      timestamp: BigInt(100),
    });
    this.eventCounter++;
    return { value: true };
  },

  getProduct(productId: bigint): { value: Product } | { error: number } {
    const product = this.products.get(productId);
    if (!product) return { error: 104 };
    return { value: product };
  },
};

describe("LuxVerify ProductRegistry", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.productIdCounter = 0n;
    mockContract.manufacturers = new Map();
    mockContract.products = new Map();
    mockContract.serialToProductId = new Map();
    mockContract.events = new Map();
    mockContract.eventCounter = 0n;
  });

  it("should allow admin to add manufacturer", () => {
    const result = mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    expect(result).toEqual({ value: true });
    expect(mockContract.manufacturers.get("ST2CY5...")).toBe(true);
  });

  it("should prevent non-admin from adding manufacturer", () => {
    const result = mockContract.addManufacturer("ST2CY5...", "ST3NB...");
    expect(result).toEqual({ error: 100 });
  });

  it("should register product by manufacturer", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    const result = mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    expect(result).toEqual({ value: 0n });
    expect(mockContract.products.get(0n)).toEqual({
      serialNumber: "SERIAL123",
      metadata: "Brand:Rolex,Model:Submariner",
      manufacturer: "ST2CY5...",
      isRegistered: true,
      registeredAt: 100n,
    });
    expect(mockContract.serialToProductId.get("SERIAL123")).toBe(0n);
    expect(mockContract.events.get(0n)).toEqual({
      productId: 0n,
      eventType: "PRODUCT_REGISTERED",
      initiator: "ST2CY5...",
      timestamp: 100n,
    });
  });

  it("should prevent duplicate serial numbers", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    const result = mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Daytona");
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent invalid serial numbers", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    const longSerial = "A".repeat(51);
    const result = mockContract.registerProduct("ST2CY5...", longSerial, "Brand:Rolex,Model:Submariner");
    expect(result).toEqual({ error: 102 });
  });

  it("should allow admin to update metadata", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    const result = mockContract.updateProductMetadata(mockContract.admin, 0n, "Brand:Rolex,Model:Daytona");
    expect(result).toEqual({ value: true });
    expect(mockContract.products.get(0n)?.metadata).toBe("Brand:Rolex,Model:Daytona");
    expect(mockContract.events.get(1n)).toEqual({
      productId: 0n,
      eventType: "METADATA_UPDATED",
      initiator: mockContract.admin,
      timestamp: 100n,
    });
  });

  it("should allow manufacturer to update metadata", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    const result = mockContract.updateProductMetadata("ST2CY5...", 0n, "Brand:Rolex,Model:Daytona");
    expect(result).toEqual({ value: true });
    expect(mockContract.products.get(0n)?.metadata).toBe("Brand:Rolex,Model:Daytona");
  });

  it("should prevent non-authorized metadata updates", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    const result = mockContract.updateProductMetadata("ST3NB...", 0n, "Brand:Rolex,Model:Daytona");
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to deactivate product", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    const result = mockContract.deactivateProduct(mockContract.admin, 0n);
    expect(result).toEqual({ value: true });
    expect(mockContract.products.get(0n)?.isRegistered).toBe(false);
    expect(mockContract.events.get(1n)).toEqual({
      productId: 0n,
      eventType: "PRODUCT_DEACTIVATED",
      initiator: mockContract.admin,
      timestamp: 100n,
    });
  });

  it("should prevent non-admin from deactivating product", () => {
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    const result = mockContract.deactivateProduct("ST3NB...", 0n);
    expect(result).toEqual({ error: 100 });
  });

  it("should not allow actions when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    mockContract.addManufacturer(mockContract.admin, "ST2CY5...");
    const result = mockContract.registerProduct("ST2CY5...", "SERIAL123", "Brand:Rolex,Model:Submariner");
    expect(result).toEqual({ error: 105 });
  });
});