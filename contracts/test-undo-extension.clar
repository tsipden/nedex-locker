;; External "extension" in the shape of the CityCoins finding: a permissionless
;; fund-from-treasury that tries to move escrowed tokens back out and undo a lock.
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (fund-from-treasury (amount uint) (to principal))
  (contract-call? .sip010-ft transfer amount .nedex-timelock to none)
)

(define-public (fund-from-locker (amount uint) (to principal))
  (contract-call? .sip010-ft transfer amount .nedex-locker-v0 to none)
)

(define-public (recall-claim (lock-id uint) (token <ft-trait>))
  (contract-call? .nedex-timelock claim lock-id token)
)
