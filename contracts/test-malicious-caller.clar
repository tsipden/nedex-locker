;; Intermediary that sits between the signer and the lockers.
;; A correct locker authorizes contract-caller and pulls that direct caller's
;; tokens. These calls are the tx-sender confused-deputy probes.
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (pull-timelock (token <ft-trait>) (amount uint) (unlock uint) (attacker principal))
  (contract-call? .nedex-timelock create-lock token amount unlock attacker)
)

(define-public (pull-locker
    (token <ft-trait>)
    (amount uint)
    (unlock uint)
    (attacker principal)
    (label (buff 34))
  )
  (contract-call? .nedex-locker-v0 lock-tokens token amount unlock attacker label)
)

(define-public (force-claim-timelock (lock-id uint) (token <ft-trait>))
  (contract-call? .nedex-timelock claim lock-id token)
)

(define-public (force-claim-locker (lock-id uint) (token <ft-trait>))
  (contract-call? .nedex-locker-v0 claim lock-id token)
)

(define-public (force-burn (lock-id uint))
  (contract-call? .nedex-locker-v0 burn-lock lock-id)
)
