package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store is the data-access layer over the pgx pool. It embeds the sqlc-generated
// *Queries so all single-statement queries are available directly, and adds
// multi-statement transactional operations.
type Store struct {
	*Queries
	pool *pgxpool.Pool
}

// NewStore wraps a pool in a Store. *pgxpool.Pool satisfies the generated DBTX
// interface, so the embedded Queries run against the pool.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{Queries: New(pool), pool: pool}
}

// ReplaceActivePricingConfig atomically deactivates the current active
// snapshot (if any) and inserts a new active one. The partial unique index
// pricing_config_one_active guarantees at-most-one active row.
func (s *Store) ReplaceActivePricingConfig(ctx context.Context, label string, config []byte) (uuid.UUID, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, fmt.Errorf("store: begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := s.Queries.WithTx(tx)
	if err := qtx.DeactivatePricingConfigs(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("store: deactivate configs: %w", err)
	}
	id, err := qtx.InsertPricingConfigSnapshot(ctx, InsertPricingConfigSnapshotParams{
		Label: label, Config: config, IsActive: true,
	})
	if err != nil {
		return uuid.Nil, fmt.Errorf("store: insert config: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, fmt.Errorf("store: commit tx: %w", err)
	}
	return id, nil
}

// CreateQuote inserts a quote and its parts atomically. The caller leaves each
// part's QuoteID zero; CreateQuote sets it to the new quote's id.
func (s *Store) CreateQuote(ctx context.Context, quote InsertQuoteParams, parts []InsertQuotePartParams) (InsertQuoteRow, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InsertQuoteRow{}, fmt.Errorf("store: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op after a successful Commit

	qtx := s.Queries.WithTx(tx)
	row, err := qtx.InsertQuote(ctx, quote)
	if err != nil {
		return InsertQuoteRow{}, fmt.Errorf("store: insert quote: %w", err)
	}
	for i := range parts {
		parts[i].QuoteID = row.ID
		if err := qtx.InsertQuotePart(ctx, parts[i]); err != nil {
			return InsertQuoteRow{}, fmt.Errorf("store: insert quote part %d: %w", i, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return InsertQuoteRow{}, fmt.Errorf("store: commit tx: %w", err)
	}
	return row, nil
}

// CreateOrder inserts an order and its items atomically and flips the parent
// quote to 'ordered', so a quote can never be converted twice (plan 05). The
// caller leaves each item's OrderID zero; CreateOrder sets it to the new
// order's id.
func (s *Store) CreateOrder(ctx context.Context, order InsertOrderParams, items []InsertOrderItemParams) (InsertOrderRow, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return InsertOrderRow{}, fmt.Errorf("store: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op after a successful Commit

	qtx := s.Queries.WithTx(tx)
	row, err := qtx.InsertOrder(ctx, order)
	if err != nil {
		return InsertOrderRow{}, fmt.Errorf("store: insert order: %w", err)
	}
	for i := range items {
		items[i].OrderID = row.ID
		if err := qtx.InsertOrderItem(ctx, items[i]); err != nil {
			return InsertOrderRow{}, fmt.Errorf("store: insert order item %d: %w", i, err)
		}
	}
	if err := qtx.MarkQuoteOrdered(ctx, order.QuoteID); err != nil {
		return InsertOrderRow{}, fmt.Errorf("store: mark quote ordered: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return InsertOrderRow{}, fmt.Errorf("store: commit tx: %w", err)
	}
	return row, nil
}
