// Package invoicing is the plan-18 seam: today it owns only the policy that
// decides whether an order must get a faktura (and the retry-invoices
// subcommand's no-op listing). The Fakturownia API client, retention_until
// stamping, PDF mirroring, and correction invoices land in plan 18.
package invoicing

// ShouldIssue reports whether policy requires a faktura VAT for the order:
// always for B2B (a NIP was given at checkout), otherwise only when the
// customer opted in (Polish law: faktura on request for B2C).
func ShouldIssue(nip *string, invoiceRequested bool) bool {
	return (nip != nil && *nip != "") || invoiceRequested
}
