# LuxVerify

A blockchain-powered platform for authenticating luxury goods, ensuring transparency, trust, and traceability by registering products, tracking ownership, verifying authenticity, and enabling secure trading—all on-chain using the Clarity smart contract language on the Stacks blockchain.

---

## Overview

LuxVerify consists of four main smart contracts that together form a decentralized, transparent, and secure system for combating counterfeiting in the luxury goods market:

1. **ProductRegistry Contract** – Registers luxury goods with unique identifiers and metadata.
2. **OwnershipNFT Contract** – Manages NFT-based ownership tracking for luxury goods.
3. **Verification Contract** – Facilitates authenticity verification by trusted parties.
4. **Marketplace Contract** – Enables secure buying, selling, and trading of verified luxury goods.

---

## Features

- **Immutable product registration** with unique serial numbers and metadata  
- **NFT-based ownership** for transparent chain of custody  
- **Decentralized authenticity verification** by trusted verifiers  
- **Secure marketplace** for trading verified luxury goods  
- **Tamper-proof records** ensuring trust for consumers and brands  
- **Anti-counterfeiting measures** to protect brand integrity  
- **Transparent transaction history** for all registered goods  

---

## Smart Contracts

### ProductRegistry Contract
- Registers luxury goods with unique serial numbers and metadata (e.g., brand, model, production date)
- Restricts registration to authorized manufacturers
- Provides public access to product details for verification

### OwnershipNFT Contract
- Mints NFTs representing ownership of registered luxury goods
- Tracks ownership transfers on-chain
- Links NFTs to product registry for authenticity checks

### Verification Contract
- Allows trusted verifiers to confirm product authenticity
- Records verification results on-chain
- Manages verifier permissions with owner-controlled access

### Marketplace Contract
- Enables listing of verified luxury goods for sale
- Facilitates secure peer-to-peer trading with NFT transfers
- Automates payments and ownership updates via smart contracts

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started) for Stacks development.
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/luxverify.git
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run tests:
   ```bash
   clarinet test
   ```
5. Deploy contracts to the Stacks blockchain:
   ```bash
   clarinet deploy
   ```

## Usage

Each smart contract is designed to operate independently while integrating seamlessly to provide a complete authenticity verification and trading ecosystem. Below is an example workflow:
1. A manufacturer registers a luxury good using the `ProductRegistry` contract.
2. An NFT is minted via the `OwnershipNFT` contract to represent ownership.
3. A trusted verifier confirms authenticity through the `Verification` contract.
4. The owner lists the item for sale on the `Marketplace` contract, and a buyer purchases it, triggering an automatic NFT transfer and payment.

Refer to individual contract documentation for detailed function calls, parameters, and usage examples.

## Smart Contract Example (Clarity)

Below is a simplified example of the `ProductRegistry` contract in Clarity:

```clarity
(define-map products
  { product-id: uint }
  { serial-number: (string-ascii 50), metadata: (string-ascii 256), manufacturer: principal, is-registered: bool })

(define-data-var product-id-counter uint u0)

(define-public (register-product (serial-number (string-ascii 50)) (metadata (string-ascii 256)))
  (let ((product-id (var-get product-id-counter)))
    (asserts! (is-eq tx-sender (contract-call? .auth get-manufacturer)) (err u1))
    (asserts! (is-none (map-get? products { product-id: product-id })) (err u2))
    (map-insert products { product-id: product-id }
      { serial-number: serial-number, metadata: metadata, manufacturer: tx-sender, is-registered: true })
    (var-set product-id-counter (+ product-id u1))
    (ok product-id)))

(define-read-only (get-product (product-id uint))
  (map-get? products { product-id: product-id }))
```

For full contract implementations, refer to the `/contracts` directory in the repository.

## License

MIT License