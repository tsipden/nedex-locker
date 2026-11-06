;; Contract principal used as a lock beneficiary.
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (claim-timelock (lock-id uint) (token <ft-trait>))
  (contract-call? .nedex-timelock claim lock-id token)
)

(define-public (claim-timelock-as-contract (lock-id uint) (token <ft-trait>))
  (as-contract (contract-call? .nedex-timelock claim lock-id token))
)

(define-public (claim-locker (lock-id uint) (token <ft-trait>))
  (contract-call? .nedex-locker-v0 claim lock-id token)
)

(define-public (burn (lock-id uint))
  (contract-call? .nedex-locker-v0 burn-lock lock-id)
)
