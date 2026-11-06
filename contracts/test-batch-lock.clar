;; Creates five timelock locks in a single transaction. The direct caller is
;; this contract, so a correct locker escrows this contract's tokens.
(use-trait ft-trait .sip-010-trait.sip-010-trait)

(define-public (lock-five
    (token <ft-trait>)
    (a1 uint) (h1 uint)
    (a2 uint) (h2 uint)
    (a3 uint) (h3 uint)
    (a4 uint) (h4 uint)
    (a5 uint) (h5 uint)
    (beneficiary principal)
  )
  ;; as-contract makes this contract tx-sender, so the locker escrows its
  ;; tokens instead of the EOA that submitted the transaction.
  (as-contract
    (begin
      (try! (contract-call? .nedex-timelock create-lock token a1 h1 beneficiary))
      (try! (contract-call? .nedex-timelock create-lock token a2 h2 beneficiary))
      (try! (contract-call? .nedex-timelock create-lock token a3 h3 beneficiary))
      (try! (contract-call? .nedex-timelock create-lock token a4 h4 beneficiary))
      (try! (contract-call? .nedex-timelock create-lock token a5 h5 beneficiary))
      (ok true)
    )
  )
)
