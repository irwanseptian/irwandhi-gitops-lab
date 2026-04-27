FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /webhook .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /webhook /webhook
EXPOSE 4000
CMD ["/webhook"]
