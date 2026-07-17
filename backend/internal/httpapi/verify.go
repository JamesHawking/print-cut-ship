package httpapi

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"

	"github.com/jackc/pgx/v5"

	"github.com/JamesHawking/print-cut-ship/backend/internal/makerworld"
	"github.com/JamesHawking/print-cut-ship/backend/internal/mesh"
	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// recomputeSem bounds concurrent mesh recomputes: each reads up to
// MaxFileBytes (100 MB) into memory and parses it. /quotes is low-traffic;
// rate limiting proper is plan 10.
var recomputeSem = make(chan struct{}, 2)

// driftWarnRelTol is the relative gap between server- and client-computed
// volume above which we log a warning. The engines are no longer bit-identical
// (idiomatic Go port, tolerance goldens), so sub-0.1% drift is expected noise
// absorbed by the server-authoritative price.
const driftWarnRelTol = 1e-3

// recomputeQuoteParts re-parses each part's stored file from object storage and
// recomputes its geometry in Go, so the price is computed from bytes the server
// actually holds — not client-submitted metrics. For watertight meshes the
// server metrics replace the client's (authoritative). For non-watertight
// meshes the client metrics are kept (the client priced via its convex-hull
// fallback, which Go does not port) and a warning is logged.
//
// Failures are soft by design — storage hiccups and Go-side parse gaps must not
// fail a customer's quote — EXCEPT a stored-bytes hash mismatch, which is a hard
// rejection (tampering or corruption).
func (s *server) recomputeQuoteParts(ctx context.Context, parts []SubmitQuotePart) error {
	for i := range parts {
		p := &parts[i]
		if p.FileId == nil {
			continue
		}
		f, err := s.cfg.Store.GetFileByID(ctx, *p.FileId)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				// Leave it for persistQuote's existing errQuoteFileInvalid path.
				continue
			}
			s.cfg.Logger.Error("recompute: file lookup failed", "fileId", *p.FileId, "err", err)
			continue
		}
		// STEP stays client-only (no Go OCCT); a file without stored bytes or a
		// hash can't be re-verified yet.
		if f.Kind == "step" || f.StorageKey == nil || f.Hash == nil {
			continue
		}

		data, err := s.readStoredFile(ctx, *f.StorageKey)
		if err != nil {
			// Soft fallback: keep client metrics, price proceeds.
			s.cfg.Logger.Error("recompute: read stored file failed; using client metrics",
				"fileId", *p.FileId, "storageKey", *f.StorageKey, "err", err)
			continue
		}

		sum := sha256.Sum256(data)
		if got := fmt.Sprintf("%x", sum); got != *f.Hash {
			// Hard reject: the stored object no longer matches its content
			// address (tampering or corruption).
			s.cfg.Logger.Warn("recompute: stored bytes hash mismatch",
				"fileId", *p.FileId, "storedHash", *f.Hash, "actualHash", got)
			return fmt.Errorf("%w: stored bytes hash mismatch for %s", errQuoteFileInvalid, *p.FileId)
		}

		m, err := mesh.Analyze(f.Kind, data)
		if err != nil {
			// A file the browser parsed but Go can't is a fidelity bug, not a
			// customer failure — keep client metrics and move on.
			s.cfg.Logger.Error("recompute: server mesh analysis failed; using client metrics",
				"fileId", *p.FileId, "kind", f.Kind, "err", err)
			continue
		}

		// Persist the server's view for admin reconciliation (plan 07),
		// regardless of the pricing decision below. Non-fatal on error.
		if raw, err := json.Marshal(m); err != nil {
			s.cfg.Logger.Error("recompute: marshal metrics failed", "fileId", *p.FileId, "err", err)
		} else if err := s.cfg.Store.SetFileMetrics(ctx, store.SetFileMetricsParams{ID: *p.FileId, Metrics: raw}); err != nil {
			s.cfg.Logger.Error("recompute: persist metrics failed", "fileId", *p.FileId, "err", err)
		}

		clientVol := p.Metrics.VolumeCm3
		if !m.Watertight {
			// The client priced via its hull fallback; Go has no hull. Keep the
			// client metrics for pricing and flag the divergence.
			s.cfg.Logger.Warn("recompute: mesh not watertight; deferring to client metrics",
				"fileId", *p.FileId, "clientVolumeCm3", clientVol, "serverSignedVolumeCm3", m.RawSignedVolumeCm3)
			continue
		}

		if driftExceeds(m.VolumeCm3, clientVol, driftWarnRelTol) {
			s.cfg.Logger.Warn("recompute: server/client volume drift",
				"fileId", *p.FileId, "serverVolumeCm3", m.VolumeCm3, "clientVolumeCm3", clientVol)
		}
		p.Metrics = apiMetrics(m)
	}
	return nil
}

// readStoredFile fetches an object's bytes under the concurrency semaphore,
// capped at MaxFileBytes.
func (s *server) readStoredFile(ctx context.Context, key string) ([]byte, error) {
	recomputeSem <- struct{}{}
	defer func() { <-recomputeSem }()

	rc, err := s.cfg.Storage.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	data, err := io.ReadAll(io.LimitReader(rc, makerworld.MaxFileBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > makerworld.MaxFileBytes {
		return nil, fmt.Errorf("stored file exceeds %d bytes", makerworld.MaxFileBytes)
	}
	return data, nil
}

func driftExceeds(a, b, relTol float64) bool {
	diff := math.Abs(a - b)
	scale := math.Max(math.Abs(a), math.Abs(b))
	if scale == 0 {
		return false
	}
	return diff > relTol*scale
}

// apiMetrics converts a mesh.Metrics into the OpenAPI MeshMetrics shape,
// matching the subset toDomainMetrics consumes (pieces nil when absent).
func apiMetrics(m mesh.Metrics) MeshMetrics {
	out := MeshMetrics{
		BboxMm:           Vec3Mm{X: m.BboxMm.X, Y: m.BboxMm.Y, Z: m.BboxMm.Z},
		SurfaceAreaCm2:   m.SurfaceAreaCm2,
		UsedHullFallback: m.UsedHullFallback,
		VolumeCm3:        m.VolumeCm3,
	}
	if len(m.Pieces) > 0 {
		pieces := make([]PieceMetrics, len(m.Pieces))
		for i, p := range m.Pieces {
			pieces[i] = PieceMetrics{BboxMm: Vec3Mm{X: p.BboxMm.X, Y: p.BboxMm.Y, Z: p.BboxMm.Z}}
		}
		out.Pieces = &pieces
	}
	return out
}
