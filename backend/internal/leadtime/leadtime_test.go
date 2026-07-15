package leadtime

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

// Golden cases generated from the original TS implementation
// (instant-quote/tests/golden/generate.ts). Labels are intentionally not in
// the golden file: Intl output differs across JS engines, so Go is the
// canonical formatter (see TestFormatLabel).

type goldenFile struct {
	Cases []struct {
		ISO          string `json:"iso"`
		Lead         string `json:"lead"`
		BusinessDays int    `json:"businessDays"`
		CutoffHour   int    `json:"cutoffHour"`
		Expected     struct {
			Date                CalDate `json:"date"`
			DispatchStartsToday bool    `json:"dispatchStartsToday"`
		} `json:"expected"`
	} `json:"cases"`
}

func TestGoldenShipDates(t *testing.T) {
	raw, err := os.ReadFile("testdata/golden.json")
	if err != nil {
		t.Fatalf("read golden file: %v", err)
	}
	var g goldenFile
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parse golden file: %v", err)
	}
	if len(g.Cases) < 30 {
		t.Fatalf("suspiciously few cases: %d", len(g.Cases))
	}
	for _, tc := range g.Cases {
		now, err := time.Parse(time.RFC3339, tc.ISO)
		if err != nil {
			t.Fatalf("%s: bad instant: %v", tc.ISO, err)
		}
		got := ComputeShipDate(tc.BusinessDays, tc.CutoffHour, now)
		if got.Date != tc.Expected.Date || got.DispatchStartsToday != tc.Expected.DispatchStartsToday {
			t.Errorf("%s/%s: got %+v dispatchToday=%v, want %+v dispatchToday=%v",
				tc.ISO, tc.Lead, got.Date, got.DispatchStartsToday,
				tc.Expected.Date, tc.Expected.DispatchStartsToday)
		}
	}
}

// Label format matches what Chrome's Intl en-GB rendered pre-migration:
// "EEE d MMM" without a comma, and "Sept" for September.
func TestFormatLabel(t *testing.T) {
	cases := []struct {
		date CalDate
		want string
	}{
		{CalDate{2026, 7, 16}, "Thu 16 Jul"},
		{CalDate{2026, 9, 15}, "Tue 15 Sept"},
		{CalDate{2026, 1, 2}, "Fri 2 Jan"},
		{CalDate{2026, 12, 31}, "Thu 31 Dec"},
		{CalDate{2028, 2, 29}, "Tue 29 Feb"},
	}
	for _, tc := range cases {
		if got := formatLabel(tc.date); got != tc.want {
			t.Errorf("formatLabel(%+v) = %q, want %q", tc.date, got, tc.want)
		}
	}
}

// The cutoff boundary is strict: dispatch starts today only while the Warsaw
// wall clock reads earlier than the cutoff hour.
func TestCutoffBoundary(t *testing.T) {
	// 2026-07-15 is a Wednesday; Warsaw is UTC+2 in July.
	before, _ := time.Parse(time.RFC3339, "2026-07-15T11:59:59Z")   // 13:59:59
	atCutoff, _ := time.Parse(time.RFC3339, "2026-07-15T12:00:00Z") // 14:00:00

	if !ComputeShipDate(5, 14, before).DispatchStartsToday {
		t.Error("13:59 Warsaw should dispatch today")
	}
	if ComputeShipDate(5, 14, atCutoff).DispatchStartsToday {
		t.Error("14:00 Warsaw should NOT dispatch today")
	}
}
