// Package storage wraps the S3-compatible object store (MinIO locally, plan 03
// wires production) that holds uploaded model files. Keys are content-addressed
// by the client's SHA-256 so re-drops and MakerWorld re-imports dedup for free.
package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Store is the object-storage client. It holds two minio clients: one for
// server-side operations (Put/Get/Stat/Remove against the internal endpoint)
// and one for presigning browser-facing PUT URLs. They differ only in
// production, where the browser reaches MinIO on a public host the backend
// cannot use internally (S3_PUBLIC_ENDPOINT).
type Store struct {
	client  *minio.Client
	presign *minio.Client
	bucket  string
}

// New builds a Store from env:
//
//	S3_ENDPOINT         internal host:port (default localhost:9000)
//	S3_PUBLIC_ENDPOINT  browser-reachable host:port (default = S3_ENDPOINT)
//	S3_ACCESS_KEY       (default minioadmin)
//	S3_SECRET_KEY       (default minioadmin)
//	S3_BUCKET           (default instantquote)
//	S3_USE_SSL          "true" to use https (default false)
func New() (*Store, error) {
	endpoint := envOr("S3_ENDPOINT", "localhost:9000")
	publicEndpoint := envOr("S3_PUBLIC_ENDPOINT", endpoint)
	accessKey := envOr("S3_ACCESS_KEY", "minioadmin")
	secretKey := envOr("S3_SECRET_KEY", "minioadmin")
	bucket := envOr("S3_BUCKET", "instantquote")
	useSSL := os.Getenv("S3_USE_SSL") == "true"

	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	}
	client, err := minio.New(endpoint, opts)
	if err != nil {
		return nil, fmt.Errorf("storage: client: %w", err)
	}
	presign := client
	if publicEndpoint != endpoint {
		presign, err = minio.New(publicEndpoint, opts)
		if err != nil {
			return nil, fmt.Errorf("storage: presign client: %w", err)
		}
	}
	return &Store{client: client, presign: presign, bucket: bucket}, nil
}

// EnsureBucket creates the bucket if it does not exist. Called at startup so a
// fresh MinIO needs no manual setup (mirrors the pricing-config bootstrap).
func (s *Store) EnsureBucket(ctx context.Context) error {
	ok, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("storage: bucket exists: %w", err)
	}
	if !ok {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("storage: make bucket: %w", err)
		}
	}
	return nil
}

// Key is the object key for a content hash + extension: uploads/<sha256>.<ext>.
func Key(sha256, ext string) string {
	return "uploads/" + sha256 + "." + ext
}

// PresignPut returns a presigned URL the browser PUTs the file bytes to.
func (s *Store) PresignPut(ctx context.Context, key string, ttl time.Duration) (string, error) {
	u, err := s.presign.PresignedPutObject(ctx, s.bucket, key, ttl)
	if err != nil {
		return "", fmt.Errorf("storage: presign put: %w", err)
	}
	return u.String(), nil
}

// Stat returns the object size and whether it exists.
func (s *Store) Stat(ctx context.Context, key string) (size int64, ok bool, err error) {
	info, err := s.client.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		if minio.ToErrorResponse(err).Code == "NoSuchKey" {
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("storage: stat: %w", err)
	}
	return info.Size, true, nil
}

// Get returns a reader for the object; the caller closes it.
func (s *Store) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("storage: get: %w", err)
	}
	return obj, nil
}

// Put uploads bytes server-side (used by the MakerWorld tee).
func (s *Store) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, r, size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return fmt.Errorf("storage: put: %w", err)
	}
	return nil
}

// Remove deletes the object (retention sweep).
func (s *Store) Remove(ctx context.Context, key string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("storage: remove: %w", err)
	}
	return nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
