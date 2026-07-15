// Package makerworld downloads MakerWorld model 3MFs via the
// community-documented Bambu Cloud endpoints (no official API). Ported from
// the server half of src/lib/makerworld.ts; URL parsing stays client-side.
package makerworld

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const apiBase = "https://api.bambulab.com/v1"

// MaxFileBytes mirrors MAX_FILE_BYTES in src/lib/upload.ts (100 MB).
const MaxFileBytes = 100 * 1024 * 1024

type ErrorCode string

const (
	ErrTokenMissing   ErrorCode = "token_missing"
	ErrDesignNotFound ErrorCode = "design_not_found"
	ErrNoInstance     ErrorCode = "no_instance"
	ErrAuthExpired    ErrorCode = "auth_expired"
	ErrDownloadFailed ErrorCode = "download_failed"
	ErrTooLarge       ErrorCode = "too_large"
)

type Ref struct {
	DesignID  int64
	ProfileID int64 // 0 = unset
}

type Design struct {
	ID                int64      `json:"id"`
	Title             string     `json:"title"`
	ModelID           string     `json:"modelId"`
	DefaultInstanceID int64      `json:"defaultInstanceId"`
	Instances         []Instance `json:"instances"`
}

type Instance struct {
	ID        int64 `json:"id"`
	ProfileID int64 `json:"profileId"`
}

// PickProfileID resolves an instance id (what defaultInstanceId and URL
// fragments reference) or a raw profile id to the downloadable profileId.
// Returns 0 if none can be resolved.
func PickProfileID(design Design, requested int64) int64 {
	if requested != 0 {
		for _, inst := range design.Instances {
			if inst.ID == requested {
				if inst.ProfileID != 0 {
					return inst.ProfileID
				}
				return requested
			}
		}
		// No matching instance: the fragment may already be a raw profileId.
		return requested
	}
	for _, inst := range design.Instances {
		if inst.ID == design.DefaultInstanceID && inst.ProfileID != 0 {
			return inst.ProfileID
		}
	}
	if len(design.Instances) > 0 {
		return design.Instances[0].ProfileID
	}
	return 0
}

type Result struct {
	Bytes    []byte
	FileName string
}

// noRedirectClient must not follow the presigned-URL redirect: the S3
// signature covers the exact query bytes.
var noRedirectClient = &http.Client{
	CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// Download fetches the 3MF for a design/profile. The http.Client is
// injectable for tests; pass nil for the default.
func Download(ref Ref, token string, client *http.Client) (*Result, ErrorCode) {
	if client == nil {
		client = http.DefaultClient
	}

	designRes, err := client.Get(fmt.Sprintf("%s/design-service/design/%d", apiBase, ref.DesignID))
	if err != nil || designRes.StatusCode < 200 || designRes.StatusCode >= 300 {
		if designRes != nil {
			designRes.Body.Close()
		}
		return nil, ErrDesignNotFound
	}
	var design Design
	decodeErr := json.NewDecoder(designRes.Body).Decode(&design)
	designRes.Body.Close()
	// Nonexistent designs come back 200 with an empty object (id: 0).
	if decodeErr != nil || design.ID == 0 {
		return nil, ErrDesignNotFound
	}

	profileID := PickProfileID(design, ref.ProfileID)
	if profileID == 0 || design.ModelID == "" {
		return nil, ErrNoInstance
	}

	profileReq, _ := http.NewRequest(http.MethodGet,
		fmt.Sprintf("%s/iot-service/api/user/profile/%d?model_id=%s", apiBase, profileID, design.ModelID), nil)
	profileReq.Header.Set("Authorization", "Bearer "+token)
	profileRes, err := client.Do(profileReq)
	if err != nil {
		return nil, ErrDownloadFailed
	}
	if profileRes.StatusCode == http.StatusUnauthorized {
		profileRes.Body.Close()
		return nil, ErrAuthExpired
	}
	if profileRes.StatusCode != http.StatusOK {
		profileRes.Body.Close()
		return nil, ErrDownloadFailed
	}
	var profile struct {
		URL  string `json:"url"`
		Name string `json:"name"`
	}
	decodeErr = json.NewDecoder(profileRes.Body).Decode(&profile)
	profileRes.Body.Close()
	if decodeErr != nil || profile.URL == "" {
		return nil, ErrDownloadFailed
	}

	fileReq, err := http.NewRequest(http.MethodGet, profile.URL, nil)
	if err != nil {
		return nil, ErrDownloadFailed
	}
	fileRes, err := noRedirectClientFor(client).Do(fileReq)
	if err != nil {
		return nil, ErrDownloadFailed
	}
	defer fileRes.Body.Close()
	if fileRes.StatusCode < 200 || fileRes.StatusCode >= 300 {
		return nil, ErrDownloadFailed
	}
	if fileRes.ContentLength > MaxFileBytes {
		return nil, ErrTooLarge
	}
	bytes, err := io.ReadAll(io.LimitReader(fileRes.Body, MaxFileBytes+1))
	if err != nil {
		return nil, ErrDownloadFailed
	}
	if len(bytes) > MaxFileBytes {
		return nil, ErrTooLarge
	}

	base := strings.TrimSpace(profile.Name)
	if base == "" {
		base = strings.TrimSpace(design.Title)
	}
	if base == "" {
		base = fmt.Sprintf("makerworld-%d", ref.DesignID)
	}
	fileName := base
	if !strings.HasSuffix(strings.ToLower(base), ".3mf") {
		fileName = base + ".3mf"
	}
	return &Result{Bytes: bytes, FileName: fileName}, ""
}

// noRedirectClientFor keeps the caller's transport (test stubs) while
// disabling redirect-following for the presigned download.
func noRedirectClientFor(base *http.Client) *http.Client {
	if base == http.DefaultClient {
		return noRedirectClient
	}
	c := *base
	c.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return &c
}
