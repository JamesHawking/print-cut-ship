package storage

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/JamesHawking/print-cut-ship/backend/internal/store"
)

// Default retention windows (overridable via env in RunSweep's caller).
const (
	stalePendingHours     = 24
	unorderedRetentionDay = 30
)

// RunSweep soft-deletes files past their retention window. It reclaims two
// classes: (a) stale pending reservations (no object was ever stored) and
// (b) uploaded files older than the unordered window that no quote or step
// request references. Referenced files are kept — ordered-file retention lands
// with plans 05/14. Rows are only soft-deleted (deleted_at) so FKs stay valid.
func RunSweep(ctx context.Context, st *store.Store, strg *Store, unorderedDays int, logger *slog.Logger) error {
	if unorderedDays <= 0 {
		unorderedDays = unorderedRetentionDay
	}
	now := time.Now()

	pendingCutoff := tstamp(now.Add(-stalePendingHours * time.Hour))
	stale, err := st.ListStalePendingFiles(ctx, pendingCutoff)
	if err != nil {
		return err
	}
	for _, id := range stale {
		if err := st.SoftDeleteFile(ctx, id); err != nil {
			return err
		}
	}

	uploadedCutoff := tstamp(now.AddDate(0, 0, -unorderedDays))
	unref, err := st.ListUnreferencedUploadedFiles(ctx, uploadedCutoff)
	if err != nil {
		return err
	}
	removed := 0
	for _, f := range unref {
		if f.StorageKey != nil {
			if err := strg.Remove(ctx, *f.StorageKey); err != nil {
				// Log and continue: a missing object shouldn't block reclaiming
				// the rest, and the row still gets soft-deleted below.
				logger.Warn("sweep: remove object failed", "err", err, "key", *f.StorageKey)
			}
		}
		if err := st.SoftDeleteFile(ctx, f.ID); err != nil {
			return err
		}
		removed++
	}

	logger.Info("retention sweep complete",
		"stalePending", len(stale), "unorderedRemoved", removed)
	return nil
}

func tstamp(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}
