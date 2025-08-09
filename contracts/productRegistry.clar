;; ProductRegistry Contract
;; Clarity v2
;; Registers luxury goods with unique identifiers and metadata, ensuring immutable authenticity records

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ALREADY-REGISTERED u101)
(define-constant ERR-INVALID-SERIAL u102)
(define-constant ERR-INVALID-METADATA u103)
(define-constant ERR-PRODUCT-NOT-FOUND u104)
(define-constant ERR-PAUSED u105)
(define-constant ERR-ZERO-ADDRESS u106)

;; Contract metadata
(define-constant CONTRACT-NAME "LuxVerify Product Registry")
(define-constant MAX-SERIAL-LENGTH u50)
(define-constant MAX-METADATA-LENGTH u256)

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var product-id-counter uint u0)

;; Manufacturer permissions
(define-map manufacturers principal bool)
(define-map products
  { product-id: uint }
  { serial-number: (string-ascii 50), metadata: (string-ascii 256), manufacturer: principal, is-registered: bool, registered-at: uint })
(define-map serial-to-product-id (string-ascii 50) uint)

;; Events for tracking
(define-data-var event-counter uint u0)
(define-map events
  { event-id: uint }
  { product-id: uint, event-type: (string-ascii 32), initiator: principal, timestamp: uint })

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: is-manufacturer
(define-private (is-manufacturer (caller principal))
  (default-to false (map-get? manufacturers caller))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate inputs
(define-private (validate-serial (serial (string-ascii 50)))
  (and (> (len serial) u0) (<= (len serial) MAX-SERIAL-LENGTH))
)

(define-private (validate-metadata (metadata (string-ascii 256)))
  (and (> (len metadata) u0) (<= (len metadata) MAX-METADATA-LENGTH))
)

;; Private helper: log event
(define-private (log-event (product-id uint) (event-type (string-ascii 32)))
  (let ((event-id (var-get event-counter)))
    (map-insert events
      { event-id: event-id }
      { product-id: product-id, event-type: event-type, initiator: tx-sender, timestamp: block-height })
    (var-set event-counter (+ event-id u1))
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

;; Add manufacturer
(define-public (add-manufacturer (manufacturer principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq manufacturer 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (map-set manufacturers manufacturer true)
    (ok true)
  )
)

;; Remove manufacturer
(define-public (remove-manufacturer (manufacturer principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (map-delete manufacturers manufacturer)
    (ok true)
  )
)

;; Register a new product
(define-public (register-product (serial-number (string-ascii 50)) (metadata (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (asserts! (is-manufacturer tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (validate-serial serial-number) (err ERR-INVALID-SERIAL))
    (asserts! (validate-metadata metadata) (err ERR-INVALID-METADATA))
    (asserts! (is-none (map-get? serial-to-product-id serial-number)) (err ERR-ALREADY-REGISTERED))
    (let ((product-id (var-get product-id-counter)))
      (map-insert products
        { product-id: product-id }
        { serial-number: serial-number, metadata: metadata, manufacturer: tx-sender, is-registered: true, registered-at: block-height })
      (map-insert serial-to-product-id serial-number product-id)
      (var-set product-id-counter (+ product-id u1))
      (try! (log-event product-id "PRODUCT_REGISTERED"))
      (ok product-id)
    )
  )
)

;; Update product metadata (admin or manufacturer)
(define-public (update-product-metadata (product-id uint) (new-metadata (string-ascii 256)))
  (begin
    (ensure-not-paused)
    (let ((product (unwrap! (map-get? products { product-id: product-id }) (err ERR-PRODUCT-NOT-FOUND))))
      (asserts! (or (is-admin) (is-eq tx-sender (get manufacturer product))) (err ERR-NOT-AUTHORIZED))
      (asserts! (validate-metadata new-metadata) (err ERR-INVALID-METADATA))
      (map-set products
        { product-id: product-id }
        (merge product { metadata: new-metadata }))
      (try! (log-event product-id "METADATA_UPDATED"))
      (ok true)
    )
  )
)

;; Deactivate product (admin only)
(define-public (deactivate-product (product-id uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (let ((product (unwrap! (map-get? products { product-id: product-id }) (err ERR-PRODUCT-NOT-FOUND))))
      (map-set products
        { product-id: product-id }
        (merge product { is-registered: false }))
      (try! (log-event product-id "PRODUCT_DEACTIVATED"))
      (ok true)
    )
  )
)

;; Read-only: get product details
(define-read-only (get-product (product-id uint))
  (ok (unwrap! (map-get? products { product-id: product-id }) (err ERR-PRODUCT-NOT-FOUND)))
)

;; Read-only: get product by serial number
(define-read-only (get-product-by-serial (serial-number (string-ascii 50)))
  (let ((product-id (unwrap! (map-get? serial-to-product-id serial-number) (err ERR-PRODUCT-NOT-FOUND))))
    (ok (unwrap! (map-get? products { product-id: product-id }) (err ERR-PRODUCT-NOT-FOUND)))
  )
)

;; Read-only: get event history
(define-read-only (get-event (event-id uint))
  (ok (unwrap! (map-get? events { event-id: event-id }) (err ERR-PRODUCT-NOT-FOUND)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: check if manufacturer
(define-read-only (is-manufacturer? (account principal))
  (ok (default-to false (map-get? manufacturers account)))
)