.PHONY: run test build gen gen-go gen-ts

run:
	go run ./cmd/api

test:
	go test ./...

build:
	go build ./...

# Regenerate server/type code from api/openapi.yaml (Go) and the TS client
# types consumed by instant-quote.
gen: gen-go gen-ts

gen-go:
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.4.1 \
		-generate types,chi-server -package httpapi \
		-o internal/httpapi/gen.go api/openapi.yaml

gen-ts:
	cd ../instant-quote && bunx openapi-typescript@7 ../backend/api/openapi.yaml \
		-o src/lib/api/schema.d.ts
