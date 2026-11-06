;; Adversarial SIP-010 used only by Clarinet tests.
;; Modes (set via configure):
;;   u0 honest transfer
;;   u1 no-op: (ok true) without moving tokens, real balance unchanged
;;   u2 short: delivers amount-1 and reports (ok true)
;;   u3 error: transfer always returns (err u777)
;;   u4 redirect: a claim (sender is a locker) pays the attacker, not `to`
;;   u5 reenter: burn-lock callback, then debit tx-sender once
;;   u6 double: move `amount` twice in one transfer (over-delivery)
;;   u8 circular: burn callback, then call create-lock again (VM abort)
;;   u7 lying: get-balance credits `to` with no real mint (delta looks exact)

(impl-trait .sip-010-trait.sip-010-trait)

(define-fungible-token mock)
(define-constant TOKEN-URI none)
(define-constant ERR-UNAUTHORIZED u401)
(define-constant ERR-SHORT u402)
(define-constant ERR-FORCED u777)

(define-data-var mode uint u0)
(define-data-var armed bool false)
(define-data-var attacker principal tx-sender)
(define-map fake-balances principal uint)

(define-data-var burn-ok bool false)
(define-data-var burn-err uint u0)

(define-public (configure (next-mode uint) (who principal))
  (begin
    (var-set mode next-mode)
    (var-set attacker who)
    (var-set armed true)
    (var-set burn-ok false)
    (var-set burn-err u0)
    (ok true)
  )
)

(define-read-only (get-probe)
  {
    burn-ok: (var-get burn-ok),
    burn-err: (var-get burn-err)
  }
)

;; Cross-function callback. Same-function reentry into create-lock is rejected
;; by the Clarity VM; burn-lock is a different function and is not.
(define-private (run-probes)
  (begin
    (match (contract-call? .nedex-locker-v0 burn-lock u1)
      ok-v (begin (var-set burn-ok true) (var-set burn-err u0) ok-v)
      err-v (begin (var-set burn-ok false) (var-set burn-err err-v) false)
    )
    true
  )
)

(define-private (credit-lie (amount uint) (to principal))
  (begin
    (map-set fake-balances to (+ (default-to u0 (map-get? fake-balances to)) amount))
    (ok true)
  )
)

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (let ((m (var-get mode)))
    (if (is-eq m u3)
      (err ERR-FORCED)
      (if (is-eq m u7)
        (credit-lie amount to)
        (if (is-eq m u1)
          (begin
            (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
            (ok true)
          )
          (if (is-eq m u2)
            (begin
              (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
              (asserts! (> amount u0) (err ERR-SHORT))
              (ft-transfer? mock (- amount u1) from to)
            )
            (if (is-eq m u4)
              (begin
                (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
                (if (or (is-eq from .nedex-timelock) (is-eq from .nedex-locker-v0))
                  (ft-transfer? mock amount from (var-get attacker))
                  (ft-transfer? mock amount from to)
                )
              )
              (if (is-eq m u5)
                (begin
                  ;; Hostile: debit the signer and reenter the lockers once.
                  (if (var-get armed)
                    (begin
                      (var-set armed false)
                      (run-probes)
                      true
                    )
                    true
                  )
                  (ft-transfer? mock amount tx-sender to)
                )
                (if (is-eq m u6)
                  (begin
                    (try! (ft-transfer? mock amount tx-sender to))
                    (ft-transfer? mock amount tx-sender to)
                  )
                  (if (is-eq m u8)
                    (begin
                      (run-probes)
                      ;; Same-function reentry. The VM aborts the transaction;
                      ;; this must not commit the burn above.
                      (try! (contract-call? .nedex-timelock create-lock .sip010-ft u1
                        (+ burn-block-height u20) tx-sender))
                      (ft-transfer? mock amount tx-sender to)
                    )
                    (begin
                      (asserts! (is-eq from tx-sender) (err ERR-UNAUTHORIZED))
                      (ft-transfer? mock amount from to)
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )
)

(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock amount recipient)
)

(define-read-only (get-name) (ok "misbehave"))
(define-read-only (get-symbol) (ok "BAD"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (owner principal))
  (if (is-eq (var-get mode) u7)
    (ok (default-to u0 (map-get? fake-balances owner)))
    (ok (ft-get-balance mock owner))
  )
)
(define-read-only (get-total-supply) (ok (ft-get-supply mock)))
(define-read-only (get-token-uri) (ok TOKEN-URI))
