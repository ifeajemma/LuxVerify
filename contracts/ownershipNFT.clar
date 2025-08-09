;; OwnershipNFT Contract
;; Clarity v2
;; Manages NFT-based ownership of luxury goods, linked to ProductRegistry, with transfer and metadata controls

(define-constant ERR-NOT-AUTHORIZED u200)
(define-constant ERR-PRODUCT-NOT-FOUND u201)
(define-constant ERR-INVALID-TOKEN u202)
(define-constant ERR-PAUSED u203)
(define-constant ERR-ZERO-ADDRESS u204)
(define-constant ERR-NOT-REGISTERED u205)
(define-constant ERR-ALREADY-MINTED u206)

;; Contract metadata
(define-constant CONTRACT-NAME "LuxVerify Ownership NFT")
(define-constant TOKEN-NAME "LuxVerify NFT")
(define-constant TOKEN-SYMBOL "LXNFT")

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var token-id-counter uint u0)
(define-data-var registry-contract principal 'SP000000000000000000002Q6VF78)

;; NFT data
(define-map tokens
  { token-id: uint }
  { product-id: uint, owner: principal, minted-at: uint })
(define-map token-to-product-id uint uint)
(define-map product-to-token-id uint uint)

;; Events for tracking
(define-data-var event-counter uint u0)
(define-map events
  { event-id: uint }
  { token-id: uint, event-type: (string-ascii 32), initiator: principal, timestamp: uint })

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: log event
(define-private (log-event (token-id uint) (event-type (string-ascii 32)))
  (let ((event-id (var-get event-counter)))
    (map-insert events
      { event-id: event-id }
      { token-id: token-id, event-type: event-type, initiator: tx-sender, timestamp: block-height })
    (var-set event-counter (+ event-id u1))
    (ok true)
  )
)

;; Private helper: check product registry
(define-private (is-product-registered (product-id uint))
  (contract-call? .product-registry get-product product-id)
)

;; Set registry contract
(define-public (set-registry-contract (registry principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq registry 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set registry-contract registry)
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Mint NFT for a registered product
(define-public (mint-nft (recipient principal) (product-id uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (is-ok (is-product-registered product-id)) (err ERR-PRODUCT-NOT-FOUND))
    (asserts! (is-none (map-get? product-to-token-id product-id)) (err ERR-ALREADY-MINTED))
    (let ((token-id (var-get token-id-counter)))
      (map-insert tokens
        { token-id: token-id }
        { product-id: product-id, owner: recipient, minted-at: block-height })
      (map-insert token-to-product-id token-id product-id)
      (map-insert product-to-token-id product-id token-id)
      (var-set token-id-counter (+ token-id u1))
      (try! (log-event token-id "NFT_MINTED"))
      (ok token-id)
    )
  )
)

;; Transfer NFT
(define-public (transfer-nft (token-id uint) (recipient principal))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (let ((token (unwrap! (map-get? tokens { token-id: token-id }) (err ERR-INVALID-TOKEN))))
      (asserts! (is-eq tx-sender (get owner token)) (err ERR-NOT-AUTHORIZED))
      (map-set tokens
        { token-id: token-id }
        (merge token { owner: recipient }))
      (try! (log-event token-id "NFT_TRANSFERRED"))
      (ok true)
    )
  )
)

;; Burn NFT (admin only)
(define-public (burn-nft (token-id uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (let ((token (unwrap! (map-get? tokens { token-id: token-id }) (err ERR-INVALID-TOKEN))))
      (let ((product-id (get product-id token)))
        (map-delete tokens { token-id: token-id })
        (map-delete token-to-product-id token-id)
        (map-delete product-to-token-id product-id)
        (try! (log-event token-id "NFT_BURNED"))
        (ok true)
      )
    )
  )
)

;; Read-only: get token details
(define-read-only (get-token (token-id uint))
  (ok (unwrap! (map-get? tokens { token-id: token-id }) (err ERR-INVALID-TOKEN)))
)

;; Read-only: get token by product ID
(define-read-only (get-token-by-product (product-id uint))
  (let ((token-id (unwrap! (map-get? product-to-token-id product-id) (err ERR-INVALID-TOKEN))))
    (ok (unwrap! (map-get? tokens { token-id: token-id }) (err ERR-INVALID-TOKEN)))
  )
)

;; Read-only: get product details via registry
(define-read-only (get-product-by-token (token-id uint))
  (let ((product-id (unwrap! (map-get? token-to-product-id token-id) (err ERR-INVALID-TOKEN))))
    (contract-call? .product-registry get-product product-id)
  )
)

;; Read-only: get event history
(define-read-only (get-event (event-id uint))
  (ok (unwrap! (map-get? events { event-id: event-id }) (err ERR-INVALID-TOKEN)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)