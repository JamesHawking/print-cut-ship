package makerworld

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Ports the profile-picking and download-flow cases from the original
// tests/makerworld.test.ts (URL parsing stays client-side and keeps its
// TS tests).

func TestPickProfileID(t *testing.T) {
	design := Design{
		DefaultInstanceID: 11,
		Instances: []Instance{
			{ID: 11, ProfileID: 101},
			{ID: 22, ProfileID: 202},
		},
	}
	cases := []struct {
		name      string
		design    Design
		requested int64
		want      int64
	}{
		{"default instance resolves its profileId", design, 0, 101},
		{"requested instance id resolves its profileId", design, 22, 202},
		{"requested id with no matching instance is used as raw profileId", design, 999, 999},
		{"requested instance without profileId falls back to requested", Design{
			Instances: []Instance{{ID: 33}},
		}, 33, 33},
		{"missing default falls back to first instance", Design{
			DefaultInstanceID: 404,
			Instances:         []Instance{{ID: 1, ProfileID: 55}},
		}, 0, 55},
		{"no instances yields zero", Design{}, 0, 0},
	}
	for _, tc := range cases {
		if got := PickProfileID(tc.design, tc.requested); got != tc.want {
			t.Errorf("%s: got %d, want %d", tc.name, got, tc.want)
		}
	}
}

// stubServer fakes the three-hop Bambu flow: design lookup, profile lookup,
// presigned file download.
func stubServer(t *testing.T, design, profile string, fileBytes []byte, profileStatus int) *httptest.Server {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/v1/design-service/design/"):
			fmt.Fprint(w, design)
		case strings.HasPrefix(r.URL.Path, "/v1/iot-service/api/user/profile/"):
			if r.Header.Get("Authorization") != "Bearer good-token" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			if profileStatus != 0 {
				w.WriteHeader(profileStatus)
				return
			}
			// Substitute the stub's own URL for the presigned download.
			fmt.Fprint(w, strings.ReplaceAll(profile, "{{base}}", srv.URL))
		case r.URL.Path == "/file":
			_, _ = w.Write(fileBytes)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	return srv
}

// rewriteTransport sends api.bambulab.com requests to the stub server.
type rewriteTransport struct{ base string }

func (rt rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.URL.Host == "api.bambulab.com" {
		stub := strings.TrimPrefix(rt.base, "http://")
		req.URL.Scheme = "http"
		req.URL.Host = stub
	}
	return http.DefaultTransport.RoundTrip(req)
}

func clientFor(srv *httptest.Server) *http.Client {
	return &http.Client{Transport: rewriteTransport{base: srv.URL}}
}

func TestDownloadHappyPath(t *testing.T) {
	srv := stubServer(t,
		`{"id":696853,"title":"Cool Benchy","modelId":"m-1","defaultInstanceId":11,"instances":[{"id":11,"profileId":101}]}`,
		`{"url":"{{base}}/file","name":"benchy-plate"}`,
		[]byte("3mf-bytes"), 0)
	defer srv.Close()

	res, code := Download(Ref{DesignID: 696853}, "good-token", clientFor(srv))
	if code != "" {
		t.Fatalf("unexpected error: %s", code)
	}
	if string(res.Bytes) != "3mf-bytes" {
		t.Errorf("bytes = %q", res.Bytes)
	}
	if res.FileName != "benchy-plate.3mf" {
		t.Errorf("fileName = %q, want benchy-plate.3mf", res.FileName)
	}
}

func TestDownloadFileNameFallbacks(t *testing.T) {
	// No profile name → design title; already-suffixed names keep their case.
	srv := stubServer(t,
		`{"id":1,"title":"My Model","modelId":"m-1","defaultInstanceId":11,"instances":[{"id":11,"profileId":101}]}`,
		`{"url":"{{base}}/file","name":"Plate.3MF"}`,
		[]byte("x"), 0)
	defer srv.Close()
	res, code := Download(Ref{DesignID: 1}, "good-token", clientFor(srv))
	if code != "" {
		t.Fatalf("unexpected error: %s", code)
	}
	if res.FileName != "Plate.3MF" {
		t.Errorf("fileName = %q, want Plate.3MF (suffix already present)", res.FileName)
	}
}

func TestDownloadErrors(t *testing.T) {
	t.Run("empty design object is design_not_found", func(t *testing.T) {
		srv := stubServer(t, `{}`, ``, nil, 0)
		defer srv.Close()
		if _, code := Download(Ref{DesignID: 1}, "good-token", clientFor(srv)); code != ErrDesignNotFound {
			t.Errorf("code = %s, want %s", code, ErrDesignNotFound)
		}
	})
	t.Run("design without instances is no_instance", func(t *testing.T) {
		srv := stubServer(t, `{"id":1,"modelId":"m-1"}`, ``, nil, 0)
		defer srv.Close()
		if _, code := Download(Ref{DesignID: 1}, "good-token", clientFor(srv)); code != ErrNoInstance {
			t.Errorf("code = %s, want %s", code, ErrNoInstance)
		}
	})
	t.Run("bad token is auth_expired", func(t *testing.T) {
		srv := stubServer(t,
			`{"id":1,"modelId":"m-1","defaultInstanceId":11,"instances":[{"id":11,"profileId":101}]}`,
			``, nil, 0)
		defer srv.Close()
		if _, code := Download(Ref{DesignID: 1}, "bad-token", clientFor(srv)); code != ErrAuthExpired {
			t.Errorf("code = %s, want %s", code, ErrAuthExpired)
		}
	})
	t.Run("profile 5xx is download_failed", func(t *testing.T) {
		srv := stubServer(t,
			`{"id":1,"modelId":"m-1","defaultInstanceId":11,"instances":[{"id":11,"profileId":101}]}`,
			``, nil, http.StatusBadGateway)
		defer srv.Close()
		if _, code := Download(Ref{DesignID: 1}, "good-token", clientFor(srv)); code != ErrDownloadFailed {
			t.Errorf("code = %s, want %s", code, ErrDownloadFailed)
		}
	})
	t.Run("profile without url is download_failed", func(t *testing.T) {
		srv := stubServer(t,
			`{"id":1,"modelId":"m-1","defaultInstanceId":11,"instances":[{"id":11,"profileId":101}]}`,
			`{"name":"no-url"}`, nil, 0)
		defer srv.Close()
		if _, code := Download(Ref{DesignID: 1}, "good-token", clientFor(srv)); code != ErrDownloadFailed {
			t.Errorf("code = %s, want %s", code, ErrDownloadFailed)
		}
	})
}
