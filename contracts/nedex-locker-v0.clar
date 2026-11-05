;; NEDeX general SIP-010 / LP locker v0 sketch (pilot / unaudited)
;; Multi-lock registry with optional permanent burn path. Same security model as
;; nedex-timelock: no admin escape hatch. LP tokens are just SIP-010 principals -
;; callers pass the LP trait; adapters for Velar/ALEX/Bitflow can wrap later.
;; NOT production-ready. External audit required before mainnet.

(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-constant ERR-UNAUTHORIZED u200)
(define-constant ERR-UNLOCK-NOT-FUTURE u201)
(define-constant ERR-ZERO-AMOUNT u202)
(define-constant ERR-UNKNOWN-LOCK u203)
(define-constant ERR-ALREADY-CLOSED u204)
(define-constant ERR-TOO-EARLY u205)
(define-constant ERR-WRONG-TOKEN u206)
(define-constant ERR-NOT-BENEFICIARY u207)

(define-data-var next-lock-id uint u1)

;; status: u0 = active, u1 = claimed, u2 = burned
(define-map locks
  uint
  {
    depositor: principal,
    beneficiary: principal,
    token: principal,
    amount: uint,
    unlock-burn-height: uint,
    status: uint,
    label: (buff 34)
  }
)

(define-read-only (get-lock (lock-id uint))
  (map-get? locks lock-id)
)

(define-read-only (get-next-lock-id)
  (var-get next-lock-id)
)

(define-public (lock-tokens
    (token <ft-trait>)
    (amount uint)
    (unlock-burn-height uint)
    (beneficiary principal)
    (label (buff 34))
  )
  (let (
      (lock-id (var-get next-lock-id))
      (token-principal (contract-of token))
    )
    (asserts! (> amount u0) (err ERR-ZERO-AMOUNT))
    (asserts! (> unlock-burn-height burn-block-height) (err ERR-UNLOCK-NOT-FUTURE))
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (map-set locks lock-id {
      depositor: tx-sender,
      beneficiary: beneficiary,
      token: token-principal,
      amount: amount,
      unlock-burn-height: unlock-burn-height,
      status: u0,
      label: label
    })
    (var-set next-lock-id (+ lock-id u1))
    (print {
      event: "nedex-locker-lock",
      lock-id: lock-id,
      depositor: tx-sender,
      beneficiary: beneficiary,
      token: token-principal,
      amount: amount,
      unlock-burn-height: unlock-burn-height,
      label: label
    })
    (ok lock-id)
  )
)

(define-public (claim (lock-id uint) (token <ft-trait>))
  (let (
      (lock-data (unwrap! (map-get? locks lock-id) (err ERR-UNKNOWN-LOCK)))
      (token-principal (contract-of token))
      (amount (get amount lock-data))
      (beneficiary (get beneficiary lock-data))
      (status (get status lock-data))
    )
    (asserts! (is-eq status u0) (err ERR-ALREADY-CLOSED))
    (asserts! (is-eq token-principal (get token lock-data)) (err ERR-WRONG-TOKEN))
    (asserts! (>= burn-block-height (get unlock-burn-height lock-data)) (err ERR-TOO-EARLY))
    (asserts! (is-eq tx-sender beneficiary) (err ERR-NOT-BENEFICIARY))
    (map-set locks lock-id (merge lock-data { status: u1 }))
    (try! (as-contract (contract-call? token transfer amount tx-sender beneficiary none)))
    (print {
      event: "nedex-locker-claim",
      lock-id: lock-id,
      beneficiary: beneficiary,
      token: token-principal,
      amount: amount
    })
    (ok amount)
  )
)

;; Permanent burn: tokens stay in contract forever (status=burned). Irreversible.
;; Only depositor may burn before unlock (trust signal); after unlock beneficiary may burn.
(define-public (burn-lock (lock-id uint))
  (let (
      (lock-data (unwrap! (map-get? locks lock-id) (err ERR-UNKNOWN-LOCK)))
      (status (get status lock-data))
      (depositor (get depositor lock-data))
      (beneficiary (get beneficiary lock-data))
      (unlocked (>= burn-block-height (get unlock-burn-height lock-data)))
    )
    (asserts! (is-eq status u0) (err ERR-ALREADY-CLOSED))
    (asserts!
      (or
        (and (not unlocked) (is-eq tx-sender depositor))
        (and unlocked (is-eq tx-sender beneficiary))
      )
      (err ERR-UNAUTHORIZED)
    )
    (map-set locks lock-id (merge lock-data { status: u2 }))
    (print {
      event: "nedex-locker-burn",
      lock-id: lock-id,
      token: (get token lock-data),
      amount: (get amount lock-data),
      by: tx-sender
    })
    (ok true)
  )
)
