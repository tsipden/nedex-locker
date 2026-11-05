;; Mock SIP-010 FT A for Clarinet tests (stands in for NEDeX)
(impl-trait .sip-010-trait.sip-010-trait)

(define-fungible-token mock-a)
(define-constant ERR-UNAUTHORIZED u401)
(define-constant TOKEN-URI none)

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
    (try! (ft-transfer? mock-a amount from to))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock-a amount recipient)
)

(define-read-only (get-name) (ok "mock-a"))
(define-read-only (get-symbol) (ok "MOCKA"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (owner principal)) (ok (ft-get-balance mock-a owner)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-a)))
(define-read-only (get-token-uri) (ok TOKEN-URI))
