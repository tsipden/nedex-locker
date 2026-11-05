;; NEDeX SIP-010 time-lock (pilot / UNAUDITED)
;; - create-lock: escrow SIP-010 until unlock-burn-height; beneficiary claims after
;; - No admin early withdraw / no upgrade escape
;; - Indexer events + read-only views (depositor list + id slice)
;; Do not use with mainnet funds until external audit.

(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-constant ERR-UNLOCK-NOT-FUTURE u101)
(define-constant ERR-ZERO-AMOUNT u102)
(define-constant ERR-UNKNOWN-LOCK u103)
(define-constant ERR-ALREADY-CLAIMED u104)
(define-constant ERR-TOO-EARLY u105)
(define-constant ERR-WRONG-TOKEN u106)
(define-constant ERR-NOT-BENEFICIARY u107)
(define-constant ERR-HEIGHT-TOO-FAR u108)
(define-constant ERR-OVERFLOW u109)
(define-constant ERR-TOO-MANY-LOCKS u110)
(define-constant ERR-BAD-RANGE u111)

;; ~38 years of Bitcoin blocks at 144/day; covers 230-month schedule with headroom
(define-constant MAX-LOCK-DURATION-BLOCKS u2000000)
(define-constant MAX-SLICE u20)

(define-constant SLICE-OFFSETS (list
  u0 u1 u2 u3 u4 u5 u6 u7 u8 u9
  u10 u11 u12 u13 u14 u15 u16 u17 u18 u19
))

(define-data-var next-lock-id uint u1)

(define-map locks
  uint
  {
    depositor: principal,
    beneficiary: principal,
    token: principal,
    amount: uint,
    unlock-burn-height: uint,
    claimed: bool
  }
)

(define-map depositor-lock-ids principal (list 50 uint))

(define-read-only (get-lock (lock-id uint))
  (map-get? locks lock-id)
)

(define-read-only (get-next-lock-id)
  (var-get next-lock-id)
)

(define-read-only (get-max-lock-duration-blocks)
  MAX-LOCK-DURATION-BLOCKS
)

(define-read-only (is-unlocked (lock-id uint))
  (match (map-get? locks lock-id)
    lock (and (not (get claimed lock)) (>= burn-block-height (get unlock-burn-height lock)))
    false
  )
)

(define-read-only (get-locks-for-depositor (who principal))
  (default-to (list) (map-get? depositor-lock-ids who))
)

(define-private (fold-slice-offset
    (offset uint)
    (ctx {
      start: uint,
      count: uint,
      acc: (list 20 (optional {
        depositor: principal,
        beneficiary: principal,
        token: principal,
        amount: uint,
        unlock-burn-height: uint,
        claimed: bool
      }))
    })
  )
  (if (>= offset (get count ctx))
    ctx
    (let (
        (id (+ (get start ctx) offset))
        (entry (map-get? locks id))
        (next-acc (unwrap-panic (as-max-len? (append (get acc ctx) entry) u20)))
      )
      {
        start: (get start ctx),
        count: (get count ctx),
        acc: next-acc
      }
    )
  )
)

;; Return up to 20 consecutive lock records starting at start-id (inclusive).
(define-read-only (get-locks-slice (start-id uint) (count uint))
  (begin
    (asserts! (and (> count u0) (<= count MAX-SLICE)) (err ERR-BAD-RANGE))
    (ok (get acc (fold fold-slice-offset SLICE-OFFSETS {
      start: start-id,
      count: count,
      acc: (list)
    })))
  )
)

(define-private (track-depositor-lock (who principal) (id uint))
  (let (
      (cur (default-to (list) (map-get? depositor-lock-ids who)))
      (next (as-max-len? (append cur id) u50))
    )
    (match next
      ok-list (ok (map-set depositor-lock-ids who ok-list))
      (err ERR-TOO-MANY-LOCKS)
    )
  )
)

(define-public (create-lock
    (token <ft-trait>)
    (amount uint)
    (unlock-burn-height uint)
    (beneficiary principal)
  )
  (let (
      (lock-id (var-get next-lock-id))
      (token-principal (contract-of token))
      (max-unlock (+ burn-block-height MAX-LOCK-DURATION-BLOCKS))
    )
    (asserts! (> amount u0) (err ERR-ZERO-AMOUNT))
    (asserts! (> unlock-burn-height burn-block-height) (err ERR-UNLOCK-NOT-FUTURE))
    (asserts! (>= max-unlock burn-block-height) (err ERR-OVERFLOW))
    (asserts! (<= unlock-burn-height max-unlock) (err ERR-HEIGHT-TOO-FAR))
    (asserts! (> (+ lock-id u1) lock-id) (err ERR-OVERFLOW))
    (try! (track-depositor-lock tx-sender lock-id))
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))
    (map-set locks lock-id {
      depositor: tx-sender,
      beneficiary: beneficiary,
      token: token-principal,
      amount: amount,
      unlock-burn-height: unlock-burn-height,
      claimed: false
    })
    (var-set next-lock-id (+ lock-id u1))
    (print {
      event: "nedex-timelock-create",
      lock-id: lock-id,
      depositor: tx-sender,
      beneficiary: beneficiary,
      token: token-principal,
      amount: amount,
      unlock-burn-height: unlock-burn-height
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
    )
    (asserts! (not (get claimed lock-data)) (err ERR-ALREADY-CLAIMED))
    (asserts! (is-eq token-principal (get token lock-data)) (err ERR-WRONG-TOKEN))
    (asserts! (>= burn-block-height (get unlock-burn-height lock-data)) (err ERR-TOO-EARLY))
    (asserts! (is-eq tx-sender beneficiary) (err ERR-NOT-BENEFICIARY))
    (map-set locks lock-id (merge lock-data { claimed: true }))
    (try! (as-contract (contract-call? token transfer amount tx-sender beneficiary none)))
    (print {
      event: "nedex-timelock-claim",
      lock-id: lock-id,
      beneficiary: beneficiary,
      token: token-principal,
      amount: amount
    })
    (ok amount)
  )
)
