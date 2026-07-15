// Package leadtime ports src/lib/leadtime.ts: ship-date computation from a
// Europe/Warsaw wall clock with a 14:00 same-day cutoff, skipping weekends
// (no public-holiday handling). Calendar math steps whole days after
// extracting the Warsaw local date, so DST cannot skew it.
package leadtime

import (
	"fmt"
	"time"
)

var warsaw = mustLoadWarsaw()

func mustLoadWarsaw() *time.Location {
	loc, err := time.LoadLocation("Europe/Warsaw")
	if err != nil {
		panic(err) // tzdata is embedded via time/tzdata in cmd/api
	}
	return loc
}

type CalDate struct {
	Y int `json:"y"`
	M int `json:"m"` // 1-12
	D int `json:"d"`
}

type ShipDate struct {
	Date CalDate `json:"date"`
	// False if weekend or past the 14:00 cutoff.
	DispatchStartsToday bool   `json:"dispatchStartsToday"`
	Label               string `json:"label"` // e.g. "Thu 16 Jul"
}

// warsawDate extracts the Warsaw wall-clock date and hour for an instant.
func warsawDate(now time.Time) (CalDate, int) {
	w := now.In(warsaw)
	return CalDate{Y: w.Year(), M: int(w.Month()), D: w.Day()}, w.Hour()
}

// weekdayOf: 1=Mon .. 7=Sun for a calendar date (no TZ involved).
func weekdayOf(d CalDate) int {
	wd := time.Date(d.Y, time.Month(d.M), d.D, 0, 0, 0, 0, time.UTC).Weekday()
	if wd == time.Sunday {
		return 7
	}
	return int(wd)
}

func isWeekend(d CalDate) bool {
	wd := weekdayOf(d)
	return wd == 6 || wd == 7
}

func addCalendarDays(d CalDate, n int) CalDate {
	t := time.Date(d.Y, time.Month(d.M), d.D+n, 0, 0, 0, 0, time.UTC)
	return CalDate{Y: t.Year(), M: int(t.Month()), D: t.Day()}
}

func nextBusinessDay(d CalDate) CalDate {
	next := addCalendarDays(d, 1)
	for isWeekend(next) {
		next = addCalendarDays(next, 1)
	}
	return next
}

func addBusinessDays(d CalDate, n int) CalDate {
	result := d
	for i := 0; i < n; i++ {
		result = nextBusinessDay(result)
	}
	return result
}

// Short names match Chrome's Intl en-GB output, which the app displayed
// before the port (note "Sept", not "Sep").
var weekdayShort = [8]string{"", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
var monthShort = [13]string{"", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sept", "Oct", "Nov", "Dec"}

func formatLabel(d CalDate) string {
	return fmt.Sprintf("%s %d %s", weekdayShort[weekdayOf(d)], d.D, monthShort[d.M])
}

// ComputeShipDate returns the estimated ship date for a lead time of
// businessDays, given the same-day dispatch cutoff hour (Warsaw wall clock).
func ComputeShipDate(businessDays, cutoffHour int, now time.Time) ShipDate {
	today, hour := warsawDate(now)

	todayIsBusiness := !isWeekend(today)
	beforeCutoff := hour < cutoffHour
	dispatchStartsToday := todayIsBusiness && beforeCutoff

	// Day 0 for the lead-time countdown: today if we can still dispatch
	// today, otherwise the next business day.
	day0 := today
	if !dispatchStartsToday {
		day0 = nextBusinessDay(today)
	}

	shipDate := addBusinessDays(day0, businessDays)

	return ShipDate{
		Date:                shipDate,
		DispatchStartsToday: dispatchStartsToday,
		Label:               formatLabel(shipDate),
	}
}
