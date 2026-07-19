package pricing

import (
	"sync/atomic"

	"github.com/google/uuid"
)

// Active is the immutable (snapshot id, config) pair currently pricing new
// quotes. The id is the pricing_config_snapshots row the config came from;
// quotes are stamped with it.
type Active struct {
	ID  uuid.UUID
	Cfg *Config
}

// Holder is the live-swappable active pricing config (plan 07). Readers take
// one Get() per request so the computed price and the stamped config id can
// never skew; the admin editor Sets a new pair only after the new snapshot is
// persisted (persist first, swap second).
type Holder struct {
	active atomic.Pointer[Active]
}

func NewHolder(id uuid.UUID, cfg *Config) *Holder {
	h := &Holder{}
	h.active.Store(&Active{ID: id, Cfg: cfg})
	return h
}

func (h *Holder) Get() Active {
	return *h.active.Load()
}

func (h *Holder) Set(id uuid.UUID, cfg *Config) {
	h.active.Store(&Active{ID: id, Cfg: cfg})
}
